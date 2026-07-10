/**
 * utils/ApiResponse.js — Chuẩn hóa định dạng response API
 *
 * Mọi API đều trả về cùng một cấu trúc JSON giúp Frontend dễ xử lý.
 */

class ApiResponse {
  /**
   * Gửi response thành công
   * @param {object} res - Express response object
   * @param {number} statusCode - HTTP status code (mặc định 200)
   * @param {string} message - Thông điệp mô tả
   * @param {*} data - Dữ liệu trả về
   * @param {object} meta - Metadata phân trang (page, total, ...)
   */
  static success(res, statusCode = 200, message = 'Thành công', data = null, meta = null) {
    const response = { success: true, message };
    if (data !== null) response.data = data;
    if (meta !== null) response.meta = meta;
    return res.status(statusCode).json(response);
  }

  /**
   * Gửi response lỗi
   * @param {object} res - Express response object
   * @param {number} statusCode - HTTP status code (mặc định 400)
   * @param {string} message - Thông điệp lỗi
   * @param {*} errors - Chi tiết lỗi (validation, ...)
   */
  static error(res, statusCode = 400, message = 'Có lỗi xảy ra', errors = null) {
    const response = { success: false, message };
    if (errors !== null) response.errors = errors;
    return res.status(statusCode).json(response);
  }

  /**
   * Helper: 201 Created
   */
  static created(res, message, data) {
    return this.success(res, 201, message, data);
  }

  /**
   * Helper: 404 Not Found
   */
  static notFound(res, message = 'Không tìm thấy dữ liệu') {
    return this.error(res, 404, message);
  }

  /**
   * Helper: 401 Unauthorized
   */
  static unauthorized(res, message = 'Chưa đăng nhập hoặc token không hợp lệ') {
    return this.error(res, 401, message);
  }

  /**
   * Helper: 403 Forbidden
   */
  static forbidden(res, message = 'Bạn không có quyền thực hiện thao tác này') {
    return this.error(res, 403, message);
  }
}

module.exports = ApiResponse;
