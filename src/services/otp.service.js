/**
 * services/otp.service.js — Business logic cho OTP Authentication
 *
 * Chức năng:
 *  1. Tạo và gửi OTP (generate → hash → lưu DB → gửi SMS)
 *  2. Xác thực OTP (tìm DB → kiểm tra expiry/lock/hash → xóa sau khi dùng)
 *  3. Tạo/đăng nhập User sau khi OTP hợp lệ
 */

const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const OTP        = require('../models/OTP.model');
const User       = require('../models/User.model');
const smsService = require('./sms.service');

// ─── Cấu hình từ .env ────────────────────────────────────────────────────────
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10);
const OTP_MAX_ATTEMPTS   = parseInt(process.env.OTP_MAX_ATTEMPTS   || '5', 10);
const OTP_LENGTH         = 6;
const BCRYPT_ROUNDS      = 10; // Nhẹ hơn password (8-10) vì OTP đổi liên tục

/**
 * Tạo mã OTP ngẫu nhiên dạng số
 * @returns {string} OTP 6 chữ số, ví dụ: "082341"
 */
function generateOTP() {
  const min = Math.pow(10, OTP_LENGTH - 1); // 100000
  const max = Math.pow(10, OTP_LENGTH) - 1; // 999999
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

/**
 * Chuẩn hóa SĐT về dạng bắt đầu bằng 0
 * Ví dụ: +84912345678 → 0912345678
 * @param {string} phone
 * @returns {string}
 */
function normalizePhone(phone) {
  const cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  if (cleaned.startsWith('+84')) return '0' + cleaned.slice(3);
  if (cleaned.startsWith('84') && cleaned.length === 11) return '0' + cleaned.slice(2);
  return cleaned;
}

/**
 * Validate định dạng SĐT Việt Nam
 * @param {string} phone
 * @returns {boolean}
 */
function isValidVietnamesePhone(phone) {
  return /^(0)(3[2-9]|5[6-9]|7[06-9]|8[0-9]|9[0-9])[0-9]{7}$/.test(phone);
}

// ─── STEP 1: Gửi OTP ─────────────────────────────────────────────────────────

/**
 * Tạo OTP, lưu DB và gửi SMS cho user
 *
 * Bảo mật:
 *  - OTP được hash trước khi lưu DB (tương tự password)
 *  - Dùng findOneAndUpdate + upsert để đảm bảo mỗi SĐT chỉ có 1 OTP tại 1 thời điểm
 *    (Gửi lại OTP sẽ ghi đè OTP cũ → tự động vô hiệu hóa OTP cũ)
 *
 * @param {string} rawPhone - SĐT từ request body
 * @returns {{ message: string }}
 */
async function sendOTP(rawPhone) {
  const phone = normalizePhone(rawPhone);

  if (!isValidVietnamesePhone(phone)) {
    const error = new Error('Số điện thoại không hợp lệ. Vui lòng nhập SĐT Việt Nam hợp lệ.');
    error.statusCode = 400;
    throw error;
  }

  // Tạo OTP và hash
  const otp      = generateOTP();
  const otpHash  = await bcrypt.hash(otp, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Upsert: tạo mới hoặc ghi đè OTP cũ của cùng SĐT
  // Điều này tự động vô hiệu OTP cũ nếu user bấm "Gửi lại"
  await OTP.findOneAndUpdate(
    { phone },
    {
      phone,
      otpHash,
      expiresAt,
      attempts: 0,       // Reset số lần sai
      isLocked: false,   // Mở khóa nếu trước đó bị khóa
      createdAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Gửi SMS (mock hoặc real tùy SMS_PROVIDER trong .env)
  await smsService.send(phone, otp);

  // Trả về response chung cho cả SĐT mới lẫn cũ
  // (Không tiết lộ user đã tồn tại hay chưa — chống enumeration attack)
  return {
    message: `Mã OTP đã được gửi tới ${phone.slice(0, 4)}****${phone.slice(-3)}. Có hiệu lực trong ${OTP_EXPIRY_MINUTES} phút.`,
    expiresInMinutes: OTP_EXPIRY_MINUTES,
  };
}

// ─── STEP 2: Xác thực OTP + Cấp Token ────────────────────────────────────────

/**
 * Xác thực OTP và tạo/đăng nhập user
 *
 * @param {string} rawPhone - SĐT từ request body
 * @param {string} otp      - Mã OTP 6 số từ user
 * @returns {{ accessToken, refreshToken, user }}
 */
async function verifyOTP(rawPhone, otp) {
  const phone = normalizePhone(rawPhone);

  if (!isValidVietnamesePhone(phone)) {
    const error = new Error('Số điện thoại không hợp lệ.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Tìm OTP record trong DB
  const otpRecord = await OTP.findOne({ phone });

  if (!otpRecord) {
    const error = new Error('Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng yêu cầu mã mới.');
    error.statusCode = 400;
    throw error;
  }

  // 2. Kiểm tra OTP có bị khóa không (nhập sai quá nhiều lần)
  if (otpRecord.isLocked) {
    const error = new Error(`OTP đã bị khóa do nhập sai quá ${OTP_MAX_ATTEMPTS} lần. Vui lòng yêu cầu mã mới.`);
    error.statusCode = 429;
    throw error;
  }

  // 3. Kiểm tra OTP có hết hạn không
  if (new Date() > otpRecord.expiresAt) {
    await OTP.deleteOne({ phone }); // Dọn dẹp record hết hạn
    const error = new Error('Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.');
    error.statusCode = 400;
    throw error;
  }

  // 4. So sánh OTP với hash (bcrypt compare)
  const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);

  if (!isMatch) {
    // Tăng số lần sai
    const newAttempts = otpRecord.attempts + 1;
    const shouldLock  = newAttempts >= OTP_MAX_ATTEMPTS;

    await OTP.findOneAndUpdate(
      { phone },
      { attempts: newAttempts, isLocked: shouldLock }
    );

    const remainingAttempts = OTP_MAX_ATTEMPTS - newAttempts;
    const errorMsg = shouldLock
      ? `OTP sai. OTP đã bị khóa do nhập sai ${OTP_MAX_ATTEMPTS} lần. Vui lòng yêu cầu mã mới.`
      : `OTP không đúng. Bạn còn ${remainingAttempts} lần thử.`;

    const error = new Error(errorMsg);
    error.statusCode = 400;
    throw error;
  }

  // 5. OTP hợp lệ → Xóa ngay để không thể dùng lại (Replay attack prevention)
  await OTP.deleteOne({ phone });

  // 6. Tìm user theo SĐT hoặc tạo mới nếu chưa có
  let user = await User.findOne({ phone });
  let isNewUser = false;

  if (!user) {
    // User mới — đăng ký lần đầu qua OTP
    user = await User.create({
      phone,
      name:            `Khách ${phone.slice(0, 4)}****${phone.slice(-3)}`,
      isPhoneVerified: true,
      role:            'customer',
    });
    isNewUser = true;
  } else {
    // User đã tồn tại — cập nhật trạng thái verified
    if (!user.isPhoneVerified) {
      user.isPhoneVerified = true;
      await user.save();
    }
  }

  // 7. Kiểm tra tài khoản có bị khóa không
  if (!user.isActive) {
    const error = new Error('Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ.');
    error.statusCode = 403;
    throw error;
  }

  // 8. Cấp JWT Access Token
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );

  // 9. Cấp JWT Refresh Token
  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );

  return {
    accessToken,
    refreshToken,
    isNewUser,
    user: {
      _id:             user._id,
      name:            user.name,
      phone:           user.phone,
      email:           user.email,
      role:            user.role,
      isPhoneVerified: user.isPhoneVerified,
      address:         user.address,
      createdAt:       user.createdAt,
    },
  };
}

module.exports = { sendOTP, verifyOTP, normalizePhone, isValidVietnamesePhone };
