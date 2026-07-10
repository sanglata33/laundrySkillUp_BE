/**
 * middlewares/rateLimiter.middleware.js — Chống spam và brute-force
 *
 * Sử dụng express-rate-limit để giới hạn tần suất request.
 *
 * Chiến lược bảo mật:
 *  1. sendOtpLimiter  : Max 3 lần gửi OTP / 10 phút / IP
 *     → Ngăn attacker spam SMS tới nhiều SĐT
 *
 *  2. verifyOtpLimiter: Max 10 lần verify / 15 phút / IP
 *     → Hàng rào thứ 2, kết hợp với logic attempts trong otp.service
 *
 * Lưu ý: Dùng MemoryStore (mặc định) đủ cho MVP/EXE.
 * Khi scale nhiều server, nâng cấp lên RedisStore (rate-limit-redis).
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

/**
 * Format response lỗi nhất quán với ApiResponse trong project
 */
const rateLimitHandler = (req, res, options) => {
  return res.status(options.statusCode).json({
    success: false,
    message: options.message,
    data:    null,
    retryAfter: Math.ceil(options.windowMs / 1000 / 60), // phút
  });
};

/**
 * Rate limiter cho POST /api/auth/send-otp
 * Giới hạn: 3 requests / 10 phút / IP
 *
 * Tại sao 3 lần?
 *  - Lần 1: Gửi lần đầu
 *  - Lần 2: Gửi lại nếu không nhận được
 *  - Lần 3: Thử lần cuối
 *  → Đủ cho người dùng hợp lệ, ngăn script spam
 */
const sendOtpLimiter = rateLimit({
  windowMs:         10 * 60 * 1000, // 10 phút
  max:              3,
  message:          'Bạn đã yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau 10 phút.',
  standardHeaders:  true,  // Trả về header RateLimit-* (RFC 6585)
  legacyHeaders:    false, // Tắt header X-RateLimit-* cũ
  handler:          rateLimitHandler,
  // Dùng IP để rate limit (phù hợp với mobile app)
  keyGenerator:     (req) => ipKeyGenerator(req),
  skip:             (req) => process.env.NODE_ENV === 'test',
});

/**
 * Rate limiter cho POST /api/auth/verify-otp
 * Giới hạn: 10 requests / 15 phút / IP
 *
 * Logic kép: IP-level limit (middleware) + SĐT-level limit (otp.service)
 */
const verifyOtpLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 phút
  max:             10,
  message:         'Quá nhiều lần xác thực thất bại. Vui lòng thử lại sau 15 phút.',
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
  keyGenerator:    (req) => ipKeyGenerator(req),
  skip:            (req) => process.env.NODE_ENV === 'test',
});

/**
 * Rate limiter chung cho các API nhạy cảm khác
 * Giới hạn: 100 requests / 15 phút / IP
 */
const generalLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             100,
  message:         'Quá nhiều request từ IP này. Vui lòng thử lại sau.',
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
  skip:            (req) => process.env.NODE_ENV === 'test',
});

module.exports = { sendOtpLimiter, verifyOtpLimiter, generalLimiter };
