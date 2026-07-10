/**
 * models/Service.model.js — Schema dịch vụ giặt ủi
 *
 * Hỗ trợ 2 loại tính giá:
 *  - per_kg   : Tính theo kg (vd: Giặt thường 25.000đ/kg)
 *  - per_item : Tính theo món (vd: Giặt khô áo vest 80.000đ/món)
 */

const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên dịch vụ không được để trống'],
      trim: true,
      unique: true,
    },

    description: {
      type: String,
      trim: true,
    },

    // Loại tính giá
    priceType: {
      type: String,
      enum: {
        values: ['per_kg', 'per_item'],
        message: 'priceType phải là per_kg hoặc per_item',
      },
      required: [true, 'Loại tính giá không được để trống'],
    },

    // Đơn giá (VNĐ)
    price: {
      type: Number,
      required: [true, 'Giá tiền không được để trống'],
      min: [0, 'Giá tiền không được âm'],
    },

    // Thời gian xử lý ước tính (đơn vị: giờ)
    estimatedHours: {
      type: Number,
      default: 24,
      min: [1, 'Thời gian xử lý tối thiểu 1 giờ'],
    },

    // Dịch vụ có đang được kích hoạt không?
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('Service', ServiceSchema);
