/**
 * routes/payment.routes.js — Định nghĩa routes thanh toán
 */

const express = require('express');
const router  = express.Router();

const paymentController = require('../controllers/payment.controller');
const { protect }       = require('../middlewares/auth.middleware');

// VNPay callback — KHÔNG cần JWT (VNPay gọi về từ server của họ)
router.get('/vnpay-return', paymentController.vnpayReturn);

// Các routes còn lại cần đăng nhập
router.use(protect);

router.post('/create',            paymentController.createPayment);
router.get('/order/:orderId',     paymentController.getPaymentByOrder);

module.exports = router;
