/**
 * routes/order.routes.js — Định nghĩa routes đơn hàng
 *
 * Phân quyền:
 *  - customer : tạo đơn, xem đơn của mình, hủy đơn (khi status = received)
 *  - staff    : xem tất cả đơn, cập nhật trạng thái, upload ảnh
 *  - admin    : tất cả quyền trên + phân công nhân viên
 */

const express = require('express');
const router  = express.Router();

const orderController           = require('../controllers/order.controller');
const { protect }               = require('../middlewares/auth.middleware');
const { restrictTo }            = require('../middlewares/role.middleware');
const { handleCloudUpload }     = require('../config/cloudinary');

// Tất cả routes đều cần đăng nhập
router.use(protect);

// ── Danh sách & tạo đơn ─────────────────────────────────────────────────────
router
  .route('/')
  .get(orderController.getAllOrders)          // Admin/Staff: tất cả | Customer: của mình
  .post(orderController.createOrder);         // Customer tạo đơn

// ── Chi tiết & hủy đơn ──────────────────────────────────────────────────────
router
  .route('/:id')
  .get(orderController.getOrderById)          // Xem chi tiết
  .delete(orderController.cancelOrder);       // Hủy đơn

// ── Cập nhật trạng thái (staff và admin) ────────────────────────────────────
router.put(
  '/:id/status',
  restrictTo('admin', 'staff'),
  orderController.updateOrderStatus
);

// ── Upload ảnh nhận/giao đồ (staff và admin) ────────────────────────────────
router.post(
  '/:id/images',
  restrictTo('admin', 'staff'),
  handleCloudUpload,                          // Cloudinary (cloud) hoặc local (dev fallback)
  orderController.uploadOrderImages
);

// ── Phân công nhân viên (chỉ admin) ─────────────────────────────────────────
router.put(
  '/:id/assign',
  restrictTo('admin'),
  orderController.assignStaff
);

module.exports = router;
