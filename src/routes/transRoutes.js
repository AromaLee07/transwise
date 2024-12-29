const express = require('express');
const router = express.Router();
const transController = require('../controllers/transController');
const quotaController = require('../controllers/quotaController');

// api
// 配额检查接口
router.get('/check-quota', transController.checkQuota);

// 重置配额接口
router.get('/reset-quota', transController.resetQuota);

// 监控端点
router.get('/monitor', transController.monitorUsage);

// 翻译接口
router.post('/translate', transController.translate);

router.post('/input-trans', transController.input_trans);


module.exports = router;