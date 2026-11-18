const Redis = require('ioredis');
const config = require('./index');

const createRedis = (options = {}) => {
  const client = new Redis({ host: config.redis.host, port: config.redis.port, ...options });
  client.on('error', (err) => console.error('Redis error:', err.message));
  return client;
};

// Shared connection for ordinary commands. Fails fast when Redis is down
// instead of queueing commands forever.
const redis = createRedis({ maxRetriesPerRequest: 2 });

module.exports = { redis, createRedis };
