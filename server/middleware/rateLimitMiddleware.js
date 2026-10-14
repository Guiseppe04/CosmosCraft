const { ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { redisEnabled, keyPrefix, getRedisClient, sendRedisCommand } = require('../config/redis');

// One Redis script makes refill, decision, and update atomic across app instances.
// Redis TIME prevents clients with different clocks from changing the refill rate.
const TOKEN_BUCKET_SCRIPT = `
local capacity = tonumber(ARGV[1])
local refill_ms = tonumber(ARGV[2])
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local state = redis.call('HMGET', KEYS[1], 'tokens', 'updated')
local tokens = tonumber(state[1]) or capacity
local updated = tonumber(state[2]) or now
tokens = math.min(capacity, tokens + math.max(0, now - updated) / refill_ms)
local allowed = 1
if tokens >= 1 then tokens = tokens - 1 else allowed = 0 end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'updated', now)
redis.call('PEXPIRE', KEYS[1], math.ceil(capacity * refill_ms))
local retry = 0
if allowed == 0 then retry = math.ceil((1 - tokens) * refill_ms) end
local reset = math.ceil((capacity - tokens) * refill_ms)
return {allowed, math.floor(tokens * 1000), retry, reset}
`;

const getAccessTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader === 'string' && /^Bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^Bearer\s+/i, '');
  }

  if (typeof req.headers['x-access-token'] === 'string') return req.headers['x-access-token'];

  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === 'string') {
    const matches = cookieHeader.match(/(?:^|;\s*)accessToken=([^;]+)/);
    if (matches) {
      try { return decodeURIComponent(matches[1]); } catch { return null; }
    }
  }

  return null;
};

const isAuthPath = (path) => path === '/auth' || path.startsWith('/auth/') ||
  path === '/api/auth' || path.startsWith('/api/auth/');

const sessionAuthPaths = new Set([
  '/check', '/refresh', '/logout', '/terms/status', '/terms/account', '/terms/checkout',
]);
const isSessionAuthPath = (path) => sessionAuthPaths.has(path.replace(/\/$/, ''));

const getGeneralRateLimitKey = (req) => {
  const token = getAccessTokenFromRequest(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.id) return `user:${decoded.id}`;
    } catch { /* Invalid tokens remain in the anonymous IP bucket. */ }
  }
  return `ip:${ipKeyGenerator(req.ip)}`;
};

const rateLimitSetting = (name, fallback, min, max) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
};

const isAdminRequest = (req) => {
  const token = getAccessTokenFromRequest(req);
  if (!token) {
    return false;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded && (decoded.role === 'admin' || decoded.role === 'super_admin');
  } catch (error) {
    return false;
  }
};

const createRateLimiter = (options = {}) => {
  const { scope, policy, keyGenerator = req => `ip:${ipKeyGenerator(req.ip)}`,
    capacity, refillMs, skip = () => false,
    message = { status: 429, error: 'Too many requests. Please try again shortly.' } } = options;
  if (!scope) throw new Error('A unique rate limiter scope is required');
  const memory = new Map();
  let calls = 0;
  const unavailable = (res) => res.status(503).set('Retry-After', '5').json({
    status: 503, error: 'Request protection is temporarily unavailable. Please try again shortly.',
  });
  const consume = async (key, limit, interval) => {
    if (redisEnabled) {
      if (!getRedisClient()?.isReady) throw new Error('Redis unavailable');
      const result = await sendRedisCommand([
        'EVAL', TOKEN_BUCKET_SCRIPT, '1', `${keyPrefix}rl:tb:v1:${scope}:${key}`,
        String(limit), String(interval),
      ]);
      return { allowed: result[0] === 1, remaining: Math.floor(result[1] / 1000),
        retryMs: result[2], resetMs: result[3] };
    }
    const now = Date.now();
    if (++calls % 1000 === 0) {
      for (const [name, value] of memory) {
        if (now - value.updated > value.capacity * value.refillMs) memory.delete(name);
      }
    }
    const previous = memory.get(key);
    let tokens = Math.min(limit, (previous?.tokens ?? limit) +
      Math.max(0, now - (previous?.updated ?? now)) / interval);
    const allowed = tokens >= 1;
    if (allowed) tokens--;
    memory.set(key, { tokens, updated: now, capacity: limit, refillMs: interval });
    return { allowed, remaining: Math.floor(tokens),
      retryMs: allowed ? 0 : Math.ceil((1 - tokens) * interval),
      resetMs: Math.ceil((limit - tokens) * interval) };
  };

  return async (req, res, next) => {
    try {
      if (skip(req)) return next();
      const resolved = policy ? policy(req) : { key: keyGenerator(req), capacity, refillMs };
      const { key, capacity: limit, refillMs: interval } = resolved;
      if (typeof key !== 'string' || !key || !Number.isSafeInteger(limit) || limit < 1 ||
          limit > 10000 || !Number.isSafeInteger(interval) || interval < 100 || interval > 3600000) {
        throw new Error(`Invalid ${scope} rate limit configuration`);
      }
      const result = await consume(key, limit, interval);
      res.set('RateLimit-Limit', String(limit));
      res.set('RateLimit-Remaining', String(result.remaining));
      res.set('RateLimit-Reset', String(Math.ceil(result.resetMs / 1000)));
      if (!result.allowed) {
        res.set('Retry-After', String(Math.max(1, Math.ceil(result.retryMs / 1000))));
        return res.status(429).json(message);
      }
      return next();
    } catch (error) {
      if (redisEnabled) return unavailable(res);
      return next(error);
    }
  };
};

module.exports = {
  createRateLimiter,
  isAdminRequest,
  isAuthPath,
  isSessionAuthPath,
  getGeneralRateLimitKey,
  rateLimitSetting,
};
