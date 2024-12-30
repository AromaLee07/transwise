// src/redis/redisClient.js
const redis = require('redis');

const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 5000,
    reconnectStrategy: (retries) => {
      if (retries > 5) return new Error('Too many reconnect attempts');
      return retries * 100;
    }
  }
});

redisClient.on('error', (err) => {
  console.error('Redis Connection Error:', err);
});

// 添加连接和断开连接的日志
redisClient.on('connect', () => {
  console.log('Redis client connected');
});

redisClient.on('disconnect', () => {
  console.log('Redis client disconnected');
});

module.exports = redisClient;