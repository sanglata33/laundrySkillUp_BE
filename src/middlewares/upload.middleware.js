/**
 * middlewares/upload.middleware.js — Xử lý upload ảnh
 *
 * Sử dụng Multer để nhận file ảnh từ multipart/form-data.
 * Ảnh được lưu vào thư mục /uploads/<orderId>/
 * Giới hạn: chỉ nhận ảnh, tối đa 5MB/file.
 */

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const AppError = require('../utils/AppError');

// ─── Cấu hình nơi lưu file ──────────────────────────────────────────────────
const storage = multer.diskStorage({
  // Thư mục đích: uploads/<orderId>/
  destination: (req, file, cb) => {
    const orderId  = req.params.id || 'temp';
    const uploadDir = path.join(__dirname, '../../uploads', orderId);

    // Tạo thư mục nếu chưa tồn tại
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },

  // Tên file: <timestamp>-<originalname>
  filename: (req, file, cb) => {
    const ext      = path.extname(file.originalname).toLowerCase();
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, filename);
  },
});

// ─── Lọc loại file (chỉ chấp nhận ảnh) ─────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true); // Chấp nhận file
  } else {
    cb(new AppError('Chỉ chấp nhận file ảnh (JPEG, PNG, WebP)', 400), false);
  }
};

// ─── Khởi tạo Multer ────────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
    files: 5, // Tối đa 5 ảnh cùng lúc
  },
});

/**
 * Upload nhiều ảnh với field name là "images"
 */
const uploadImages = upload.array('images', 5);

/**
 * Middleware bọc multer để xử lý lỗi upload đúng cách
 */
const handleUpload = (req, res, next) => {
  uploadImages(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File ảnh quá lớn. Tối đa 5MB mỗi ảnh', 400));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(new AppError('Tối đa 5 ảnh mỗi lần upload', 400));
      }
      return next(new AppError(`Lỗi upload: ${err.message}`, 400));
    }
    if (err) return next(err);
    next();
  });
};

module.exports = { handleUpload };
