/**
 * models/Order.model.js — Schema đơn hàng giặt ủi (v2)
 *
 * Luồng trạng thái đơn hàng:
 *  received → washing → drying → delivering → completed
 *                ↓        ↓           ↓
 *            cancelled cancelled   cancelled  (admin có thể hủy mọi lúc)
 *
 * v2 — Thêm:
 *  - staffNotes[]: mảng ghi chú nhân viên (nhiều ghi chú theo thời gian)
 *  - adminNote: ghi chú admin (VIP, ưu tiên...)
 *  - completedAt: thời điểm hoàn thành (để thống kê doanh thu)
 *  - Dùng ORDER_STATUS enum thay vì string hardcode
 */

const mongoose                 = require('mongoose');
const { ORDER_STATUS_VALUES }  = require('../constants/orderStatus');

// ─── Sub-schema lịch sử trạng thái ─────────────────────────────────────────
const StatusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false } // Không cần _id cho sub-document
);

// ─── Main Order Schema ───────────────────────────────────────────────────────
const OrderSchema = new mongoose.Schema(
  {
    // Mã đơn hàng tự động sinh (vd: LD-20241210-0001)
    orderCode: {
      type: String,
      unique: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Khách hàng không được để trống'],
    },

    // Nhân viên được phân công (có thể null trước khi assign)
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Dịch vụ không được để trống'],
    },

    // Số lượng (kg hoặc số món tùy priceType của service)
    quantity: {
      type: Number,
      required: [true, 'Số lượng không được để trống'],
      min: [0.1, 'Số lượng phải lớn hơn 0'],
    },

    // Tổng tiền (tính tự động trong pre-save)
    totalPrice: {
      type: Number,
      min: 0,
    },

    // Trạng thái đơn hàng — dùng enum từ constants/orderStatus.js
    status: {
      type: String,
      enum: {
        values:  ORDER_STATUS_VALUES,
        message: 'Trạng thái "{VALUE}" không hợp lệ. Các giá trị hợp lệ: ' + ORDER_STATUS_VALUES.join(', '),
      },
      default: 'received',
    },

    pickupAddress: {
      type: String,
      required: [true, 'Địa chỉ lấy đồ không được để trống'],
      trim: true,
    },

    deliveryAddress: {
      type: String,
      required: [true, 'Địa chỉ giao đồ không được để trống'],
      trim: true,
    },

    // Thời gian lấy đồ mong muốn
    scheduledPickupTime: Date,

    // Ghi chú của khách (1 lần khi tạo đơn)
    note: {
      type: String,
      trim: true,
    },

    // ─── Ghi chú nhân viên (MẢNG — nhiều ghi chú theo thời gian) ───────────
    // Ví dụ: "Áo sơ mi bị ố vàng nhẹ", "Khách hẹn giao sau 5h chiều"
    // Khác với `note` của khách: có timestamp + người ghi + nhiều lần
    staffNotes: [
      {
        content: {
          type:     String,
          required: [true, 'Nội dung ghi chú không được để trống'],
          trim:     true,
          maxlength: [500, 'Ghi chú không được quá 500 ký tự'],
        },
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref:  'User',
        },
        createdAt: {
          type:    Date,
          default: Date.now,
        },
      },
    ],

    // ─── Ghi chú Admin (1 string, thay thế được) ───────────────────────────
    // Ví dụ: "VIP customer - ưu tiên xử lý", "Đã xác nhận qua điện thoại"
    adminNote: {
      type:     String,
      trim:     true,
      maxlength: [300, 'Ghi chú admin không được quá 300 ký tự'],
    },

    // ─── Thời điểm hoàn thành (để thống kê doanh thu theo tháng) ───────────
    // Tự động set khi status chuyển sang 'completed'
    completedAt: {
      type: Date,
    },

    // Lịch sử thay đổi trạng thái (audit trail)
    statusHistory: [StatusHistorySchema],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Indexes để tăng tốc truy vấn ───────────────────────────────────────────
// Lưu ý: orderCode đã có unique:true nên KHÔNG cần index() riêng
OrderSchema.index({ customer: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });

// ─── Tự động sinh orderCode trước khi lưu ───────────────────────────────────
OrderSchema.pre('save', async function (next) {
  // Sinh orderCode cho đơn mới
  if (this.isNew) {
    const today   = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const count = await mongoose.model('Order').countDocuments({
      createdAt: {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lt:  new Date(today.setHours(23, 59, 59, 999)),
      },
    });

    this.orderCode = `LD-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    this.statusHistory = [{
      status:    'received',
      note:      'Đơn hàng mới được tạo',
      updatedBy: this.customer,
    }];
  }

  // Tự động set completedAt khi đơn hoàn thành
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }

  next();
});

module.exports = mongoose.model('Order', OrderSchema);
