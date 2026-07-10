/**
 * routes/auth.routes.js — Định nghĩa routes xác thực (v3)
 *
 * Thêm:
 *  - POST /send-otp    → Gửi mã OTP tới SĐT
 *  - POST /verify-otp  → Xác thực OTP và cấp JWT token
 */

const express = require('express');
const router  = express.Router();

const authController                              = require('../controllers/auth.controller');
const { protect }                                 = require('../middlewares/auth.middleware');
const { sendOtpLimiter, verifyOtpLimiter }       = require('../middlewares/rateLimiter.middleware');

// ── OTP Authentication (SĐT + OTP, không cần password) ──────────────────────
//
//  Luồng:
//    1. POST /send-otp   → Nhập SĐT → Server gửi OTP
//    2. POST /verify-otp → Nhập OTP → Server cấp JWT
//
router.post('/send-otp',    sendOtpLimiter,   authController.sendOtp);
router.post('/verify-otp',  verifyOtpLimiter, authController.verifyOtp);

// ── Email + Password Authentication (admin/staff) ────────────────────────────
router.post('/register',      authController.register);
router.post('/login',         authController.login);

// Refresh Token — FE gọi khi access token hết hạn (cookie được gửi tự động)
router.post('/refresh-token', authController.refreshToken);

// ── Protected routes ─────────────────────────────────────────────────────────
router.post('/logout',        protect, authController.logout);
router.get('/me',             protect, authController.getMe);
router.put('/me',             protect, authController.updateProfile);

module.exports = router;

