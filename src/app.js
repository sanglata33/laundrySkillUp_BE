/**
 * app.js — Cấu hình Express application (v2 — FE Integration)
 *
 * Nâng cấp:
 *  - CORS chi tiết hỗ trợ nhiều origin (dev + prod)
 *  - Cookie parser cho Refresh Token (HttpOnly cookie)
 *  - Helmet cho bảo mật headers
 */

const express      = require('express');
const cors         = require('cors');
const morgan       = require('morgan');
const path         = require('path');
const cookieParser = require('cookie-parser');

// Import routes
const authRoutes    = require('./routes/auth.routes');
const orderRoutes   = require('./routes/order.routes');
const serviceRoutes = require('./routes/service.routes');
const paymentRoutes = require('./routes/payment.routes');
const adminRoutes   = require('./routes/admin.routes');   // Admin/Staff module
const aiRoutes      = require('./routes/ai.routes');      // AI scan module


const app = express();

// ─── Danh sách origins được phép (thêm domain production vào đây) ───────────
const ALLOWED_ORIGINS = [
  'http://localhost:3000',   // React dev
  'http://localhost:5173',   // Vite dev
  process.env.CLIENT_URL,   // Production FE URL từ .env
].filter(Boolean); // Loại bỏ undefined

// ─── Middleware CORS ─────────────────────────────────────────────────────────
app.use(cors({
  /**
   * Hàm kiểm tra origin động:
   *  - Dev: cho phép mọi origin trong ALLOWED_ORIGINS
   *  - Nếu không có origin (vd: Postman, mobile app) → cho phép
   */
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin "${origin}" không được phép`));
    }
  },
  credentials: true,              // Bắt buộc để gửi/nhận cookie
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count'], // FE có thể đọc header tổng số bản ghi
}));

// Xử lý preflight request (OPTIONS) cho tất cả routes
app.options('*', cors());

// ─── Parse body & cookies ────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser()); // Đọc cookie (cho Refresh Token)

// ─── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Phục vụ ảnh local (fallback khi chưa dùng Cloudinary) ──────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin',    adminRoutes);   // Admin/Staff: /api/admin/*
app.use('/api/ai',       aiRoutes);      // AI: /api/ai/*


// Health check
app.get('/api', (req, res) => {
  res.json({
    success:   true,
    message:   '🧻 Laundry Service API đang hoạt động',
    version:   '3.0.0',
    timestamp: new Date().toISOString(),
    features:  ['JWT Auth', 'OTP Auth', 'Socket.io', 'Cloudinary Upload', 'VNPay', 'Admin Module'],
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} không tồn tại`,
    data:    null,
  });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Xử lý lỗi CORS
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ success: false, message: err.message, data: null });
  }

  // Xử lý lỗi Mongoose validation
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ', errors, data: null });
  }

  // Xử lý lỗi Mongoose duplicate key (vd: email đã tồn tại)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} đã tồn tại trong hệ thống`,
      data:    null,
    });
  }

  const statusCode = err.statusCode || 500;
  const message    = err.message    || 'Lỗi server nội bộ';

  res.status(statusCode).json({
    success: false,
    message,
    data:    null,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
