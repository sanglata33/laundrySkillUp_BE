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
  // Tự động seed dịch vụ nếu bảng Service trống
  try {
    const Service = require('./src/models/Service.model');
    const serviceCount = await Service.countDocuments({ isActive: true });
    if (serviceCount === 0) {
      console.log('🌱 Database trống. Đang tự động seed các dịch vụ giặt là mẫu...');
      const defaultServices = [
        {
          name: 'Giặt Sấy Sạch Nhanh',
          description: 'Dịch vụ giặt sấy tiêu chuẩn sử dụng nước giặt hữu cơ, sấy nhiệt độ phù hợp giúp bảo vệ sợi vải.',
          priceType: 'per_kg',
          price: 15000,
          estimatedHours: 4,
          isActive: true
        },
        {
          name: 'Giặt Sấy Premium (Hương Nước Hoa)',
          description: 'Nước xả hương nước hoa cao cấp nhập khẩu Pháp. Sấy công nghệ hơi nước giảm nhăn tối đa.',
          priceType: 'per_kg',
          price: 25000,
          estimatedHours: 4,
          isActive: true
        },
        {
          name: 'Giặt Hấp Vest / Suit',
          description: 'Quy trình giặt khô chuyên nghiệp cho các bộ Suit, Vest cao cấp. Giữ form dáng chuẩn.',
          priceType: 'per_item',
          price: 120000,
          estimatedHours: 24,
          isActive: true
        },
        {
          name: 'Giặt Hấp Váy Cưới Cầu Kỳ',
          description: 'Chăm sóc đặc biệt cho chiếc váy cưới của bạn. Loại bỏ vết ố, bảo vệ ren và hạt cườm.',
          priceType: 'per_item',
          price: 350000,
          estimatedHours: 48,
          isActive: true
        },
        {
          name: 'Ủi Phẳng Lấy Ngay',
          description: 'Dịch vụ ủi phẳng bằng bàn ủi hơi nước công nghiệp áp suất lớn. Lấy ngay sau 1 giờ.',
          priceType: 'per_item',
          price: 10000,
          estimatedHours: 2,
          isActive: true
        },
        {
          name: 'Spa & Giặt Giày Sneaker',
          description: 'Làm sạch sâu từ trong ra ngoài bằng tay với các dung dịch chuyên dụng. Khử trùng UV.',
          priceType: 'per_item',
          price: 80000,
          estimatedHours: 36,
          isActive: true
        },
        {
          name: 'Giặt Hấp Thú Bông Cỡ Lớn',
          description: 'Chăm sóc gấu bông, thú bông của bé yêu. Giặt sạch sâu bụi bẩn tích tụ bên trong.',
          priceType: 'per_item',
          price: 90000,
          estimatedHours: 24,
          isActive: true
        },
        {
          name: 'Giặt Nệm / Sofa / Rèm',
          description: 'Vệ sinh sâu cho nệm, sofa và rèm cửa bằng máy phun hút hơi nước nóng diệt khuẩn.',
          priceType: 'per_item',
          price: 150000,
          estimatedHours: 24,
          isActive: true
        }
      ];
      await Service.insertMany(defaultServices);
      console.log('✅ Seed dịch vụ giặt là thành công!');
    }
  } catch (seedErr) {
    console.error('❌ Tự động seed dịch vụ thất bại:', seedErr.message);
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
