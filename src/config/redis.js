const Redis = require('ioredis');
const config = require('./index');

// Connection failures arrive as an AggregateError with an empty message,
// so fall back to the error code (for example ECONNREFUSED).
const describeError = (err) =>
  err.message || err.code || (err.errors && err.errors[0] && err.errors[0].code) || String(err);

const createRedis = (options = {}) => {
  const client = new Redis({ host: config.redis.host, port: config.redis.port, ...options });

  // ioredis emits an error on every reconnect attempt; log at most one per interval.
  let lastLoggedAt = 0;
  client.on('error', (err) => {
    const now = Date.now();
    if (now - lastLoggedAt < config.redis.errorLogIntervalMs) return;
    lastLoggedAt = now;
    console.error('Redis error:', describeError(err));
  });
  return client;
};

// Shared connection for ordinary commands. Fails fast when Redis is down
// instead of queueing commands forever.
const redis = createRedis({ maxRetriesPerRequest: 2 });

module.exports = { redis, createRedis, describeError };
