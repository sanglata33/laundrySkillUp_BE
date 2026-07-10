/**
 * services/service.service.js — Business logic quản lý dịch vụ giặt ủi
 */

const Service   = require('../models/Service.model');
const AppError  = require('../utils/AppError');

/**
 * Lấy danh sách tất cả dịch vụ đang hoạt động
 * @returns {Service[]}
 */
const getAllServices = async () => {
  return Service.find({ isActive: true }).sort({ createdAt: -1 });
};

/**
 * Lấy chi tiết một dịch vụ theo ID
 * @param {string} id
 * @returns {Service}
 */
const getServiceById = async (id) => {
  const service = await Service.findById(id);
  if (!service) throw new AppError('Không tìm thấy dịch vụ', 404);
  return service;
};

/**
 * Tạo dịch vụ mới (chỉ admin)
 * @param {object} data - { name, description, priceType, price, estimatedHours }
 * @returns {Service}
 */
const createService = async (data) => {
  const service = await Service.create(data);
  return service;
};

/**
 * Cập nhật dịch vụ (chỉ admin)
 * @param {string} id
 * @param {object} data
 * @returns {Service}
 */
const updateService = async (id, data) => {
  const service = await Service.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
  if (!service) throw new AppError('Không tìm thấy dịch vụ', 404);
  return service;
};

/**
 * Xóa mềm dịch vụ — đặt isActive = false (chỉ admin)
 * KHÔNG xóa cứng vì đơn hàng cũ vẫn có thể tham chiếu đến dịch vụ này
 * @param {string} id
 * @returns {Service}
 */
const deleteService = async (id) => {
  const service = await Service.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  );
  if (!service) throw new AppError('Không tìm thấy dịch vụ', 404);
  return service;
};

module.exports = { getAllServices, getServiceById, createService, updateService, deleteService };
