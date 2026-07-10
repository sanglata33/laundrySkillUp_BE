/**
 * utils/AppError.js — Custom Error class
 *
 * Tất cả lỗi chủ động (lỗi nghiệp vụ) nên throw AppError
 * để Global Error Handler xử lý đồng nhất.
 */

class AppError extends Error {
  /**
   * @param {string} message - Thông điệp lỗi hiển thị cho người dùng
   * @param {number} statusCode - HTTP status code
   */
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Phân biệt lỗi chủ động vs lỗi hệ thống

    // Giữ nguyên stack trace khi extend Error
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
