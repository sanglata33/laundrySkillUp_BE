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
connectDB().then(async () => {
  // ─── Migrate services: đảm bảo đúng 3 dịch vụ chuẩn trong DB ─────────────
  // ⚠️  Tên service PHẢI khớp với PRODUCT_SERVICE_MAP trong FE/Cart.tsx
  try {
    const Service = require('./src/models/Service.model');

    const CANONICAL_SERVICES = [
      {
        // FE map: 'giat-say-tieu-chuan' → keyword ['tieu chuan', 'giat say']
        name: 'Giặt sấy tiêu chuẩn',
        description: 'Giặt sấy sạch tiêu chuẩn tính theo kg. Sử dụng nước giặt hữu cơ, sấy nhiệt độ phù hợp bảo vệ sợi vải.',
        priceType: 'per_kg',
        price: 25000,
        estimatedHours: 24,
        isActive: true
      },
      {
        // FE map: 'giat-hap-ao-vest' → keyword ['hap', 'vest', 'ao vest']
        name: 'Giặt hấp áo vest',
        description: 'Giặt hấp cao cấp cho áo vest nam/nữ. Giữ form dáng nguyên bản, bảo vệ chất liệu vải.',
        priceType: 'per_item',
        price: 80000,
        estimatedHours: 48,
        isActive: true
      },
      {
        // FE map: 'giat-giay-sneaker' → keyword ['giay', 'sneaker']
        name: 'Giặt giày sneaker',
        description: 'Làm sạch sâu từ trong ra ngoài bằng tay với các dung dịch chuyên dụng. Khử mùi và sấy khô tia cực tím.',
        priceType: 'per_item',
        price: 50000,
        estimatedHours: 36,
        isActive: true
      },
    ];

    const canonicalNames = CANONICAL_SERVICES.map(s => s.name);
    const existingCanonical = await Service.countDocuments({ name: { $in: canonicalNames } });

    if (existingCanonical < 3) {
      // DB thiếu canonical services → xóa hết services cũ và seed lại đúng 3 cái
      console.log('🔄 Migrate: cập nhật services về 3 dịch vụ chuẩn...');
      await Service.deleteMany({});
      await Service.insertMany(CANONICAL_SERVICES);
      console.log('✅ Migrate thành công: Giặt sấy tiêu chuẩn | Giặt hấp áo vest | Giặt giày sneaker');
    } else {
      console.log(`ℹ️  Services OK (${existingCanonical}/3 canonical services hiện diện).`);
    }
  } catch (migrateErr) {
    console.error('❌ Migrate services thất bại:', migrateErr.message);
  }

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
