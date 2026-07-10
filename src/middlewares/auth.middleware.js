/**
 * middlewares/auth.middleware.js — Xác thực JWT
 *
 * Middleware này kiểm tra token JWT trong header Authorization.
 * Nếu hợp lệ, attach thông tin user vào req.user để các handler sau sử dụng.
 *
 * Cách dùng trong route:
 *   router.get('/me', protect, (req, res) => { ... })
 */

const jwt     = require('jsonwebtoken');
const User    = require('../models/User.model');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Middleware bảo vệ route — yêu cầu đăng nhập
 */
const protect = async (req, res, next) => {
  try {
    // 1. Lấy token từ header
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return ApiResponse.unauthorized(res, 'Vui lòng đăng nhập để tiếp tục');
    }

    // 2. Xác thực và giải mã token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return ApiResponse.unauthorized(res, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
      }
      return ApiResponse.unauthorized(res, 'Token không hợp lệ');
    }

    // 3. Kiểm tra user còn tồn tại trong DB không
    const currentUser = await User.findById(decoded.id).select('+password');
    if (!currentUser) {
      return ApiResponse.unauthorized(res, 'Tài khoản không còn tồn tại');
    }

    // 4. Kiểm tra tài khoản có bị khóa không
    if (!currentUser.isActive) {
      return ApiResponse.forbidden(res, 'Tài khoản đã bị vô hiệu hóa');
    }

    // 5. Kiểm tra mật khẩu có bị thay đổi sau khi token được cấp không
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return ApiResponse.unauthorized(res, 'Mật khẩu vừa thay đổi. Vui lòng đăng nhập lại');
    }

    // Attach user vào request để các middleware/handler sau sử dụng
    req.user = currentUser;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { protect };
