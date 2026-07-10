/**
 * services/admin.service.js — Business logic dành riêng cho Admin/Staff
 *
 * Các chức năng:
 *  1. Dashboard stats — thống kê tổng quan
 *  2. Lấy danh sách đơn với filter nâng cao (date range, search customer)
 *  3. Thêm ghi chú nhân viên vào đơn hàng
 *  4. Cập nhật ghi chú admin
 *  5. Lấy danh sách nhân viên (để phân công)
 *
 * Lưu ý: Các hàm cập nhật trạng thái (updateOrderStatus) và phân công (assignStaff)
 * tái sử dụng trực tiếp từ order.service.js — không duplicate code.
 */

const mongoose  = require('mongoose');
const Order     = require('../models/Order.model');
const User      = require('../models/User.model');
const AppError  = require('../utils/AppError');
const { ORDER_STATUS, ORDER_STATUS_VALUES, ORDER_STATUS_LABELS, isValidStatus } = require('../constants/orderStatus');

// ─── 1. Dashboard Statistics ─────────────────────────────────────────────────

/**
 * Lấy thống kê tổng quan cho Admin dashboard
 *
 * Trả về:
 *  - Tổng đơn hôm nay
 *  - Số đơn theo từng trạng thái
 *  - Doanh thu tháng này (completed orders)
 *  - Doanh thu tháng trước (để so sánh)
 *  - Top 5 dịch vụ phổ biến nhất
 *  - Số nhân viên đang hoạt động
 *
 * @returns {object} Stats object
 */
const getDashboardStats = async () => {
  const now       = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd   = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Đầu/cuối tháng hiện tại
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Đầu/cuối tháng trước
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Chạy tất cả queries song song để tối ưu performance
  const [
    todayOrders,
    statusCounts,
    thisMonthRevenue,
    lastMonthRevenue,
    topServices,
    activeStaffCount,
    recentOrders,
  ] = await Promise.all([
    // Tổng đơn hôm nay
    Order.countDocuments({ createdAt: { $gte: todayStart, $lt: todayEnd } }),

    // Đếm đơn theo từng trạng thái
    Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Doanh thu tháng này (chỉ đơn completed)
    Order.aggregate([
      {
        $match: {
          status:      ORDER_STATUS.COMPLETED,
          completedAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
    ]),

    // Doanh thu tháng trước
    Order.aggregate([
      {
        $match: {
          status:      ORDER_STATUS.COMPLETED,
          completedAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
    ]),

    // Top 5 dịch vụ phổ biến nhất
    Order.aggregate([
      { $match: { status: { $ne: ORDER_STATUS.CANCELLED } } },
      { $group: { _id: '$service', orderCount: { $sum: 1 }, revenue: { $sum: '$totalPrice' } } },
      { $sort: { orderCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from:         'services',
          localField:   '_id',
          foreignField: '_id',
          as:           'service',
        },
      },
      { $unwind: '$service' },
      { $project: { name: '$service.name', orderCount: 1, revenue: 1 } },
    ]),

    // Số nhân viên đang hoạt động
    User.countDocuments({ role: 'staff', isActive: true }),

    // 5 đơn gần nhất
    Order.find()
      .populate('customer', 'name phone')
      .populate('service',  'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderCode status totalPrice createdAt customer service'),
  ]);

  // Format statusCounts thành object dễ đọc
  const statusMap = {};
  ORDER_STATUS_VALUES.forEach((s) => { statusMap[s] = 0; });
  statusCounts.forEach(({ _id, count }) => { statusMap[_id] = count; });

  // Tính % thay đổi doanh thu so với tháng trước
  const thisRevenue = thisMonthRevenue[0]?.total || 0;
  const lastRevenue = lastMonthRevenue[0]?.total || 0;
  const revenueChange = lastRevenue === 0
    ? 100
    : Math.round(((thisRevenue - lastRevenue) / lastRevenue) * 100);

  // Đơn đang xử lý (chưa hoàn thành, chưa hủy)
  const activeOrders = (statusMap[ORDER_STATUS.RECEIVED] || 0)
    + (statusMap[ORDER_STATUS.WASHING]    || 0)
    + (statusMap[ORDER_STATUS.DRYING]     || 0)
    + (statusMap[ORDER_STATUS.DELIVERING] || 0);

  return {
    overview: {
      todayOrders,
      activeOrders,
      activeStaffCount,
    },
    revenue: {
      thisMonth:    thisRevenue,
      lastMonth:    lastRevenue,
      changePercent: revenueChange,
      thisMonthCompletedCount: thisMonthRevenue[0]?.count || 0,
    },
    ordersByStatus: ORDER_STATUS_VALUES.map((status) => ({
      status,
      label: ORDER_STATUS_LABELS[status],
      count: statusMap[status] || 0,
    })),
    topServices,
    recentOrders,
  };
};

// ─── 2. Lấy danh sách đơn hàng (Admin — Filter nâng cao) ─────────────────────

/**
 * Lấy toàn bộ đơn hàng với filter nâng cao dành cho Admin/Staff
 *
 * Query params hỗ trợ:
 *  - status    : lọc theo trạng thái (received, washing, ...)
 *  - dateFrom  : từ ngày (ISO string)
 *  - dateTo    : đến ngày (ISO string)
 *  - search    : tìm theo mã đơn (orderCode) hoặc SĐT/tên khách
 *  - staffId   : lọc theo nhân viên xử lý
 *  - page      : trang hiện tại (mặc định: 1)
 *  - limit     : số đơn mỗi trang (mặc định: 20)
 *  - sortBy    : createdAt | totalPrice | status (mặc định: createdAt)
 *  - sortOrder : asc | desc (mặc định: desc)
 *
 * @param {object} queryParams
 * @returns {{ orders, total, page, totalPages }}
 */
const getAllOrdersAdmin = async (queryParams = {}) => {
  const {
    status,
    dateFrom,
    dateTo,
    search,
    staffId,
    page      = 1,
    limit     = 20,
    sortBy    = 'createdAt',
    sortOrder = 'desc',
  } = queryParams;

  // ── Xây dựng filter ──────────────────────────────────────────────────────
  const filter = {};

  // Lọc theo trạng thái (có thể truyền nhiều: ?status=washing,drying)
  if (status) {
    const statusList = status.split(',').map((s) => s.trim());
    const invalidStatuses = statusList.filter((s) => !isValidStatus(s));
    if (invalidStatuses.length > 0) {
      throw new AppError(
        `Trạng thái không hợp lệ: ${invalidStatuses.join(', ')}. ` +
        `Các giá trị hợp lệ: ${ORDER_STATUS_VALUES.join(', ')}`,
        400
      );
    }
    filter.status = statusList.length === 1 ? statusList[0] : { $in: statusList };
  }

  // Lọc theo khoảng ngày tạo đơn
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo)   filter.createdAt.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
  }

  // Lọc theo nhân viên phụ trách
  if (staffId) {
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      throw new AppError('staffId không hợp lệ', 400);
    }
    filter.staff = staffId;
  }

  // ── Tìm kiếm theo orderCode (không cần join) ─────────────────────────────
  if (search) {
    // Regex case-insensitive cho orderCode
    filter.$or = [
      { orderCode: { $regex: search, $options: 'i' } },
    ];
  }

  const skip      = (parseInt(page) - 1) * parseInt(limit);
  const sortField = ['createdAt', 'totalPrice', 'status'].includes(sortBy) ? sortBy : 'createdAt';
  const sortDir   = sortOrder === 'asc' ? 1 : -1;

  // Chạy song song để tối ưu
  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .populate('customer', 'name email phone address')
      .populate('staff',    'name email phone')
      .populate('service',  'name priceType price')
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-statusHistory -staffNotes'), // Bỏ field nặng ở list view
  ]);

  return {
    orders,
    total,
    page:       parseInt(page),
    limit:      parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit)),
  };
};

// ─── 3. Chi tiết đơn hàng (Admin — đầy đủ tất cả fields) ─────────────────────

/**
 * Lấy chi tiết đơn hàng cho admin (bao gồm staffNotes, statusHistory đầy đủ)
 *
 * @param {string} orderId
 * @returns {{ order, images }}
 */
const getOrderDetailAdmin = async (orderId) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new AppError('ID đơn hàng không hợp lệ', 400);
  }

  // Import OrderImage ở đây để tránh circular dependency
  const OrderImage = require('../models/OrderImage.model');

  const [order, images] = await Promise.all([
    Order.findById(orderId)
      .populate('customer',                  'name email phone address createdAt')
      .populate('staff',                     'name email phone role')
      .populate('service',                   'name description priceType price estimatedHours')
      .populate('statusHistory.updatedBy',   'name role')
      .populate('staffNotes.createdBy',      'name role'),

    OrderImage.find({ order: orderId })
      .populate('uploadedBy', 'name role')
      .sort({ createdAt: 1 }),
  ]);

  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

  return { order, images };
};

// ─── 4. Ghi chú nhân viên ────────────────────────────────────────────────────

/**
 * Thêm ghi chú nhân viên vào đơn hàng
 * Ghi chú được append vào mảng staffNotes — không bao giờ xóa ghi chú cũ.
 *
 * @param {string} orderId
 * @param {string} content  - Nội dung ghi chú
 * @param {User}   staff    - Nhân viên ghi chú
 * @returns {Order}
 */
const addStaffNote = async (orderId, content, staff) => {
  if (!content || content.trim().length === 0) {
    throw new AppError('Nội dung ghi chú không được để trống', 400);
  }
  if (content.length > 500) {
    throw new AppError('Ghi chú không được quá 500 ký tự', 400);
  }

  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

  // Append ghi chú mới (không xóa ghi chú cũ)
  order.staffNotes.push({
    content:   content.trim(),
    createdBy: staff._id,
    createdAt: new Date(),
  });

  await order.save();
  await order.populate('staffNotes.createdBy', 'name role');

  return order;
};

// ─── 5. Ghi chú Admin ────────────────────────────────────────────────────────

/**
 * Cập nhật ghi chú admin của đơn hàng (overwrite — chỉ 1 ghi chú tại 1 thời điểm)
 *
 * @param {string} orderId
 * @param {string} adminNote - Nội dung ghi chú (truyền rỗng để xóa)
 * @returns {Order}
 */
const updateAdminNote = async (orderId, adminNote) => {
  if (adminNote && adminNote.length > 300) {
    throw new AppError('Ghi chú admin không được quá 300 ký tự', 400);
  }

  const order = await Order.findByIdAndUpdate(
    orderId,
    { adminNote: (adminNote || '').trim() },
    { new: true, runValidators: true }
  ).populate('customer', 'name phone')
   .populate('staff',    'name phone');

  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
  return order;
};

// ─── 6. Danh sách nhân viên ──────────────────────────────────────────────────

/**
 * Lấy danh sách nhân viên (để phân công đơn hàng)
 * Chỉ trả về staff đang hoạt động.
 *
 * @param {object} queryParams - { page, limit, search }
 * @returns {{ staff, total }}
 */
const getStaffList = async (queryParams = {}) => {
  const { page = 1, limit = 50, search } = queryParams;

  const filter = { role: 'staff', isActive: true };
  if (search) {
    filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const [total, staff] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select('name email phone role isActive createdAt')
      .sort({ name: 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit)),
  ]);

  return { staff, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
};

// ─── 7. Quản lý người dùng (Admin only) ────────────────────────────────────────────────────────────────────

/**
 * Lấy danh sách tất cả người dùng trong hệ thống (Admin only)
 *
 * Query params hỗ trợ:
 *  - role   : lọc theo vai trò (customer | staff | admin)
 *  - search : tìm theo tên / email / số điện thoại
 *  - page   : trang hiện tại (mặc định: 1)
 *  - limit  : số người dùng mỗi trang (mặc định: 20)
 *
 * @param {object} queryParams
 * @returns {{ users, total, page, totalPages }}
 */
const getAllUsers = async (queryParams = {}) => {
  const { role, search, page = 1, limit = 20 } = queryParams;

  const filter = {};

  if (role && ['customer', 'staff', 'admin'].includes(role)) {
    filter.role = role;
  }

  if (search) {
    filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select('name email phone role isActive isPhoneVerified createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
  ]);

  return {
    users,
    total,
    page:       parseInt(page),
    limit:      parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit)),
  };
};

/**
 * Cập nhật vai trò người dùng (Admin only)
 * Admin có thể cấp/thu hồi quyền: customer ↔ staff ↔ admin
 *
 * @param {string} targetUserId - ID của người dùng cần cập nhật
 * @param {string} newRole      - Vai trò mới (customer | staff | admin)
 * @param {User}   currentAdmin - Admin đang thực hiện (dùng để không tự thay đổi quyền mình)
 * @returns {User}
 */
const updateUserRole = async (targetUserId, newRole, currentAdmin) => {
  const VALID_ROLES = ['customer', 'staff', 'admin'];
  if (!VALID_ROLES.includes(newRole)) {
    throw new AppError(`Vai trò không hợp lệ. Chỉ chấp nhận: ${VALID_ROLES.join(', ')}`, 400);
  }

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new AppError('ID người dùng không hợp lệ', 400);
  }

  // Không cho admin tự đổi role của chính mình
  if (targetUserId.toString() === currentAdmin._id.toString()) {
    throw new AppError('Không thể thay đổi vai trò của chính mình', 400);
  }

  const user = await User.findByIdAndUpdate(
    targetUserId,
    { role: newRole },
    { new: true, runValidators: true }
  ).select('name email phone role isActive createdAt');

  if (!user) throw new AppError('Không tìm thấy người dùng', 404);
  return user;
};

/**
 * Cập nhật trạng thái hoạt động của người dùng (khóa/mở khóa)
 *
 * @param {string} targetUserId
 * @param {boolean} isActive
 * @param {User} currentAdmin
 * @returns {User}
 */
const updateUserStatus = async (targetUserId, isActive, currentAdmin) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new AppError('ID người dùng không hợp lệ', 400);
  }

  if (targetUserId.toString() === currentAdmin._id.toString()) {
    throw new AppError('Không thể thay đổi trạng thái của chính mình', 400);
  }

  const user = await User.findByIdAndUpdate(
    targetUserId,
    { isActive },
    { new: true }
  ).select('name email phone role isActive createdAt');

  if (!user) throw new AppError('Không tìm thấy người dùng', 404);
  return user;
};

module.exports = {
  getDashboardStats,
  getAllOrdersAdmin,
  getOrderDetailAdmin,
  addStaffNote,
  updateAdminNote,
  getStaffList,
  getAllUsers,
  updateUserRole,
  updateUserStatus,
};
