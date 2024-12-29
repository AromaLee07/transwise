const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

// 处理Google登录的路由
router.get('/auth/google', apiController.googleLogin);

// 处理Google登录回调的路由
router.get('/auth/google/callback', apiController.googleCallback);


router.post('/get-cookie',apiController.getCookie)

router.post('/user/logout', apiController.logout)

router.get('/api/user-info', apiController.userInfo)

module.exports = router;

