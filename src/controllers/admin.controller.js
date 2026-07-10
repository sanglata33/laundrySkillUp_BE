/**
 * controllers/admin.controller.js — Xử lý HTTP request cho Admin/Staff Module
 *
 * Routes được phục vụ:
 *  GET    /api/admin/dashboard              → getDashboard
 *  GET    /api/admin/orders                 → getAllOrders
 *  GET    /api/admin/orders/:id             → getOrderDetail
 *  PATCH  /api/admin/orders/:id/status      → updateOrderStatus
 *  PUT    /api/admin/orders/:id/assign      → assignStaff
 *  POST   /api/admin/orders/:id/staff-notes → addStaffNote
 *  PUT    /api/admin/orders/:id/admin-note  → updateAdminNote (chỉ admin)
 *  GET    /api/admin/staff                  → getStaffList
 */

const adminService  = require('../services/admin.service');
const orderService  = require('../services/order.service');
const ApiResponse   = require('../utils/ApiResponse');
const { ORDER_STATUS_VALUES, isValidStatus } = require('../constants/orderStatus');


// ─── Dashboard ───────────────────────────────────────────────────────────────

/**
 * GET /api/admin/dashboard
 * Thống kê tổng quan cho Admin dashboard
 */
const getDashboard = async (req, res, next) => {
  try {
    const stats = await adminService.getDashboardStats();
    return ApiResponse.success(res, 200, 'Lấy thống kê dashboard thành công', stats);
  } catch (err) {
    next(err);
  }
};

// ─── Quản lý đơn hàng ────────────────────────────────────────────────────────

/**
 * GET /api/admin/orders
 * Lấy toàn bộ đơn hàng với filter nâng cao
 *
 * Query params:
 *  - status    : received | washing | drying | delivering | completed | cancelled
 *                (có thể nhiều giá trị cách nhau dấu phẩy: ?status=washing,drying)
 *  - dateFrom  : ISO date string (2024-01-01)
 *  - dateTo    : ISO date string (2024-12-31)
 *  - search    : tìm theo orderCode
 *  - staffId   : lọc theo nhân viên
 *  - page      : số trang (mặc định 1)
 *  - limit     : số record/trang (mặc định 20)
 *  - sortBy    : createdAt | totalPrice | status
 *  - sortOrder : asc | desc
 */
const getAllOrders = async (req, res, next) => {
  try {
    const result = await adminService.getAllOrdersAdmin(req.query);

    return ApiResponse.success(
      res,
      200,
      'Lấy danh sách đơn hàng thành công',
      { orders: result.orders },
      {
        total:      result.total,
        page:       result.page,
        limit:      result.limit,
        totalPages: result.totalPages,
      }
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/orders/:id
 * Chi tiết đơn hàng — bao gồm đầy đủ thông tin khách, ảnh, ghi chú, lịch sử
 */
const getOrderDetail = async (req, res, next) => {
  try {
    const { order, images } = await adminService.getOrderDetailAdmin(req.params.id);
    return ApiResponse.success(res, 200, 'Lấy chi tiết đơn hàng thành công', { order, images });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/orders/:id/status
 * Cập nhật trạng thái đơn hàng
 *
 * Body: { status: string, note?: string }
 *
 * Validation:
 *  - status phải là một trong ORDER_STATUS_VALUES
 *  - Luồng chuyển trạng thái phải hợp lệ (kiểm tra trong order.service)
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;

    if (!status) {
      return ApiResponse.error(res, 400, 'Vui lòng cung cấp trạng thái mới (status)');
    }

    // Kiểm tra trạng thái hợp lệ trước khi gọi service
    if (!isValidStatus(status)) {
      return ApiResponse.error(
        res,
        400,
        `Trạng thái "${status}" không hợp lệ. Các giá trị được phép: ${ORDER_STATUS_VALUES.join(', ')}`
      );
    }

    const order = await orderService.updateOrderStatus(
      req.params.id,
      status,
      note || '',
      req.user
    );

    return ApiResponse.success(
      res,
      200,
      `Cập nhật trạng thái đơn hàng thành công → "${status}"`,
      { order }
    );
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/orders/:id/assign
 * Phân công nhân viên cho đơn hàng (chỉ Admin)
 *
 * Body: { staffId: string }
 */
const assignStaff = async (req, res, next) => {
  try {
    const { staffId } = req.body;

    if (!staffId) {
      return ApiResponse.error(res, 400, 'Vui lòng cung cấp staffId');
    }

    const order = await orderService.assignStaff(req.params.id, staffId);
    return ApiResponse.success(res, 200, 'Phân công nhân viên thành công', { order });
  } catch (err) {
    next(err);
  }
};

// ─── Ghi chú ─────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/orders/:id/staff-notes
 * Thêm ghi chú nhân viên vào đơn hàng
 * Ghi chú được append (không xóa ghi chú cũ)
 *
 * Body: { content: string }
 *
 * Ví dụ ghi chú:
 *  - "Áo sơ mi bị ố vàng nhẹ, đã dùng tẩy chuyên dụng"
 *  - "Khách hẹn giao sau 5h chiều"
 *  - "Quần jean màu đậm, giặt riêng"
 */
const addStaffNote = async (req, res, next) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return ApiResponse.error(res, 400, 'Vui lòng nhập nội dung ghi chú');
    }

    const order = await adminService.addStaffNote(req.params.id, content, req.user);
    return ApiResponse.success(res, 201, 'Thêm ghi chú thành công', {
      staffNotes: order.staffNotes,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/orders/:id/admin-note
 * Cập nhật ghi chú admin (overwrite — chỉ 1 ghi chú tại 1 thời điểm)
 * Chỉ Admin mới được dùng endpoint này.
 *
 * Body: { adminNote: string }  (truyền rỗng "" để xóa ghi chú)
 *
 * Ví dụ:
 *  - "VIP customer — ưu tiên xử lý"
 *  - "Đã xác nhận qua điện thoại lúc 10h sáng"
 */
const updateAdminNote = async (req, res, next) => {
  try {
    const { adminNote } = req.body;

    // adminNote có thể là chuỗi rỗng (để xóa ghi chú) → không validate required
    if (adminNote === undefined) {
      return ApiResponse.error(res, 400, 'Vui lòng cung cấp trường adminNote (có thể là chuỗi rỗng để xóa)');
    }

    const order = await adminService.updateAdminNote(req.params.id, adminNote);
    return ApiResponse.success(res, 200, 'Cập nhật ghi chú admin thành công', {
      adminNote: order.adminNote,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Quản lý nhân viên ───────────────────────────────────────────────────────

/**
 * GET /api/admin/staff
 * Lấy danh sách nhân viên đang hoạt động (để phân công đơn hàng)
 *
 * Query params:
 *  - search : tìm theo tên / email / SĐT
 *  - page   : số trang
 *  - limit  : số record/trang
 */
const getStaffList = async (req, res, next) => {
  try {
    const result = await adminService.getStaffList(req.query);
    return ApiResponse.success(
      res,
      200,
      'Lấy danh sách nhân viên thành công',
      { staff: result.staff },
      { total: result.total, page: result.page, totalPages: result.totalPages }
    );
  } catch (err) {
    next(err);
  }
};

// ─── Quản lý người dùng (Admin only) ────────────────────────────────────────────────

/**
 * GET /api/admin/users
 * Lấy danh sách tất cả người dùng
 * Query: ?role=customer&search=Nguyễn&page=1&limit=20
 */
const getUserList = async (req, res, next) => {
  try {
    const result = await adminService.getAllUsers(req.query);
    return ApiResponse.success(
      res,
      200,
      'Lấy danh sách người dùng thành công',
      { users: result.users },
      { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages }
    );
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/users/:id/role
 * Cấp/thu hồi quyền cho tài khoản
 * Body: { role: "admin" | "staff" | "customer" }
 */
const updateUserRoleHandler = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!role) {
      return ApiResponse.error(res, 400, 'Vui lòng cung cấp vai trò mới (role)');
    }
    const user = await adminService.updateUserRole(req.params.id, role, req.user);
    return ApiResponse.success(res, 200, `Cập nhật vai trò thành công → "${role}"`, { user });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/users/:id/status
 * Khóa hoặc mở khóa tài khoản
 * Body: { isActive: true | false }
 */
const updateUserStatusHandler = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (isActive === undefined) {
      return ApiResponse.error(res, 400, 'Vui lòng cung cấp trạng thái (isActive)');
    }
    const user = await adminService.updateUserStatus(req.params.id, Boolean(isActive), req.user);
    const statusText = isActive ? 'Mở khóa' : 'Khóa';
    return ApiResponse.success(res, 200, `${statusText} tài khoản thành công`, { user });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboard,
  getAllOrders,
  getOrderDetail,
  updateOrderStatus,
  assignStaff,
  addStaffNote,
  updateAdminNote,
  getStaffList,
  getUserList,
  updateUserRoleHandler,
  updateUserStatusHandler,
};
