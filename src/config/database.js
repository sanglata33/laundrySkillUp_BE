/**
 * config/database.js — Kết nối MongoDB
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Mongoose 8.x không cần các option cũ nữa
    });

    console.log(`✅ MongoDB kết nối thành công: ${conn.connection.host}`);

    // Lắng nghe sự kiện mất kết nối
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB bị ngắt kết nối');
    });

    return conn;
  } catch (error) {
    console.error('❌ Kết nối MongoDB thất bại:', error.message);
    process.exit(1); // Thoát process nếu không kết nối được DB
  }
};

module.exports = connectDB;
