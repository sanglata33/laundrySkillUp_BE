/**
 * middlewares/role.middleware.js — Phân quyền (Authorization)
 *
 * Kiểm tra role của người dùng SAU KHI đã xác thực bằng `protect`.
 * Sử dụng closure để nhận danh sách roles được phép.
 *
 * Cách dùng trong route:
 *   // Syntax 1 — spread (cũ, vẫn hoạt động):
 *   router.delete('/:id', protect, restrictTo('admin'), handler)
 *
 *   // Syntax 2 — array (mới, dùng cho Admin module):
 *   router.get('/', protect, checkRole(['admin', 'staff']), handler)
 *
 *   // Admin và staff được phép:
 *   router.put('/:id/status', protect, restrictTo('admin', 'staff'), handler)
 */

const ApiResponse = require('../utils/ApiResponse');

/**
 * Middleware phân quyền theo role — Syntax cũ (spread args)
 * @param {...string} roles - Danh sách roles được phép truy cập
 * @returns {Function} Express middleware
 *
 * @example
 *   restrictTo('admin', 'staff')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    // req.user được set bởi protect middleware trước đó
    if (!req.user) {
      return ApiResponse.unauthorized(res);
    }

    if (!roles.includes(req.user.role)) {
      return ApiResponse.forbidden(
        res,
        `Chức năng này chỉ dành cho: ${roles.join(', ')}. Tài khoản của bạn là: ${req.user.role}`
      );
    }

    next();
  };
};

/**
 * Middleware phân quyền theo role — Syntax mới (array)
 * Alias của `restrictTo` nhưng nhận mảng roles thay vì spread args.
 * @param {string[]} roles - Mảng roles được phép truy cập
 * @returns {Function} Express middleware
 *
 * @example
 *   checkRole(['admin', 'staff'])
 *   checkRole(['admin'])
 */
const checkRole = (roles) => {
  if (!Array.isArray(roles)) {
    throw new TypeError('checkRole() yêu cầu tham số là một mảng. Ví dụ: checkRole(["admin", "staff"])');
  }
  // Tái sử dụng restrictTo bằng cách spread mảng
  return restrictTo(...roles);
};

module.exports = { restrictTo, checkRole };

