/**
 * routes/payment.routes.js — Định nghĩa routes thanh toán
 */

const express = require('express');
const router  = express.Router();

const paymentController = require('../controllers/payment.controller');
const { protect }       = require('../middlewares/auth.middleware');

const { restrictTo }    = require('../middlewares/role.middleware');

// VNPay callback — KHÔNG cần JWT (VNPay gọi về từ server của họ)
router.get('/vnpay-return', paymentController.vnpayReturn);

// SePAY Webhook callback — KHÔNG cần JWT (SePAY gọi về từ server của họ)
router.post('/webhook/sepay', paymentController.sepayWebhook);

// Các routes còn lại cần đăng nhập
router.use(protect);

router.post('/create',            paymentController.createPayment);
router.get('/order/:orderId',     paymentController.getPaymentByOrder);

// Xác nhận thanh toán chuyển khoản ngân hàng (Admin & Staff)
router.patch('/:id/confirm', restrictTo('admin', 'staff'), paymentController.confirmPayment);

module.exports = router;
