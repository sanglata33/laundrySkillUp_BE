/**
 * models/OTP.model.js — Schema lưu mã OTP tạm thời
 *
 * Thiết kế:
 *  - Mỗi SĐT chỉ có 1 OTP record tại một thời điểm (upsert)
 *  - OTP được hash bằng bcrypt trước khi lưu (bảo mật)
 *  - TTL Index tự động xóa document sau khi hết hạn
 *  - Theo dõi số lần nhập sai để chống brute-force
 */

const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema(
  {
    // SĐT của người dùng
    phone: {
      type:     String,
      required: [true, 'SĐT không được để trống'],
      trim:     true,
      // Không khai báo index ở đây — đã được khai báo qua OTPSchema.index() bên dưới
    },

    // OTP đã được hash bằng bcrypt (KHÔNG lưu plaintext)
    otpHash: {
      type:     String,
      required: true,
    },

    // Thời điểm OTP hết hạn (mặc định 5 phút)
    expiresAt: {
      type:     Date,
      required: true,
    },

    // Số lần nhập sai — chống brute-force
    // Sau MAX_ATTEMPTS lần sai, OTP bị vô hiệu hóa
    attempts: {
      type:    Number,
      default: 0,
    },

    // Có bị khóa do nhập sai quá nhiều không
    isLocked: {
      type:    Boolean,
      default: false,
    },

    // Dùng cho TTL index của Mongoose — document tự xóa sau khi hết hạn
    // (MongoDB sẽ chạy cleanup job mỗi 60 giây)
    createdAt: {
      type:    Date,
      default: Date.now,
      expires: 0, // Hết hạn tại thời điểm expiresAt (dùng expireAfterSeconds=0 + expiresAt field)
    },
  },
  {
    // Không dùng timestamps tự động vì chúng ta tự quản lý createdAt
    versionKey: false,
  }
);

// ─── TTL Index: MongoDB tự xóa document khi expiresAt < now ─────────────────
// Đây là cách chuẩn để tự xóa theo field tuỳ chọn thay vì seconds cố định
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── Compound Index: đảm bảo mỗi phone chỉ có 1 OTP ────────────────────────
// (Kết hợp với upsert trong otp.service.js)
OTPSchema.index({ phone: 1 }, { unique: true });

module.exports = mongoose.model('OTP', OTPSchema);
