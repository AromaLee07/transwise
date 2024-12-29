// const redisClient = require("../redis/redisClient");

// const DAILY_LIMIT = 3; // 每日翻译限制次数

// // 检查用户的剩余翻译次数
// exports.checkQuota = async (req, res) => {
//     try {
//         const { userId } = req.body;
//         if (!userId) {
//             return res.status(400).json({
//                 status: "error",
//                 message: "Missing userId"
//             });
//         }

//         const redisKey = `translate:count:${userId}`;
        
//         // 获取当前使用次数
//         let count = await redisClient.get(redisKey);
//         count = count ? parseInt(count, 10) : 0;

//         // 计算剩余次数
//         const remainingQuota = Math.max(0, DAILY_LIMIT - count);

//         // 检查是否超过限制
//         const canTranslate = count < DAILY_LIMIT;

//         return res.json({
//             status: "success",
//             data: {
//                 dailyLimit: DAILY_LIMIT,
//                 used: count,
//                 remaining: remainingQuota,
//                 canTranslate: canTranslate
//             }
//         });
//     } catch (error) {
//         console.error("Error checking quota:", error);
//         return res.status(500).json({
//             status: "error",
//             message: "Error checking translation quota"
//         });
//     }
// };

// // 增加用户的翻译次数
// exports.incrementQuota = async (userId) => {
//     try {
//         const redisKey = `translate:count:${userId}`;
        
//         // 获取当前次数
//         let count = await redisClient.get(redisKey);
//         count = count ? parseInt(count, 10) : 0;

//         // 检查是否超过限制
//         if (count >= DAILY_LIMIT) {
//             return {
//                 success: false,
//                 message: "已超过每日翻译限制",
//                 count: count
//             };
//         }

//         // 增加计数并设置 24 小时过期时间
//         await redisClient.set(redisKey, count + 1, {
//             EX: 24 * 60 * 60 // 24小时过期
//         });

//         return {
//             success: true,
//             count: count + 1
//         };
//     } catch (error) {
//         console.error("Error incrementing quota:", error);
//         throw error;
//     }
// };
