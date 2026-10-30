const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const {
  listCustomers,
  getCustomer,
  updateCustomerStatus,
  updateCustomerProfile,
  resetCustomerPassword,
  getCustomerLoginHistory,
} = require('../../controllers/admin/adminCustomers.controller');

router.get('/customers', adminAuth, listCustomers);
router.get('/customers/:id', adminAuth, getCustomer);
router.patch('/customers/:id/status', adminAuth, updateCustomerStatus);
router.patch('/customers/:id/profile', adminAuth, updateCustomerProfile);
router.post('/customers/:id/reset-password', adminAuth, resetCustomerPassword);
router.get('/customers/:id/login-history', adminAuth, getCustomerLoginHistory);

module.exports = router;
