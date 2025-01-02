const User = require("../models/userModel");

const axios = require("axios");
const qs = require("qs");
require("dotenv").config(); // 确保环境变量被正确加载
const crypto = require("crypto");
const jwt = require("jsonwebtoken");



const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
// 生成 JWT 密钥
const jwtSecret = process.env.JWT_SECRET;

let extensionId = "";

exports.getCookie = async (req, res) => {
  const extensionIdReq = req.body;
  extensionId = extensionIdReq.extensionId
  console.log("extensionId is: ", extensionId);
   // 处理逻辑
   res.json({ message: 'Data received successfully' });

};

exports.googleLogin = async (req, res) => {
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=openid email profile&state=someRandomState`;
  //   res.redirect(authUrl);
  // const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
  //   REDIRECT_URI
  // )}&scope=openid email profile&access_type=offline`;
  console.log(authUrl);
  res.redirect(authUrl);
};

exports.googleCallback = async (req, res) => {
  console.log("后端开始了callback");
  // 处理授权回调
  const authCode = req.query.code;

  if (!authCode) {
    // 如果没有授权码，重定向用户到 Google 的 OAuth 2.0 授权页面
    return res.status(400).send("Authorization code not found");
  } else {
    try {
      // 使用授权码请求访问令牌
      const tokenResponse = await axios.post(
        "https://oauth2.googleapis.com/token",
        qs.stringify({
          code: authCode,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const { access_token } = tokenResponse.data;

      // 使用访问令牌请求用户信息
      const userInfoResponse = await axios.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );

      const userData = userInfoResponse.data;

      // 查询数据库中是否存在该用户
      let user = await User.findOne({ googleId: userData.sub });

      if (!user) {
        // 如果用户不存在，创建新用户
        try {
          user = new User({
            googleId: userData.sub,
            email: userData.email,
            username: userData.name,
            avatarUrl: userData.picture
            // 添加其他需要的字段
          });
          await user.save();
        } catch (dbError) {
          console.error("Error saving new user to the database:", dbError);
          return res.status(500).send("Failed to create user in the database");
        }
      } else {
        // 更新用户的 updatedAt 字段为当前时间
        try {
          user.updatedAt = Date.now();
          await user.save();
        } catch (dbError) {
          console.error("Error updating user in the database:", dbError);
          return res.status(500).send("Failed to update user in the database");
        }
      }

      console.log("user.avatarUrl:",user.avatarUrl)

      // 生成 JWT token
      const token = jwt.sign(
        {
          id: user._id,
          email: user.email,
          googleId: user.googleId,
          avatarUrl: user.avatarUrl
        },
        jwtSecret,
        { expiresIn: "3d" } // Token 有效期为1天
      );

      console.log("jwtSecret is:",jwtSecret)


       // 这里可以选择将用户数据存储在 cookie 中
    res.cookie('jwt', token, { httpOnly: true, secure: true }); // 仅在 HTTPS 上使用


    // 将用户重定向到前端页面，并附带用户信息
    res.redirect(
      `chrome-extension://fkccfnlhmaiojnaiimlnfigbmdhebeel/login.html?user=${encodeURIComponent(
        JSON.stringify(userData)
      )}`
    );

    console.log("extensionId is ....:",extensionId)

    // res.redirect(
    //   `chrome-extension://${extensionId}/login.html?user=${encodeURIComponent(
    //     JSON.stringify(userData)
    //   )}`
    // );

    // res.redirect(
    //   `chrome-extension://gdalfiappkjoibamgofjffncepfcfhnb/login.html?user=${encodeURIComponent(
    //     JSON.stringify(userData)
    //   )}`
    // );


      // 将用户重定向到前端页面，并附带用户信息
      // console.log("Extension ID:", chrome.runtime.id);
      // const extensionId = chrome.runtime.id; // 动态获取扩展 ID
      // res.redirect(
      //   `chrome-extension://${extensionId}/login.html?user=${encodeURIComponent(
      //     JSON.stringify(userData)
      //   )}`
      // );

      // 返回用户数据
      // return res.status(200).json({
      //   success: true,
      //   token: token,
      //   userData: {
      //     userId: existingUser._id.toHexString(),
      //     username: existingUser.username,
      //     email: existingUser.email,
      //     avatarUrl: existingUser.avatarUrl,
      //     clickCount: existingUser.dailyClicks.count,
      //   },
      //   // token: token // 将JWT附加到响应中
      // });

      // 将用户重定向到前端页面，并附带 token
      // res.redirect(
      //   `chrome-extension://efhojinannanlccmmgmlkbclabplgikn/login.html?token=${encodeURIComponent(token)}`
      // );

      // console.log("userData is: ", userData);
      // res.json(userData);
      console.log("wochenggongle...........")
    } catch (error) {
      console.error("Error during Google login:", error);
      res.status(500).send("Authentication failed");
    }
  }
};

exports.logout = async (req, res) => {
  console.log("req.cookes: ",req.cookies)
  // 检查请求中是否包含cookies
  if (Object.keys(req.cookies).length === 0) {
    // 如果没有cookies，返回401 Unauthorized错误
    return res.status(401).json({ error: 'Authentication is required' });
  }
  const token = req.cookies.jwt; // 假设JWT存储在cookie中
  // 将该JWT添加到失效列表中
  // 这里只是一个示例，您需要实现实际的存储逻辑
  // invalidatedTokens[token] = true;
  res.clearCookie('jwt'); // 清除客户端的cookie
  res.send('Logged out');
}


function generateJWTSecret() {
  return crypto.randomBytes(32).toString("hex");
}


exports.userInfo = async (req, res) => {

  console.log("dsfdsfsdfsfsdfdsf")
  const token = req.cookies.jwt;

  if (!token) {
    return res.status(401).json({ loggedIn: false });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      console.log("40111")
      console.error('JWT verification failed:', err);
      return res.status(401).json({ loggedIn: false });
    }
    console.log("user.avatarUrl:",user.avatarUrl)
    console.log("user.picture:", user.picture)
    // 返回用户信息
    res.status(200).json({
      loggedIn: true,
      user: {
        id: user.id,
        email: user.email,
        avatarUrl: user.avatarUrl
      }
    });
  });
}