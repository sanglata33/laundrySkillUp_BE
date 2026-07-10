/**
 * config/cloudinary.js — Cấu hình Cloudinary v2
 *
 * Upload ảnh lên Cloudinary thay vì lưu local.
 * Ưu điểm: URL ảnh truy cập được từ mọi nơi, có CDN tự động.
 *
 * Đăng ký miễn phí tại: https://cloudinary.com
 * Lấy credentials từ: Dashboard > API Keys
 */

const cloudinary        = require('cloudinary').v2;
const CloudinaryStorage = require('multer-storage-cloudinary'); // v2: export trực tiếp
const multer            = require('multer');
const AppError          = require('../utils/AppError');

// ─── Khởi tạo Cloudinary với credentials từ .env ────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true, // Luôn dùng HTTPS
});

// ─── Cấu hình Cloudinary Storage cho Multer ─────────────────────────────────
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const orderId = req.params.id || 'general';
    return {
      folder:         `laundry/${orderId}`,    // Tổ chức ảnh theo thư mục orderId
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 1200, crop: 'limit', quality: 'auto' }],
      public_id:      `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    };
  },
});

// ─── Fallback: lưu local nếu chưa cấu hình Cloudinary ──────────────────────
const path   = require('path');
const fs     = require('fs');

const localStorageFallback = multer.diskStorage({
  destination: (req, file, cb) => {
    const orderId   = req.params.id || 'temp';
    const uploadDir = path.join(__dirname, '../../uploads', orderId);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const hasCloudinaryConfig = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME &&
     process.env.CLOUDINARY_API_KEY &&
     process.env.CLOUDINARY_API_SECRET);

// ─── Lọc file (chỉ nhận ảnh) ────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new AppError('Chỉ chấp nhận file ảnh (JPEG, PNG, WebP)', 400), false);
};

// ─── Multer instance (tự động chọn cloud hoặc local) ────────────────────────
const getUploader = () => multer({
  storage: hasCloudinaryConfig() ? cloudinaryStorage : localStorageFallback,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

/**
 * Middleware upload ảnh
 * Nếu có CLOUDINARY_* trong .env → upload lên cloud
 * Nếu chưa cấu hình → lưu local (development mode)
 *
 * req.files[i].path = URL Cloudinary hoặc đường dẫn local
 */
const handleCloudUpload = (req, res, next) => {
  const uploader = getUploader();
  uploader.array('images', 5)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE')  return next(new AppError('File ảnh quá lớn. Tối đa 5MB', 400));
      if (err.code === 'LIMIT_FILE_COUNT') return next(new AppError('Tối đa 5 ảnh mỗi lần upload', 400));
      return next(new AppError(`Lỗi upload: ${err.message}`, 400));
    }
    if (err) return next(err);

    // Chuẩn hóa path: Cloudinary trả về req.files[i].path, local trả về req.files[i].filename
    if (!hasCloudinaryConfig() && req.files) {
      req.files = req.files.map((f) => ({
        ...f,
        path: `/uploads/${req.params.id || 'temp'}/${f.filename}`,
      }));
    }
    next();
  });
};

/**
 * Xóa ảnh khỏi Cloudinary theo public_id
 */
const deleteFromCloud = async (publicId) => {
  try {
    if (hasCloudinaryConfig()) await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Lỗi xóa ảnh Cloudinary:', err.message);
  }
};

module.exports = { cloudinary, handleCloudUpload, deleteFromCloud, hasCloudinaryConfig };
