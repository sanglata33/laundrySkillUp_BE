/**
 * server.js — Entry point của ứng dụng
 * Khởi động HTTP server, kết nối database, và thiết lập Socket.io
 */

require('dotenv').config();
const { createServer } = require('http');
const { Server }       = require('socket.io');
const app              = require('./src/app');
const connectDB        = require('./src/config/database');
const { setupSocket }  = require('./src/config/socket');

const PORT = process.env.PORT || 5000;

// ─── Tạo HTTP server từ Express app ────────────────────────────────────────
// (Socket.io cần raw HTTP server, không phải Express trực tiếp)
const httpServer = createServer(app);

// ─── Khởi tạo Socket.io ────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Thời gian chờ trước khi ngắt kết nối idle
  pingTimeout: 60000,
});

// Đính io vào app để có thể dùng trong controllers (emit events)
app.set('io', io);
global._io = io; // Cho phép access từ services mà không cần circular import

// Thiết lập các Socket.io event handlers
setupSocket(io);

// ─── Kết nối DB rồi mới listen ─────────────────────────────────────────────
connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`\n🚀 Server đang chạy tại: http://localhost:${PORT}`);
    console.log(`🔌 Socket.io sẵn sàng`);
    console.log(`📌 Môi trường: ${process.env.NODE_ENV}`);
    console.log(`📋 API Docs: http://localhost:${PORT}/api\n`);
  });

  process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err.message);
    httpServer.close(() => process.exit(1));
  });
});
