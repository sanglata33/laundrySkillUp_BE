/**
 * services/payment.service.js — Business logic thanh toán
 *
 * Hỗ trợ:
 *  1. Thanh toán tiền mặt (cash) — xác nhận thủ công
 *  2. Thanh toán VNPay — tạo link redirect và xử lý callback
 */

const crypto  = require('crypto');
const qs      = require('qs');
const Payment = require('../models/Payment.model');
const Order   = require('../models/Order.model');
const AppError = require('../utils/AppError');

// ─── VNPay Helper: Tạo chữ ký HMAC-SHA512 ───────────────────────────────────
const createVNPaySignature = (params, secretKey) => {
  // Sắp xếp params theo thứ tự alphabet (yêu cầu của VNPay)
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});

  const signData = qs.stringify(sortedParams, { encode: false });
  return crypto
    .createHmac('sha512', secretKey)
    .update(Buffer.from(signData, 'utf-8'))
    .digest('hex');
};

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Lấy thông tin thanh toán của một đơn hàng
 * @param {string} orderId
 * @returns {Payment}
 */
const getPaymentByOrder = async (orderId) => {
  const payment = await Payment.findOne({ order: orderId }).populate(
    'order',
    'orderCode totalPrice status'
  );
  if (!payment) throw new AppError('Không tìm thấy thông tin thanh toán', 404);
  return payment;
};

/**
 * Tạo giao dịch thanh toán
 * @param {string} orderId
 * @param {string} method - 'cash' | 'vnpay' | 'momo'
 * @param {string} ipAddr - IP của client (dùng cho VNPay)
 * @returns {{ payment, paymentUrl? }}
 */
const createPayment = async (orderId, method, ipAddr = '127.0.0.1') => {
  // Kiểm tra đơn hàng
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

  if (order.status !== 'completed') {
    throw new AppError('Chỉ có thể thanh toán đơn hàng đã hoàn thành', 400);
  }

  // Kiểm tra đã có giao dịch thành công chưa
  const existingPayment = await Payment.findOne({
    order: orderId,
    status: 'paid',
  });
  if (existingPayment) {
    throw new AppError('Đơn hàng này đã được thanh toán', 400);
  }

  // Tạo mã giao dịch ngẫu nhiên
  const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

  // ── Thanh toán tiền mặt ──
  if (method === 'cash') {
    const payment = await Payment.create({
      order: orderId,
      amount: order.totalPrice,
      method: 'cash',
      status: 'paid', // Tiền mặt — xác nhận ngay
      transactionId,
      paidAt: new Date(),
    });
    return { payment };
  }

  // ── Thanh toán VNPay ──
  if (method === 'vnpay') {
    const vnpParams = buildVNPayParams(order, transactionId, ipAddr);
    const secureHash = createVNPaySignature(vnpParams, process.env.VNPAY_HASH_SECRET);

    const paymentUrl =
      process.env.VNPAY_URL +
      '?' +
      qs.stringify({ ...vnpParams, vnp_SecureHash: secureHash }, { encode: false });

    // Tạo payment record với status pending
    const payment = await Payment.create({
      order: orderId,
      amount: order.totalPrice,
      method: 'vnpay',
      status: 'pending',
      transactionId,
      paymentUrl,
    });

    return { payment, paymentUrl };
  }

  throw new AppError('Phương thức thanh toán không được hỗ trợ', 400);
};

/**
 * Xử lý callback từ VNPay (sau khi người dùng thanh toán)
 * @param {object} vnpayResponse - Query params từ VNPay return URL
 * @returns {{ success: boolean, payment: Payment }}
 */
const handleVNPayReturn = async (vnpayResponse) => {
  const {
    vnp_SecureHash,
    vnp_TxnRef,       // transactionId của chúng ta
    vnp_ResponseCode, // '00' = thành công
    ...rest
  } = vnpayResponse;

  // Xác thực chữ ký từ VNPay
  const expectedHash = createVNPaySignature(rest, process.env.VNPAY_HASH_SECRET);

  if (expectedHash !== vnp_SecureHash) {
    throw new AppError('Chữ ký VNPay không hợp lệ — có thể bị giả mạo', 400);
  }

  // Tìm payment record
  const payment = await Payment.findOne({ transactionId: vnp_TxnRef });
  if (!payment) throw new AppError('Không tìm thấy giao dịch', 404);

  // Cập nhật trạng thái dựa trên kết quả
  const isSuccess = vnp_ResponseCode === '00';
  payment.status    = isSuccess ? 'paid' : 'failed';
  payment.paidAt    = isSuccess ? new Date() : null;
  payment.vnpayData = vnpayResponse; // Lưu toàn bộ response để đối soát

  await payment.save();

  return { success: isSuccess, payment };
};

// ─── Helper: Build VNPay request params ─────────────────────────────────────
const buildVNPayParams = (order, transactionId, ipAddr) => {
  const now = new Date();
  const createDate = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14); // YYYYMMDDHHmmss

  return {
    vnp_Version:     '2.1.0',
    vnp_Command:     'pay',
    vnp_TmnCode:     process.env.VNPAY_TMN_CODE,
    vnp_Locale:      'vn',
    vnp_CurrCode:    'VND',
    vnp_TxnRef:      transactionId,
    vnp_OrderInfo:   `Thanh toan don hang ${order.orderCode}`,
    vnp_OrderType:   'other',
    vnp_Amount:      order.totalPrice * 100, // VNPay nhân 100
    vnp_ReturnUrl:   process.env.VNPAY_RETURN_URL,
    vnp_IpAddr:      ipAddr,
    vnp_CreateDate:  createDate,
  };
};

module.exports = { getPaymentByOrder, createPayment, handleVNPayReturn };
