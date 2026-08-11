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

  if (order.status === 'cancelled') {
    throw new AppError('Đơn hàng đã bị hủy, không thể thực hiện thanh toán', 400);
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

    order.paymentStatus = 'paid';
    await order.save();

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

  // ── Thanh toán VietQR / Chuyển khoản ngân hàng ──
  if (method === 'bank_transfer' || method === 'vietqr') {
    const bankId      = process.env.VIETQR_BANK_ID      || 'MB';
    const accountNo   = process.env.VIETQR_ACCOUNT_NO   || '0123456789';
    const accountName = process.env.VIETQR_ACCOUNT_NAME || 'LAUNDRY SERVICE';
    const template    = process.env.VIETQR_TEMPLATE    || 'compact2';

    const prefix          = (process.env.VIETQR_PREFIX || process.env.SEPAY_PREFIX || '').trim();
    const transferContent = prefix ? `${prefix} ${order.orderCode}` : order.orderCode;

    const qrCodeUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${order.totalPrice}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(accountName)}`;

    const bankInfo = {
      bankId,
      accountNo,
      accountName,
      amount: order.totalPrice,
      transferContent,
    };

    // Kiểm tra xem đã có payment pending trước đó chưa
    let payment = await Payment.findOne({ order: orderId, status: 'pending' });

    if (payment) {
      payment.method    = 'bank_transfer';
      payment.qrCodeUrl = qrCodeUrl;
      payment.bankInfo  = bankInfo;
      payment.amount    = order.totalPrice;
      await payment.save();
    } else {
      payment = await Payment.create({
        order: orderId,
        amount: order.totalPrice,
        method: 'bank_transfer',
        status: 'pending',
        transactionId,
        qrCodeUrl,
        bankInfo,
      });
    }

    return { payment, qrCodeUrl, bankInfo };
  }

  throw new AppError('Phương thức thanh toán không được hỗ trợ', 400);
};

/**
 * Xử lý Webhook biến động số dư tự động từ SePAY
 * @param {object} payload - Dữ liệu JSON từ SePAY
 * @param {string} authHeader - Header Authorization từ request
 * @returns {{ success: boolean, message: string }}
 */
const handleSePAYWebhook = async (payload, authHeader, signature, rawBodyStr) => {
  // 1. Kiểm tra API Key / HMAC Signature bảo mật nếu đã cấu hình SEPAY_WEBHOOK_API_KEY
  const expectedApiKey = process.env.SEPAY_WEBHOOK_API_KEY;
  if (expectedApiKey) {
    let isValid = false;

    // A. Kiểm tra nếu gửi qua Header Authorization hoặc x-api-key (Phương thức API Key)
    if (authHeader) {
      const token = authHeader.replace(/^(Bearer|Apikey)\s+/i, '').trim();
      if (token === expectedApiKey || authHeader === expectedApiKey) {
        isValid = true;
      }
    }

    // B. Kiểm tra nếu gửi qua x-sepay-signature (Phương thức HMAC-SHA256)
    if (!isValid && signature) {
      const bodyToSign = rawBodyStr || JSON.stringify(payload);
      const hmacHex    = crypto.createHmac('sha256', expectedApiKey).update(bodyToSign).digest('hex');
      const hmacBase64 = crypto.createHmac('sha256', expectedApiKey).update(bodyToSign).digest('base64');
      if (signature === hmacHex || signature === hmacBase64) {
        isValid = true;
      }
    }

    if (!isValid) {
      throw new AppError('Webhook Authorization Key / Signature không hợp lệ', 401);
    }
  }

  // 2. Kiểm tra loại giao dịch (SePAY trả về transferType 'in' khi tiền vào)
  if (payload.transferType && payload.transferType !== 'in') {
    return { success: true, message: 'Bỏ qua giao dịch tiền ra (transferType != in)' };
  }

  // 3. Trích xuất nội dung chuyển khoản để tìm mã đơn hàng linh hoạt
  const rawContent = `${payload.content || ''} ${payload.description || ''} ${payload.code || ''} ${payload.transactionContent || ''}`;

  // Match LD-YYYYMMDD-XXXX (có dấu gạch ngang)
  let match = rawContent.match(/LD-\d{8}-\d{4}/i);
  let orderCode = match ? match[0].toUpperCase() : null;

  // Match LDYYYYMMDDXXXX (nếu ứng dụng ngân hàng bỏ dấu gạch ngang)
  if (!orderCode) {
    const matchNoHyphen = rawContent.match(/LD\d{12}/i);
    if (matchNoHyphen) {
      const str = matchNoHyphen[0].toUpperCase();
      orderCode = `LD-${str.substring(2, 10)}-${str.substring(10)}`;
    }
  }

  // Nếu vẫn chưa khớp, tìm trong danh sách đơn active bằng cách làm sạch chuỗi
  if (!orderCode) {
    const activeOrders = await Order.find({ status: { $ne: 'cancelled' } }).select('orderCode');
    const cleanRaw = rawContent.replace(/[\s\-_]/g, '').toUpperCase();
    const matchedOrder = activeOrders.find(o => {
      const cleanCode = o.orderCode.replace(/[\s\-_]/g, '').toUpperCase();
      return cleanRaw.includes(cleanCode);
    });
    if (matchedOrder) {
      orderCode = matchedOrder.orderCode;
    }
  }

  if (!orderCode) {
    return { success: false, message: 'Không tìm thấy mã đơn hàng trong nội dung chuyển khoản' };
  }

  // 4. Tìm đơn hàng tương ứng
  const order = await Order.findOne({ orderCode });
  if (!order) {
    throw new AppError(`Không tìm thấy đơn hàng với mã ${orderCode}`, 404);
  }

  // 5. Tìm hoặc tạo Payment record
  let payment = await Payment.findOne({ order: order._id });
  if (!payment) {
    payment = new Payment({
      order: order._id,
      amount: order.totalPrice,
      method: 'bank_transfer',
    });
  }

  if (payment.status === 'paid') {
    return { success: true, message: 'Đơn hàng đã được thanh toán trước đó' };
  }

  // 6. Cập nhật trạng thái thành paid
  payment.status      = 'paid';
  payment.paidAt      = new Date();
  payment.webhookData = payload;
  if (payload.referenceCode || payload.id) {
    payment.transactionId = `SEPAY_${payload.referenceCode || payload.id}`;
  }

  await payment.save();

  // Cập nhật trạng thái thanh toán trên Order model
  order.paymentStatus = 'paid';
  await order.save();

  // 7. Bắn Socket.io thông báo thời gian thực tới Client & Admin
  if (global._io) {
    global._io.emit('payment_success', {
      orderId: order._id,
      orderCode: order.orderCode,
      paymentId: payment._id,
      amount: payload.transferAmount || order.totalPrice,
    });
    global._io.to(`order_${order._id}`).emit('order_updated', {
      orderId: order._id,
      status: order.status,
      isPaid: true,
    });
  }

  return { success: true, message: `Thanh toán đơn hàng ${orderCode} thành công`, payment };
};

/**
 * Admin / Staff xác nhận thanh toán chuyển khoản thủ công
 * @param {string} paymentId 
 * @param {string} staffId 
 */
const confirmBankTransfer = async (paymentId, staffId) => {
  const payment = await Payment.findById(paymentId).populate('order');
  if (!payment) throw new AppError('Không tìm thấy thông tin thanh toán', 404);

  if (payment.status === 'paid') {
    throw new AppError('Giao dịch này đã được xác nhận thanh toán', 400);
  }

  payment.status = 'paid';
  payment.paidAt = new Date();
  await payment.save();

  if (payment.order) {
    if (typeof payment.order === 'object' && payment.order.save) {
      payment.order.paymentStatus = 'paid';
      await payment.order.save();
    } else {
      await Order.findByIdAndUpdate(payment.order, { paymentStatus: 'paid' });
    }
  }

  if (global._io && payment.order) {
    global._io.emit('payment_success', {
      orderId: payment.order._id,
      orderCode: payment.order.orderCode,
      paymentId: payment._id,
    });
  }

  return payment;
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

module.exports = {
  getPaymentByOrder,
  createPayment,
  handleVNPayReturn,
  handleSePAYWebhook,
  confirmBankTransfer,
};
