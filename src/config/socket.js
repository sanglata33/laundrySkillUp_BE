/**
 * config/socket.js — Thiết lập Socket.io events
 *
 * Real-time features:
 *  - Khách hàng join vào "phòng" riêng theo orderId
 *  - Khi staff cập nhật trạng thái → BE emit sự kiện → FE nhận ngay, không cần F5
 *
 * ─── Cách dùng ở Frontend (React) ────────────────────────────────────────────
 *
 *   import { io } from 'socket.io-client';
 *
 *   const socket = io('http://localhost:5000', {
 *     auth: { token: localStorage.getItem('token') }
 *   });
 *
 *   // Vào phòng của đơn hàng cụ thể để nhận cập nhật
 *   socket.emit('join_order_room', orderId);
 *
 *   // Lắng nghe khi trạng thái thay đổi
 *   socket.on('order_status_updated', (data) => {
 *     console.log('Trạng thái mới:', data.status);
 *     // → Cập nhật UI ngay lập tức
 *   });
 *
 *   // Dọn dẹp khi unmount component
 *   return () => socket.disconnect();
 */

const jwt  = require('jsonwebtoken');
const User = require('../models/User.model');

/**
 * Thiết lập toàn bộ Socket.io logic
 * @param {import('socket.io').Server} io
 */
const setupSocket = (io) => {

  // ─── Middleware xác thực JWT cho Socket.io ────────────────────────────────
  io.use(async (socket, next) => {
    try {
      // Token được gửi qua handshake auth
      const token = socket.handshake.auth?.token;

      if (!token) {
        // Cho phép kết nối ẩn danh (chỉ xem, không join room riêng tư)
        socket.user = null;
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user    = await User.findById(decoded.id).select('name role email');

      if (!user || !user.isActive) {
        return next(new Error('Token không hợp lệ'));
      }

      socket.user = user; // Attach user vào socket
      next();
    } catch (err) {
      // Token hết hạn hoặc không hợp lệ → vẫn cho kết nối nhưng không có quyền
      socket.user = null;
      next();
    }
  });

  // ─── Xử lý kết nối ───────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.user?._id?.toString() || 'anonymous';
    console.log(`🔌 Socket connected: ${socket.id} | User: ${userId}`);

    /**
     * Sự kiện: Khách hàng/Staff muốn theo dõi một đơn hàng cụ thể
     * FE emit: socket.emit('join_order_room', orderId)
     */
    socket.on('join_order_room', (orderId) => {
      if (!orderId) return;
      const room = `order:${orderId}`;
      socket.join(room);
      console.log(`  ↳ ${socket.id} joined room: ${room}`);

      // Xác nhận đã vào phòng
      socket.emit('joined_room', { orderId, room });
    });

    /**
     * Sự kiện: Rời phòng đơn hàng
     */
    socket.on('leave_order_room', (orderId) => {
      const room = `order:${orderId}`;
      socket.leave(room);
    });

    /**
     * Sự kiện: Staff muốn join vào dashboard của mình
     * Dùng để nhận thông báo đơn mới
     */
    socket.on('join_staff_room', () => {
      if (!socket.user || !['staff', 'admin'].includes(socket.user.role)) return;
      socket.join('staff_room');
      console.log(`  ↳ Staff ${socket.user.name} joined staff_room`);
    });

    // Ngắt kết nối
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} | Reason: ${reason}`);
    });
  });
};

/**
 * Emit sự kiện "order_status_updated" tới phòng của đơn hàng
 * Được gọi từ order.service.js sau khi cập nhật trạng thái thành công
 *
 * @param {import('socket.io').Server} io
 * @param {string} orderId
 * @param {object} payload - Dữ liệu gửi về FE
 */
const emitOrderStatusUpdate = (io, orderId, payload) => {
  const room = `order:${orderId}`;
  io.to(room).emit('order_status_updated', {
    orderId,
    ...payload,
    timestamp: new Date().toISOString(),
  });
  console.log(`📡 Emitted order_status_updated → room ${room}:`, payload.status);
};

/**
 * Emit thông báo đơn hàng mới tới staff_room
 * @param {import('socket.io').Server} io
 * @param {object} order - Đơn hàng vừa tạo
 */
const emitNewOrder = (io, order) => {
  io.to('staff_room').emit('new_order', {
    orderId:   order._id,
    orderCode: order.orderCode,
    message:   `Đơn hàng mới: ${order.orderCode}`,
    timestamp: new Date().toISOString(),
  });
};

module.exports = { setupSocket, emitOrderStatusUpdate, emitNewOrder };
