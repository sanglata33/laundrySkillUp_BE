/**
 * models/Payment.model.js — Schema thanh toán
 *
 * Hỗ trợ các phương thức:
 *  - cash   : Thanh toán tiền mặt
 *  - vnpay  : Thanh toán qua VNPay
 *  - momo   : Thanh toán qua MoMo
 */

const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },

    // Số tiền thanh toán (VNĐ)
    amount: {
      type: Number,
      required: [true, 'Số tiền không được để trống'],
      min: [0, 'Số tiền không được âm'],
    },

    // Phương thức thanh toán
    method: {
      type: String,
      enum: {
        values: ['cash', 'vnpay', 'momo', 'bank_transfer', 'vietqr'],
        message: 'Phương thức thanh toán không hợp lệ',
      },
      required: true,
    },

    // Trạng thái giao dịch
    status: {
      type: String,
      enum: {
        values: ['pending', 'paid', 'failed', 'refunded'],
        message: 'Trạng thái thanh toán không hợp lệ',
      },
      default: 'pending',
    },

    // Mã giao dịch (từ cổng thanh toán hoặc tự sinh)
    transactionId: {
      type: String,
      unique: true,
      sparse: true, // Cho phép nhiều document null (đối với cash)
    },

    // Lưu toàn bộ response từ VNPay để đối soát
    vnpayData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // URL mã QR thanh toán VietQR
    qrCodeUrl: {
      type: String,
      default: null,
    },

    // Thông tin tài khoản ngân hàng thụ hưởng (VietQR)
    bankInfo: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Lưu payload nhận từ Webhook (SePAY / Casso)
    webhookData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // URL thanh toán VNPay (chỉ valid trong thời gian ngắn)
    paymentUrl: {
      type: String,
      default: null,
    },

    // Thời điểm thanh toán thành công
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('Payment', PaymentSchema);
