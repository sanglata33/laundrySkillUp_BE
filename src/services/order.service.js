/**
 * services/order.service.js — Business logic quản lý đơn hàng
 *
 * Đây là file quan trọng nhất, xử lý toàn bộ luồng đơn hàng:
 *  - Tạo đơn, tính giá tự động
 *  - Cập nhật trạng thái với kiểm tra luồng hợp lệ
 *  - Upload ảnh nhận/giao đồ
 *  - Phân quyền xem đơn hàng (customer chỉ thấy đơn của mình)
 */

const Order                              = require('../models/Order.model');
const OrderImage                         = require('../models/OrderImage.model');
const Service                            = require('../models/Service.model');
const AppError                           = require('../utils/AppError');
const { emitOrderStatusUpdate, emitNewOrder } = require('../config/socket');
const { isValidTransition, VALID_TRANSITIONS } = require('../constants/orderStatus');


// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Lấy danh sách đơn hàng
 * - Admin/Staff: xem tất cả đơn, có thể lọc theo status
 * - Customer: chỉ xem đơn của mình
 *
 * @param {User} currentUser - Người dùng đang đăng nhập
 * @param {object} queryParams - { status, page, limit }
 * @returns {{ orders, total, page, totalPages }}
 */
const getAllOrders = async (currentUser, queryParams = {}) => {
  const { status, page = 1, limit = 10 } = queryParams;

  // Xây dựng filter dựa trên role
  const filter = {};
  if (currentUser.role === 'customer') {
    filter.customer = currentUser._id; // Customer chỉ thấy đơn của mình
  }
  if (status) {
    filter.status = status;
  }

  const skip  = (page - 1) * limit;
  const total = await Order.countDocuments(filter);

  const orders = await Order.find(filter)
    .populate('customer', 'name email phone')
    .populate('staff',    'name email phone')
    .populate('service',  'name priceType price')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Lấy tất cả ảnh xác thực của các đơn hàng này
  const orderIds = orders.map((o) => o._id);
  const allImages = await OrderImage.find({ order: { $in: orderIds } }).lean();

  // Đính kèm mảng images vào từng order
  const ordersWithImages = orders.map((order) => {
    const orderObj = order.toObject();
    orderObj.images = allImages.filter((img) => img.order.toString() === order._id.toString());
    return orderObj;
  });

  return {
    orders: ordersWithImages,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Lấy chi tiết đơn hàng theo ID
 * @param {string} orderId
 * @param {User} currentUser
 * @returns {Order}
 */
const getOrderById = async (orderId, currentUser) => {
  const order = await Order.findById(orderId)
    .populate('customer', 'name email phone address')
    .populate('staff',    'name email phone')
    .populate('service',  'name description priceType price estimatedHours');

  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

  // Customer chỉ được xem đơn của mình
  if (
    currentUser.role === 'customer' &&
    order.customer._id.toString() !== currentUser._id.toString()
  ) {
    throw new AppError('Bạn không có quyền xem đơn hàng này', 403);
  }

  // Lấy danh sách ảnh của đơn
  const images = await OrderImage.find({ order: orderId })
    .populate('uploadedBy', 'name role')
    .sort({ createdAt: 1 });

  return { order, images };
};

/**
 * Tạo đơn hàng mới
 * @param {object} orderData - { serviceId, quantity, pickupAddress, deliveryAddress, note, scheduledPickupTime }
 * @param {User} customer - Khách hàng tạo đơn
 * @returns {Order}
 */
const createOrder = async (orderData, customer) => {
  const { serviceId, quantity, pickupAddress, deliveryAddress, note, scheduledPickupTime, paymentMethod = 'cod' } = orderData;

  // Kiểm tra dịch vụ tồn tại và còn hoạt động
  const service = await Service.findById(serviceId);
  if (!service || !service.isActive) {
    throw new AppError('Dịch vụ không tồn tại hoặc đã ngừng hoạt động', 404);
  }

  // Tính tổng tiền tự động
  const totalPrice = service.price * quantity;

  const order = await Order.create({
    customer: customer._id,
    service: serviceId,
    quantity,
    totalPrice,
    pickupAddress,
    deliveryAddress,
    note,
    scheduledPickupTime,
    paymentMethod,
    paymentStatus: 'unpaid',
  });

  // Populate để trả về thông tin đầy đủ
  await order.populate('service', 'name priceType price estimatedHours');

  // Thông báo real-time tới staff dashboard
  // (io lấy từ app, được set trong server.js)
  try {
    const io = global._io;
    if (io) emitNewOrder(io, order);
  } catch (_) {}

  return order;
};

/**
 * Cập nhật trạng thái đơn hàng (Staff/Admin)
 * Có kiểm tra luồng trạng thái hợp lệ
 *
 * @param {string} orderId
 * @param {string} newStatus
 * @param {string} note - Ghi chú khi chuyển trạng thái
 * @param {User} updatedBy - Người thực hiện cập nhật
 * @returns {Order}
 */
const updateOrderStatus = async (orderId, newStatus, note, updatedBy) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

  // Kiểm tra luồng trạng thái hợp lệ
  if (!isValidTransition(order.status, newStatus)) {
    throw new AppError(
      `Không thể chuyển từ trạng thái "${order.status}" sang "${newStatus}". ` +
      `Các trạng thái hợp lệ tiếp theo: ${(VALID_TRANSITIONS[order.status] || []).join(', ') || 'không có'}`,
      400
    );
  }

  // Cập nhật trạng thái và ghi lịch sử
  order.status = newStatus;
  order.statusHistory.push({
    status: newStatus,
    note: note || '',
    updatedBy: updatedBy._id,
    timestamp: new Date(),
  });

  // Nếu đơn được assign nhân viên khi bắt đầu xử lý
  if (newStatus === 'washing' && !order.staff) {
    order.staff = updatedBy._id;
  }

  await order.save();
  await order.populate([
    { path: 'customer', select: 'name email phone' },
    { path: 'staff',    select: 'name email phone' },
    { path: 'service',  select: 'name priceType price' },
    { path: 'statusHistory.updatedBy', select: 'name role' },
  ]);

  // ✨ Emit real-time update tới tất cả client đang theo dõi đơn này
  try {
    const io = global._io;
    if (io) {
      emitOrderStatusUpdate(io, orderId, {
        status:    newStatus,
        note:      note || '',
        updatedBy: { name: updatedBy.name, role: updatedBy.role },
      });
    }
  } catch (_) {}

  return order;
};

/**
 * Hủy đơn hàng
 * - Customer: chỉ hủy được khi status = 'received'
 * - Admin: hủy bất kỳ lúc nào (trừ completed)
 *
 * @param {string} orderId
 * @param {User} currentUser
 * @param {string} reason - Lý do hủy
 * @returns {Order}
 */
const cancelOrder = async (orderId, currentUser, reason) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

  // Customer chỉ được hủy đơn của mình
  if (
    currentUser.role === 'customer' &&
    order.customer.toString() !== currentUser._id.toString()
  ) {
    throw new AppError('Bạn không có quyền hủy đơn hàng này', 403);
  }

  // Customer chỉ hủy được khi đơn mới nhận
  if (currentUser.role === 'customer' && order.status !== 'received') {
    throw new AppError('Chỉ có thể hủy đơn hàng khi đang ở trạng thái "Đã nhận"', 400);
  }

  if (order.status === 'completed') {
    throw new AppError('Không thể hủy đơn hàng đã hoàn thành', 400);
  }

  if (order.status === 'cancelled') {
    throw new AppError('Đơn hàng đã bị hủy trước đó', 400);
  }

  order.status = 'cancelled';
  order.statusHistory.push({
    status: 'cancelled',
    note: reason || 'Khách hàng hủy đơn',
    updatedBy: currentUser._id,
    timestamp: new Date(),
  });

  await order.save();
  return order;
};

/**
 * Lưu metadata ảnh chụp đơn hàng (nhận/giao đồ)
 * @param {string} orderId
 * @param {Array} files - Mảng file từ Multer
 * @param {string} imageType - 'pickup' hoặc 'delivery'
 * @param {User} uploadedBy
 * @returns {OrderImage[]}
 */
const saveOrderImages = async (orderId, files, imageType, uploadedBy) => {
  if (!files || files.length === 0) {
    throw new AppError('Không có ảnh nào được upload', 400);
  }

  // Kiểm tra đơn hàng tồn tại
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

  // Tạo records cho từng ảnh
  // Chuyển đường dẫn local (nếu có) thành URL web /uploads/...
  const imageRecords = files.map((file) => {
    let cleanUrl = file.path || '';
    if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      const uploadsIdx = cleanUrl.indexOf('uploads');
      if (uploadsIdx !== -1) {
        cleanUrl = '/' + cleanUrl.substring(uploadsIdx).replace(/\\/g, '/');
      } else if (file.filename) {
        cleanUrl = `/uploads/${orderId}/${file.filename}`;
      }
    }
    return {
      order: orderId,
      uploadedBy: uploadedBy._id,
      imageUrl: cleanUrl,
      imageType,
      metadata: {
        originalName: file.originalname,
        mimetype:     file.mimetype,
        size:         file.size,
      },
    };
  });

  const savedImages = await OrderImage.insertMany(imageRecords);
  return savedImages;
};

/**
 * Phân công nhân viên cho đơn hàng (Admin)
 * @param {string} orderId
 * @param {string} staffId
 * @returns {Order}
 */
const assignStaff = async (orderId, staffId) => {
  const order = await Order.findByIdAndUpdate(
    orderId,
    { staff: staffId },
    { new: true }
  ).populate('staff', 'name email phone');

  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
  return order;
};

/**
 * Cập nhật số kg thực tế & ảnh chụp đồ trên cân (Staff/Admin)
 * Tự động tính lại tổng tiền và chuyển trạng thái sang 'weighed'
 */
const updateOrderWeight = async (orderId, actualWeight, weightImageUrl, note, updatedBy) => {
  const order = await Order.findById(orderId).populate('service');
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

  if (actualWeight !== undefined && actualWeight !== null && Number(actualWeight) > 0) {
    const numWeight = Number(actualWeight);
    order.actualWeight = numWeight;
    order.quantity = numWeight;
    if (order.service && order.service.price) {
      order.totalPrice = numWeight * order.service.price;
    }
  }

  if (weightImageUrl) {
    let cleanUrl = weightImageUrl;
    if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      const uploadsIdx = cleanUrl.indexOf('uploads');
      if (uploadsIdx !== -1) {
        cleanUrl = '/' + cleanUrl.substring(uploadsIdx).replace(/\\/g, '/');
      }
    }
    order.weightImageUrl = cleanUrl;
  }

  order.status = 'weighed';
  order.statusHistory.push({
    status: 'weighed',
    note: note || `Nhân viên đã cân đồ: ${order.actualWeight || order.quantity} kg, tổng tiền: ${order.totalPrice?.toLocaleString('vi-VN')}đ`,
    updatedBy: updatedBy._id,
    timestamp: new Date(),
  });

  await order.save();
  await order.populate([
    { path: 'customer', select: 'name email phone' },
    { path: 'staff',    select: 'name email phone' },
    { path: 'service',  select: 'name priceType price' },
    { path: 'statusHistory.updatedBy', select: 'name role' },
  ]);

  try {
    const io = global._io;
    if (io) {
      emitOrderStatusUpdate(io, orderId, {
        status:         'weighed',
        actualWeight:   order.actualWeight,
        weightImageUrl: order.weightImageUrl,
        totalPrice:     order.totalPrice,
        note:           note || 'Đã cân đồ & báo giá',
        updatedBy:      { name: updatedBy.name, role: updatedBy.role },
      });
    }
  } catch (_) {}

  return order;
};

module.exports = {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  updateOrderWeight,
  cancelOrder,
  saveOrderImages,
  assignStaff,
};
