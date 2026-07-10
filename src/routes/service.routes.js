/**
 * routes/service.routes.js — Định nghĩa routes dịch vụ giặt ủi
 */

const express = require('express');
const router  = express.Router();

const serviceController = require('../controllers/service.controller');
const { protect }       = require('../middlewares/auth.middleware');
const { restrictTo }    = require('../middlewares/role.middleware');

// Public — bất kỳ ai cũng xem được danh sách dịch vụ
router.get('/',    serviceController.getAllServices);
router.get('/:id', serviceController.getServiceById);

// Chỉ Admin — quản lý dịch vụ
router.post('/',    protect, restrictTo('admin'), serviceController.createService);
router.put('/:id',  protect, restrictTo('admin'), serviceController.updateService);
router.delete('/:id', protect, restrictTo('admin'), serviceController.deleteService);

module.exports = router;
