const { createHash } = require('node:crypto');
const { redisEnabled, keyPrefix, sendRedisCommand } = require('../config/redis');

// Use only on explicitly public, user-independent catalog routes.
function publicCache(namespace, ttlSeconds = 15, { enabled = redisEnabled, command = sendRedisCommand } = {}) {
  return async (req, res, next) => {
    if (!enabled || req.method !== 'GET' || req.user || req.headers.authorization || req.headers.cookie ||
        req.headers['x-access-token'] || req.headers['x-refresh-token'] ||
        /no-cache|no-store/i.test(req.headers['cache-control'] || '')) return next();
    const digest = createHash('sha256').update(req.originalUrl).digest('hex');
    const key = `${keyPrefix}cache:v1:${namespace}:${digest}`;
    try {
      const cached = await command(['GET', key]);
      if (cached !== null) {
        res.set('Cache-Control', 'no-store');
        return res.json(JSON.parse(cached));
      }
    } catch {
      // A cache failure must not prevent the database-backed response.
      return next();
    }

    const json = res.json;
    res.json = function (body) {
      const cacheControl = String(res.getHeader('Cache-Control') || '');
      if (res.statusCode === 200 && !res.getHeader('Set-Cookie') &&
          !/private|no-store/i.test(cacheControl)) {
        try {
          const serialized = JSON.stringify(body);
          if (Buffer.byteLength(serialized) <= 256 * 1024) {
            void command(['SET', key, serialized, 'EX', String(ttlSeconds)]).catch(() => {});
          }
        } catch { /* Non-JSON responses are handled by Express. */ }
      }
      res.set('Cache-Control', 'no-store');
      return json.call(this, body);
    };
    return next();
  };
}

module.exports = { publicCache };
