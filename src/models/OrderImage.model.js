/**
 * models/OrderImage.model.js — Schema ảnh chụp đồ giặt
 *
 * Lưu metadata của ảnh khi nhân viên chụp:
 *  - pickup  : Ảnh khi lấy đồ từ khách hàng
 *  - delivery: Ảnh khi giao đồ lại cho khách hàng
 */

const mongoose = require('mongoose');

const OrderImageSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'OrderId không được để trống'],
      index: true,
    },

    // Người upload ảnh (nhân viên hoặc admin)
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // URL hoặc đường dẫn tới ảnh
    imageUrl: {
      type: String,
      required: [true, 'Đường dẫn ảnh không được để trống'],
    },

    // Loại ảnh: nhận đồ hoặc giao đồ
    imageType: {
      type: String,
      enum: {
        values: ['pickup', 'delivery'],
        message: 'imageType phải là pickup hoặc delivery',
      },
      required: true,
    },

    // Metadata file ảnh
    metadata: {
      originalName: String,  // Tên file gốc
      mimetype: String,      // vd: image/jpeg
      size: Number,          // Kích thước file (bytes)
      width: Number,         // Chiều rộng ảnh (nếu có xử lý)
      height: Number,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('OrderImage', OrderImageSchema);
