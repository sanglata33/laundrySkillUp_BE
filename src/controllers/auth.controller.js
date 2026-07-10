/**
 * controllers/auth.controller.js — Xử lý HTTP request cho Auth (v3)
 *
 * Thêm:
 *  - refresh-token endpoint
 *  - logout endpoint
 *  - send-otp endpoint (SĐT + OTP)
 *  - verify-otp endpoint (xác thực OTP + cấp Token)
 */

const authService = require('../services/auth.service');
const otpService  = require('../services/otp.service');
const ApiResponse = require('../utils/ApiResponse');

/** POST /api/auth/register */
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, address } = req.body;
    const user = await authService.register({ name, email, password, phone, address });
    // Sau đăng ký, tự đăng nhập luôn để FE nhận token
    const result = await authService.login(email, password, res);
    return ApiResponse.created(res, 'Đăng ký thành công', result);
  } catch (err) {
    next(err);
  }
};

/** POST /api/auth/login */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return ApiResponse.error(res, 400, 'Vui lòng nhập email và mật khẩu');
    }
    const result = await authService.login(email, password, res);
    return ApiResponse.success(res, 200, 'Đăng nhập thành công', result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh-token
 * FE gọi khi access token hết hạn
 * Cookie refreshToken được gửi tự động bởi browser
 *
 * Response: { accessToken: "..." }
 */
const refreshToken = async (req, res, next) => {
  try {
    const result = await authService.refreshAccessToken(req);
    return ApiResponse.success(res, 200, 'Cấp lại access token thành công', {
      accessToken: result.accessToken,
      user:        result.user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Xóa refresh token cookie
 */
const logout = (req, res) => {
  authService.logout(res);
  return ApiResponse.success(res, 200, 'Đăng xuất thành công');
};

/** GET /api/auth/me */
const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user._id);
    return ApiResponse.success(res, 200, 'Lấy thông tin thành công', { user });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/auth/me */
const updateProfile = async (req, res, next) => {
  try {
    const user = await authService.updateProfile(req.user._id, req.body);
    return ApiResponse.success(res, 200, 'Cập nhật thành công', { user });
  } catch (err) {
    next(err);
  }
};

// ─── OTP Authentication (v3) ──────────────────────────────────────────────────────────

/**
 * POST /api/auth/send-otp
 * Bước 1: Nhập SĐT → server kiểm tra và gửi OTP
 *
 * Body: { phone: "0912345678" }
 * Response: 200 OK với message xác nhận
 */
const sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return ApiResponse.error(res, 400, 'Vui lòng nhập số điện thoại');
    }

    const result = await otpService.sendOTP(phone);
    return ApiResponse.success(res, 200, result.message, {
      expiresInMinutes: result.expiresInMinutes,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/verify-otp
 * Bước 2: Nhập mã OTP → server xác thực → tạo/đăng nhập user → cấp JWT
 *
 * Body: { phone: "0912345678", otp: "123456" }
 * Response: 200 OK với accessToken và thông tin user
 *
 * Thêm refreshToken vào HttpOnly cookie (giống login bằng email)
 */
const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return ApiResponse.error(res, 400, 'Vui lòng nhập số điện thoại và mã OTP');
    }

    const result = await otpService.verifyOTP(phone, otp);

    // Đặt Refresh Token vào HttpOnly cookie (bảo mật hơn localStorage)
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 ngày (ms)
    });

    const statusCode = result.isNewUser ? 201 : 200;
    const message    = result.isNewUser
      ? 'Đăng ký thành công! Chào mừng bạn đến với LaundryApp.'
      : 'Đăng nhập thành công!';

    return res.status(statusCode).json({
      success:     true,
      message,
      data: {
        accessToken: result.accessToken,
        user:        result.user,
        isNewUser:   result.isNewUser,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refreshToken, logout, getMe, updateProfile, sendOtp, verifyOtp };
