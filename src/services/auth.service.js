/**
 * services/auth.service.js — Business logic xác thực người dùng (v2)
 *
 * Cơ chế JWT:
 *  - Access Token:  Hết hạn sau 15 phút (lưu ở memory/localStorage FE)
 *  - Refresh Token: Hết hạn sau 7 ngày (lưu ở HttpOnly Cookie)
 *
 * Luồng FE:
 *  1. Đăng nhập → nhận access_token (body) + refresh_token (cookie)
 *  2. Gọi API: header "Authorization: Bearer <access_token>"
 *  3. Access token hết hạn → tự động gọi POST /api/auth/refresh-token
 *  4. BE đọc refresh_token từ cookie, cấp access_token mới
 *  5. Đăng xuất → gọi POST /api/auth/logout → BE xóa cookie
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const AppError = require('../utils/AppError');

// ─── Helper: Tạo Access Token (ngắn hạn) ────────────────────────────────────
const signAccessToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
};

// ─── Helper: Tạo Refresh Token (dài hạn) ────────────────────────────────────
const signRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
};

/**
 * Helper: Gửi cả 2 tokens về FE
 *  - Access Token: trong JSON response body (FE lưu vào memory)
 *  - Refresh Token: trong HttpOnly cookie (FE không đọc được → an toàn hơn)
 */
const sendTokens = (res, user) => {
  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  const isProduction = process.env.NODE_ENV === 'production';

  // Gửi Refresh Token qua HttpOnly Cookie
  // SameSite=none + Secure=true bắt buộc khi FE và BE khác domain (Vercel + Render)
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,                    // HTTPS only ở production
    sameSite: isProduction ? 'none' : 'lax', // 'none' cho phép cross-site, 'lax' cho local
    maxAge: 7 * 24 * 60 * 60 * 1000,        // 7 ngày (ms)
    path: '/api/auth',
  });

  return { user, accessToken };
};

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Đăng ký tài khoản mới
 */
const register = async (userData) => {
  const { name, email, password, phone, address } = userData;

  const existingUser = await User.findOne({ email });
  if (existingUser) throw new AppError('Email này đã được đăng ký', 400);

  const user = await User.create({ name, email, password, phone, address });
  return user;
};

/**
 * Đăng nhập — trả về user + accessToken
 * Refresh token được gắn vào cookie qua res
 */
const login = async (email, password, res) => {
  const user = await User.findOne({ email }).select('+password');

  if (!user || !user.isActive) {
    throw new AppError('Email hoặc mật khẩu không đúng', 401);
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new AppError('Email hoặc mật khẩu không đúng', 401);
  }

  return sendTokens(res, user);
};

/**
 * Refresh Access Token
 * Đọc refreshToken từ cookie, cấp accessToken mới
 */
const refreshAccessToken = async (req) => {
  const token = req.cookies?.refreshToken;

  if (!token) throw new AppError('Không tìm thấy refresh token', 401);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  } catch {
    throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại', 401);
  }

  if (decoded.type !== 'refresh') throw new AppError('Token type không hợp lệ', 401);

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) throw new AppError('Tài khoản không tồn tại', 401);

  const accessToken = signAccessToken(user._id);
  return { accessToken, user };
};

/**
 * Đăng xuất — xóa refresh token cookie
 */
const logout = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    expires: new Date(0), // H\u1ebft h\u1ea1n ngay l\u1eadp t\u1ee9c
    path: '/api/auth',
  });
};

/**
 * Lấy thông tin người dùng hiện tại
 */
const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('Không tìm thấy người dùng', 404);
  return user;
};

/**
 * Cập nhật thông tin cá nhân
 */
const updateProfile = async (userId, updateData) => {
  const { name, phone, address } = updateData;
  const user = await User.findByIdAndUpdate(
    userId,
    { name, phone, address },
    { new: true, runValidators: true }
  );
  if (!user) throw new AppError('Không tìm thấy người dùng', 404);
  return user;
};

module.exports = { register, login, refreshAccessToken, logout, getMe, updateProfile };
