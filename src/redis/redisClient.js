const redis = require('redis');

// 从环境变量加载配置
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// 创建 Redis 客户端配置
const redisConfig = {
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT
  }
};

// 只有在设置了密码的情况下才添加密码配置
if (REDIS_PASSWORD) {
  redisConfig.password = REDIS_PASSWORD;
}

// 创建 Redis 客户端
const redisClient = redis.createClient(redisConfig);

// 连接 Redis
(async () => {
  try {
    await redisClient.connect();
    console.log('Redis client connected successfully');
  } catch (err) {
    console.error('Redis connection error:', err);
  }
})();

// 监听错误事件
redisClient.on('error', (err) => {
  console.error('Redis Error:', err);
});

// 监听重连事件
redisClient.on('reconnecting', () => {
  console.log('Redis client reconnecting');
});

// 监听就绪事件
redisClient.on('ready', () => {
  console.log('Redis client is ready');
});

module.exports = redisClient;
