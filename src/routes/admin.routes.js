/**
 * routes/admin.routes.js — Routes dành riêng cho Admin/Staff
 *
 * Base path: /api/admin
 *
 * Phân quyền theo từng route:
 * ┌────────────────────────────────────────┬─────────────────────────────┐
 * │ Route                                  │ Quyền                       │
 * ├────────────────────────────────────────┼─────────────────────────────┤
 * │ GET  /dashboard                        │ admin, staff                │
 * │ GET  /orders                           │ admin, staff                │
 * │ GET  /orders/:id                       │ admin, staff                │
 * │ PATCH /orders/:id/status               │ admin, staff                │
 * │ POST /orders/:id/staff-notes           │ admin, staff                │
 * │ PUT  /orders/:id/assign                │ admin only                  │
 * │ PUT  /orders/:id/admin-note            │ admin only                  │
 * │ GET  /staff                            │ admin only                  │
 * └────────────────────────────────────────┴─────────────────────────────┘
 *
 * Tất cả routes đều đi qua:
 *  1. protect     — Kiểm tra JWT hợp lệ
 *  2. checkRole   — Kiểm tra role (admin hoặc staff)
 */

const express = require('express');
const router  = express.Router();

const adminController       = require('../controllers/admin.controller');
const { protect }           = require('../middlewares/auth.middleware');
const { checkRole }         = require('../middlewares/role.middleware');

// ─── Áp dụng protect + checkRole(['admin','staff']) cho toàn bộ admin routes ──
// Bất kỳ request nào không phải admin/staff sẽ bị chặn tại đây với 401/403
router.use(protect);
router.use(checkRole(['admin', 'staff']));

// ─── Dashboard ────────────────────────────────────────────────────────────────
/**
 * GET /api/admin/dashboard
 * Thống kê tổng quan: đơn hôm nay, đơn theo trạng thái, doanh thu tháng...
 */
router.get('/dashboard', adminController.getDashboard);

// ─── Quản lý đơn hàng ────────────────────────────────────────────────────────

/**
 * GET /api/admin/orders
 * Danh sách tất cả đơn hàng với filter nâng cao.
 * Query: ?status=washing&dateFrom=2024-01-01&dateTo=2024-12-31&search=LD-&page=1&limit=20
 */
router.get('/orders', adminController.getAllOrders);

/**
 * GET /api/admin/orders/:id
 * Chi tiết đơn hàng — đầy đủ thông tin khách, ảnh, ghi chú, lịch sử trạng thái
 */
router.get('/orders/:id', adminController.getOrderDetail);

/**
 * PATCH /api/admin/orders/:id/status
 * Cập nhật trạng thái đơn hàng.
 * Body: { status: "washing", note: "Bắt đầu giặt" }
 *
 * Chú ý: Dùng PATCH (không phải PUT) vì chỉ cập nhật 1 field status.
 */
router.patch('/orders/:id/status', adminController.updateOrderStatus);

/**
 * POST /api/admin/orders/:id/staff-notes
 * Thêm ghi chú nhân viên (append — không xóa ghi chú cũ).
 * Body: { content: "Áo sơ mi bị ố vàng nhẹ" }
 */
router.post('/orders/:id/staff-notes', adminController.addStaffNote);

// ─── Routes chỉ dành cho Admin (checkRole(['admin'])) ─────────────────────────

/**
 * PUT /api/admin/orders/:id/assign
 * Phân công nhân viên cho đơn hàng.
 * Body: { staffId: "..." }
 * [Chỉ Admin]
 */
router.put(
  '/orders/:id/assign',
  checkRole(['admin']), // Ghi đè: chỉ admin mới phân công được
  adminController.assignStaff
);

/**
 * PUT /api/admin/orders/:id/admin-note
 * Cập nhật ghi chú admin (overwrite).
 * Body: { adminNote: "VIP customer — ưu tiên xử lý" }
 * [Chỉ Admin]
 */
router.put(
  '/orders/:id/admin-note',
  checkRole(['admin']), // Ghi đè: chỉ admin mới ghi chú được
  adminController.updateAdminNote
);

/**
 * GET /api/admin/staff
 * Danh sách nhân viên (để phân công).
 * Query: ?search=Nguyễn&page=1&limit=50
 * [Chỉ Admin]
 */
router.get(
  '/staff',
  checkRole(['admin']), // Chỉ admin mới xem được danh sách nhân viên
  adminController.getStaffList
);

// ─── Quản lý tài khoản (Admin only) ───────────────────────────────────────────

/**
 * GET /api/admin/users
 * Lấy danh sách tất cả người dùng trong hệ thống.
 * Query: ?role=customer&search=Nguyễn&page=1&limit=20
 * [Chỉ Admin]
 */
router.get(
  '/users',
  checkRole(['admin']),
  adminController.getUserList
);

/**
 * PATCH /api/admin/users/:id/role
 * Cấp hoặc thu hồi quyền của tài khoản.
 * Body: { role: "admin" | "staff" | "customer" }
 * [Chỉ Admin]
 */
router.patch(
  '/users/:id/role',
  checkRole(['admin']),
  adminController.updateUserRoleHandler
);

/**
 * PATCH /api/admin/users/:id/status
 * Khóa hoặc mở khóa tài khoản.
 * Body: { isActive: true | false }
 * [Chỉ Admin]
 */
router.patch(
  '/users/:id/status',
  checkRole(['admin']),
  adminController.updateUserStatusHandler
);

module.exports = router;
