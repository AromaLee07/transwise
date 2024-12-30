const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Redis 和路由导入
const { redisClient, connectRedis } = require('./redis/redisClient');
const apiRoutes = require("./routes/apiRoutes.js");
const transRoutes = require("./routes/transRoutes.js");

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 路由
app.use('/api', apiRoutes);
app.use('/trans', transRoutes);

// MongoDB 连接配置
const mongoUri = process.env.MONGO_URI.replace('<db_password>', encodeURIComponent(process.env.MONGO_PASSWORD));

// 服务器启动函数
async function startServer() {
    try {
        // 连接 Redis
        await connectRedis();

        // 连接 MongoDB
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB connected');

        // 启动服务器
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Server URL: ${process.env.SERVER_URL}`);
        });
    } catch (error) {
        console.error('Server startup error:', error);
        process.exit(1);
    }
}

startServer();