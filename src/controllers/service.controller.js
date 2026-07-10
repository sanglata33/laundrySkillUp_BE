/**
 * controllers/service.controller.js — Xử lý HTTP request cho dịch vụ
 */

const serviceService = require('../services/service.service');
const ApiResponse    = require('../utils/ApiResponse');

/** GET /api/services — Danh sách dịch vụ (public) */
const getAllServices = async (req, res, next) => {
  try {
    const services = await serviceService.getAllServices();
    return ApiResponse.success(res, 200, 'Lấy danh sách dịch vụ thành công', { services });
  } catch (err) {
    next(err);
  }
};

/** GET /api/services/:id — Chi tiết dịch vụ */
const getServiceById = async (req, res, next) => {
  try {
    const service = await serviceService.getServiceById(req.params.id);
    return ApiResponse.success(res, 200, 'Lấy thông tin dịch vụ thành công', { service });
  } catch (err) {
    next(err);
  }
};

/** POST /api/services — Tạo dịch vụ mới [admin] */
const createService = async (req, res, next) => {
  try {
    const service = await serviceService.createService(req.body);
    return ApiResponse.created(res, 'Tạo dịch vụ thành công', { service });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/services/:id — Cập nhật dịch vụ [admin] */
const updateService = async (req, res, next) => {
  try {
    const service = await serviceService.updateService(req.params.id, req.body);
    return ApiResponse.success(res, 200, 'Cập nhật dịch vụ thành công', { service });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/services/:id — Xóa mềm dịch vụ [admin] */
const deleteService = async (req, res, next) => {
  try {
    await serviceService.deleteService(req.params.id);
    return ApiResponse.success(res, 200, 'Xóa dịch vụ thành công');
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllServices, getServiceById, createService, updateService, deleteService };
