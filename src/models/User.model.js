/**
 * models/User.model.js — Schema người dùng
 *
 * Hỗ trợ 3 vai trò:
 *  - customer  : Khách hàng
 *  - staff     : Nhân viên giao hàng
 *  - admin     : Quản trị viên
 *
 * v2 — Hỗ trợ 2 luồng đăng nhập:
 *  1. Email + Password (admin/staff)
 *  2. SĐT + OTP (customer — không cần email/password)
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      trim:      true,
      maxlength: [100, 'Tên không được quá 100 ký tự'],
      default:   '',
    },

    // ── Email (optional — chỉ bắt buộc với luồng email+password) ────────────
    // sparse: true → cho phép nhiều document có email = null/undefined
    // mà vẫn đảm bảo unique với những document có email
    email: {
      type:      String,
      unique:    true,
      sparse:    true,  // Cho phép nhiều user KHÔNG có email
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Email không hợp lệ'],
    },

    // ── Password (optional — không dùng khi đăng nhập bằng OTP) ─────────────
    password: {
      type:      String,
      minlength: [6, 'Mật khẩu tối thiểu 6 ký tự'],
      select:    false, // Mặc định không trả về password trong query
    },

    // ── SĐT (bắt buộc với luồng OTP, optional với luồng email) ──────────────
    // sparse: true → cho phép nhiều user KHÔNG có SĐT
    // mà vẫn đảm bảo unique với những user có SĐT
    phone: {
      type:  String,
      trim:  true,
      match: [/^(0)(3[2-9]|5[6-9]|7[06-9]|8[0-9]|9[0-9])[0-9]{7}$/, 'Số điện thoại không hợp lệ'],
      unique: true,
      sparse: true,  // Cho phép nhiều user KHÔNG có SĐT
    },

    // SĐT đã được xác thực qua OTP chưa
    isPhoneVerified: {
      type:    Boolean,
      default: false,
    },

    address: {
      type: String,
      trim: true,
    },

    // Phân quyền người dùng
    role: {
      type: String,
      enum: {
        values: ['customer', 'staff', 'shipper', 'admin'],
        message: 'Role phải là customer, staff, shipper hoặc admin',
      },
      default: 'customer',
    },

    isActive: {
      type:    Boolean,
      default: true,
    },

    // Thời điểm đổi mật khẩu (dùng để invalidate token cũ)
    passwordChangedAt: Date,
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
    versionKey: false,
  }
);

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Trước khi lưu: Hash mật khẩu nếu mật khẩu vừa được thay đổi
 */
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Instance Methods ────────────────────────────────────────────────────────

/**
 * So sánh mật khẩu nhập vào với mật khẩu đã hash trong DB
 * @param {string} candidatePassword - Mật khẩu người dùng nhập
 * @returns {boolean}
 */
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Kiểm tra token có được cấp trước khi đổi mật khẩu không
 * @param {number} JWTTimestamp - Thời điểm JWT được cấp (iat)
 * @returns {boolean}
 */
UserSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// ─── Loại bỏ __v và password khi serialize ra JSON ──────────────────────────
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
