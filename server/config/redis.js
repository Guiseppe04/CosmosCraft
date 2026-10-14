const { createClient } = require('redis');

const redisEnabled = Boolean(process.env.REDIS_URL);
const keyPrefix = process.env.REDIS_KEY_PREFIX || 'cosmoscraft:';
let client;
let lastWarning = 0;

function redisErrorReason(error) {
  const code = error?.code || error?.cause?.code;
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'DNS_LOOKUP_FAILED';
  if (code === 'ECONNREFUSED') return 'CONNECTION_REFUSED';
  if (code === 'ETIMEDOUT' || error?.name === 'SocketTimeoutError' ||
      /^connection timeout$/i.test(error?.message || '')) return 'CONNECTION_TIMEOUT';
  if (code === 'ECONNRESET') return 'CONNECTION_RESET';
  if (/\b(?:WRONGPASS|NOAUTH|NOPERM)\b/i.test(error?.message || '')) return 'AUTHENTICATION_FAILED';
  return 'UNKNOWN';
}

function getRedisClient() {
  if (!redisEnabled) return null;
  if (!client) {
    client = createClient({
      url: process.env.REDIS_URL,
      disableOfflineQueue: true,
      socket: { connectTimeout: 2000, reconnectStrategy: retries => Math.min(100 * (retries + 1), 3000) },
    });
    client.on('error', (error) => {
      if (Date.now() - lastWarning > 30000) {
        console.warn(`Redis unavailable (${redisErrorReason(error)}); caching is bypassed and protected requests return 503.`);
        lastWarning = Date.now();
      }
    });
    // Reconnection continues in the background. Never log connection URLs or credentials.
    void client.connect().catch(() => {});
  }
  return client;
}

async function sendRedisCommand(args) {
  const connection = getRedisClient();
  if (!connection?.isReady) throw new Error('Redis unavailable');
  // node-redis stops observing abortSignal after writing a command. Close a
  // stalled connection so an unanswered command cannot hold an HTTP request.
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (client === connection) {
        client = undefined;
        connection.destroy();
      }
      reject(new Error('Redis command timed out'));
    }, 1500);
    connection.withCommandOptions({ abortSignal: AbortSignal.timeout(1000) }).sendCommand(args).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

function closeRedis() {
  if (client?.isOpen) client.destroy();
}

module.exports = { redisEnabled, keyPrefix, getRedisClient, sendRedisCommand, closeRedis, redisErrorReason };
