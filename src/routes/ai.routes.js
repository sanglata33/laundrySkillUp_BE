/**
 * routes/ai.routes.js — Định nghĩa các route liên quan đến AI
 */

const express = require('express');
const multer = require('multer');
const aiController = require('../controllers/ai.controller');
const AppError = require('../utils/AppError');

const router = express.Router();

// Sử dụng memoryStorage để lưu file ảnh tạm thời trong bộ nhớ (RAM)
// Cách này tối ưu vì không tốn dung lượng I/O ổ cứng và không cần xóa file sau khi xử lý.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Chỉ chấp nhận file ảnh (JPEG, PNG, WebP)', 400), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Endpoint POST /api/ai/detect-care-label
// Khách hàng hoặc nhân viên tải lên 1 ảnh nhãn mác (key là 'file') để AI quét
router.post('/detect-care-label', upload.single('file'), aiController.detectCareLabel);

module.exports = router;
