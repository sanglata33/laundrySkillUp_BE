/**
 * controllers/order.controller.js — Xử lý HTTP request cho Đơn hàng
 *
 * Đây là controller phức tạp nhất, bao gồm:
 *  - CRUD đơn hàng
 *  - Cập nhật trạng thái
 *  - Upload ảnh nhận/giao đồ
 *  - Phân công nhân viên
 */

const orderService = require('../services/order.service');
const ApiResponse  = require('../utils/ApiResponse');

/**
 * GET /api/orders
 * Danh sách đơn hàng
 *  - Admin/Staff: thấy tất cả, có thể lọc theo status
 *  - Customer: chỉ thấy đơn của mình
 */
const getAllOrders = async (req, res, next) => {
  try {
    const result = await orderService.getAllOrders(req.user, req.query);

    return ApiResponse.success(
      res,
      200,
      'Lấy danh sách đơn hàng thành công',
      { orders: result.orders },
      {
        total:      result.total,
        page:       result.page,
        totalPages: result.totalPages,
      }
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/:id
 * Chi tiết đơn hàng (kèm danh sách ảnh)
 */
const getOrderById = async (req, res, next) => {
  try {
    const { order, images } = await orderService.getOrderById(req.params.id, req.user);
    return ApiResponse.success(res, 200, 'Lấy thông tin đơn hàng thành công', { order, images });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders
 * Tạo đơn hàng mới
 * [Yêu cầu: customer]
 *
 * Body: { serviceId, quantity, pickupAddress, deliveryAddress, note, scheduledPickupTime }
 */
const createOrder = async (req, res, next) => {
  try {
    const order = await orderService.createOrder(req.body, req.user);
    return ApiResponse.created(res, 'Tạo đơn hàng thành công', { order });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/orders/:id/status
 * Cập nhật trạng thái đơn hàng
 * [Yêu cầu: staff hoặc admin]
 *
 * Body: { status, note }
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;

    if (!status) {
      return ApiResponse.error(res, 400, 'Vui lòng cung cấp trạng thái mới');
    }

    const order = await orderService.updateOrderStatus(
      req.params.id,
      status,
      note,
      req.user
    );

    return ApiResponse.success(res, 200, `Cập nhật trạng thái thành "${status}" thành công`, { order });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/orders/:id
 * Hủy đơn hàng
 * Body: { reason }
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await orderService.cancelOrder(req.params.id, req.user, reason);
    return ApiResponse.success(res, 200, 'Hủy đơn hàng thành công', { order });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders/:id/images
 * Upload ảnh chụp đồ giặt
 * [Yêu cầu: staff hoặc admin]
 *
 * Form-data: images (files), imageType ('pickup' | 'delivery')
 */
const uploadOrderImages = async (req, res, next) => {
  try {
    const { imageType } = req.body;

    if (!imageType || !['pickup', 'delivery'].includes(imageType)) {
      return ApiResponse.error(res, 400, 'imageType phải là "pickup" hoặc "delivery"');
    }

    const images = await orderService.saveOrderImages(
      req.params.id,
      req.files,
      imageType,
      req.user
    );

    return ApiResponse.created(res, `Upload ${images.length} ảnh thành công`, { images });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/orders/:id/assign
 * Phân công nhân viên cho đơn hàng
 * [Yêu cầu: admin]
 *
 * Body: { staffId }
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

module.exports = {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  uploadOrderImages,
  assignStaff,
};
