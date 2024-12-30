const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');


const app = express();
const PORT = process.env.PORT || 5000;

const dotenv = require('dotenv'); // 引入 dotenv
dotenv.config(); // 加载 .env 文件中的环境变量
// const mongoUri = process.env.MONGO_URI;

const apiRoutes = require("./routes/apiRoutes.js");
const transRoutes = require("./routes/transRoutes.js");
const redisClient = require('./redis/redisClient.js');



// Middleware
app.use(cors({
    origin: 'http://localhost:5000' // 只允许来自 example.com 的请求
}));
app.use(bodyParser.json());

// MongoDB 连接
// 替换密码和添加数据库名
const mongoUri = process.env.MONGO_URI.replace('<db_password>', encodeURIComponent(process.env.MONGO_PASSWORD));

mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // dbName: 'Cluster0' // 指定具体数据库名
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// 示例路由
app.get('/api', (req, res) => {
    res.send('Hello from Express!');
});

// 假设您使用cookie-parser中间件来解析cookies
app.use(cookieParser());

app.use("/", apiRoutes);
app.use("/api/profession_ability", transRoutes);

// 启动服务器
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;