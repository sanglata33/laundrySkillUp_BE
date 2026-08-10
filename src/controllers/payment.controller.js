/**
 * controllers/payment.controller.js — Xử lý HTTP request cho Thanh toán
 */

const paymentService = require('../services/payment.service');
const ApiResponse    = require('../utils/ApiResponse');

/**
 * GET /api/payments/order/:orderId
 * Lấy thông tin thanh toán của một đơn hàng
 */
const getPaymentByOrder = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentByOrder(req.params.orderId);
    return ApiResponse.success(res, 200, 'Lấy thông tin thanh toán thành công', { payment });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/payments/create
 * Tạo giao dịch thanh toán
 * Body: { orderId, method }
 *  - method: 'cash' | 'vnpay' | 'momo'
 */
const createPayment = async (req, res, next) => {
  try {
    const { orderId, method } = req.body;

    if (!orderId || !method) {
      return ApiResponse.error(res, 400, 'Vui lòng cung cấp orderId và method');
    }

    // Lấy IP thực của client (xuyên qua proxy)
    const ipAddr =
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const result = await paymentService.createPayment(orderId, method, ipAddr);

    return ApiResponse.created(
      res,
      method === 'cash' ? 'Thanh toán tiền mặt thành công' : 'Tạo liên kết thanh toán thành công',
      result
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/payments/webhook/sepay
 * SePAY gọi về URL này khi nhận được biến động số dư tài khoản ngân hàng
 */
const sepayWebhook = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers['x-api-key'];
    const result = await paymentService.handleSePAYWebhook(req.body, authHeader);
    return res.status(200).json({ success: true, message: result.message, data: result.payment || null });
  } catch (err) {
    // Trả 200/400 JSON theo chuẩn SePAY webhook response
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message || 'Lỗi xử lý SePAY Webhook',
    });
  }
};

/**
 * PATCH /api/payments/:id/confirm
 * Staff hoặc Admin xác nhận chuyển khoản ngân hàng đã nhận thành công (thủ công)
 */
const confirmPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.confirmBankTransfer(req.params.id, req.user._id);
    return ApiResponse.success(res, 200, 'Xác nhận thanh toán chuyển khoản thành công', { payment });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/payments/vnpay-return
 * VNPay gọi về URL này sau khi người dùng thanh toán
 * (Không cần xác thực JWT — đây là callback từ VNPay)
 */
const vnpayReturn = async (req, res, next) => {
  try {
    const result = await paymentService.handleVNPayReturn(req.query);

    // Redirect về Frontend với kết quả
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const redirectUrl = result.success
      ? `${frontendUrl}/payment/success?txn=${result.payment.transactionId}`
      : `${frontendUrl}/payment/failed?txn=${result.payment.transactionId}`;

    return res.redirect(redirectUrl);
  } catch (err) {
    // Nếu lỗi → redirect về trang lỗi Frontend
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/payment/error`);
  }
};

module.exports = {
  getPaymentByOrder,
  createPayment,
  vnpayReturn,
  sepayWebhook,
  confirmPayment,
};
