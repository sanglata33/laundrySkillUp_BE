require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/config/database');
const User = require('./src/models/User.model');
const Service = require('./src/models/Service.model');
const Order = require('./src/models/Order.model');

const seed = async () => {
  try {
    await connectDB();
    console.log('Clearing database...');
    await User.deleteMany({});
    await Service.deleteMany({});
    await Order.deleteMany({});

    console.log('Seeding users...');
    // Create admin
    const admin = await User.create({
      name: 'Quản trị viên',
      email: 'admin@freshwash.com',
      password: 'password123',
      role: 'admin',
      isActive: true,
      phone: '0987654321',
      isPhoneVerified: true
    });

    // Create staff
    const staff1 = await User.create({
      name: 'Nguyen Nhan Vien 1',
      email: 'staff1@freshwash.com',
      password: 'password123',
      role: 'staff',
      isActive: true,
      phone: '0912345678',
      isPhoneVerified: true
    });

    const staff2 = await User.create({
      name: 'Tran Nhan Vien 2',
      email: 'staff2@freshwash.com',
      password: 'password123',
      role: 'staff',
      isActive: true,
      phone: '0934567890',
      isPhoneVerified: true
    });

    // Create customers
    const customer1 = await User.create({
      name: 'Nguyen Van A',
      email: 'customer1@gmail.com',
      password: 'password123',
      role: 'customer',
      isActive: true,
      phone: '0901234567',
      isPhoneVerified: true,
      address: '123 Nguyen Trai, Q5, TP.HCM'
    });

    const customer2 = await User.create({
      name: 'Tran Thi B',
      email: 'customer2@gmail.com',
      password: 'password123',
      role: 'customer',
      isActive: true,
      phone: '0977654321',
      isPhoneVerified: true,
      address: '456 Le Loi, Q1, TP.HCM'
    });

    const customer3 = await User.create({
      name: 'Le Van Khoa (Locked)',
      email: 'customer3@gmail.com',
      password: 'password123',
      role: 'customer',
      isActive: false,
      phone: '0907654321',
      isPhoneVerified: true,
      address: '789 Tran Hung Dao, Q1, TP.HCM'
    });

    console.log('Seeding services...');
    const service1 = await Service.create({
      name: 'Giặt sấy sấy tiêu chuẩn',
      description: 'Giặt sạch sấy khô thơm tho tính theo kg',
      priceType: 'per_kg',
      price: 25000,
      estimatedHours: 24,
      isActive: true
    });

    const service2 = await Service.create({
      name: 'Giặt hấp áo vest',
      description: 'Giặt hấp cao cấp cho áo vest nam/nữ',
      priceType: 'per_item',
      price: 80000,
      estimatedHours: 48,
      isActive: true
    });

    const service3 = await Service.create({
      name: 'Giặt giày sneaker',
      description: 'Giặt và sấy khô chuyên dụng cho giày thể thao',
      priceType: 'per_item',
      price: 50000,
      estimatedHours: 36,
      isActive: true
    });

    console.log('Seeding orders...');
    // Create orders and save to let pre-save create codes and base history
    const o1 = await Order.create({
      customer: customer1._id,
      service: service1._id,
      quantity: 5,
      totalPrice: 125000,
      pickupAddress: '123 Nguyen Trai, Q5, TP.HCM',
      deliveryAddress: '123 Nguyen Trai, Q5, TP.HCM'
    });

    const o2 = await Order.create({
      customer: customer2._id,
      service: service2._id,
      quantity: 2,
      totalPrice: 160000,
      pickupAddress: '456 Le Loi, Q1, TP.HCM',
      deliveryAddress: '456 Le Loi, Q1, TP.HCM'
    });

    const o3 = await Order.create({
      customer: customer1._id,
      service: service3._id,
      quantity: 1,
      totalPrice: 50000,
      pickupAddress: '123 Nguyen Trai, Q5, TP.HCM',
      deliveryAddress: '123 Nguyen Trai, Q5, TP.HCM'
    });

    // Update o2 and o3 to progress them
    o2.status = 'washing';
    o2.staff = staff1._id;
    o2.statusHistory.push({
      status: 'washing',
      note: 'Bắt đầu giặt hấp',
      updatedBy: staff1._id,
      timestamp: new Date()
    });
    await o2.save();

    o3.status = 'completed';
    o3.staff = staff2._id;
    o3.completedAt = new Date();
    o3.statusHistory.push(
      {
        status: 'washing',
        note: 'Bắt đầu giặt',
        updatedBy: staff2._id,
        timestamp: new Date(Date.now() - 3600000 * 3)
      },
      {
        status: 'drying',
        note: 'Đang sấy khô',
        updatedBy: staff2._id,
        timestamp: new Date(Date.now() - 3600000 * 2)
      },
      {
        status: 'delivering',
        note: 'Đang giao hàng',
        updatedBy: staff2._id,
        timestamp: new Date(Date.now() - 3600000 * 1)
      },
      {
        status: 'completed',
        note: 'Đã giao hàng và hoàn thành thanh toán',
        updatedBy: staff2._id,
        timestamp: new Date()
      }
    );
    await o3.save();

    console.log('\n=========================================');
    console.log('Database seeded successfully!');
    console.log('Created accounts:');
    console.log(' - Admin:    admin@freshwash.com / password123');
    console.log(' - Staff 1:  staff1@freshwash.com / password123');
    console.log(' - Staff 2:  staff2@freshwash.com / password123');
    console.log(' - Customer: customer1@gmail.com / password123');
    console.log(' - Customer: customer2@gmail.com / password123');
    console.log('=========================================\n');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
};

seed();
