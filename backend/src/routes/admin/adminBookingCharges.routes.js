const express = require('express');
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const { validateRequest } = require('../../middlewares/validateRequest');
const adminBookingChargesController = require('../../controllers/admin/adminBookingCharges.controller');
const {
  createBookingChargeValidator,
  updateBookingChargeValidator,
  deleteBookingChargeValidator,
} = require('../../validators/bookingCharge.validator');

const router = express.Router();

router.get('/booking-charges', adminAuth, adminBookingChargesController.list);
router.post(
  '/booking-charges',
  adminAuth,
  createBookingChargeValidator,
  validateRequest,
  adminBookingChargesController.create
);
router.patch(
  '/booking-charges/:id',
  adminAuth,
  updateBookingChargeValidator,
  validateRequest,
  adminBookingChargesController.update
);
router.delete(
  '/booking-charges/:id',
  adminAuth,
  deleteBookingChargeValidator,
  validateRequest,
  adminBookingChargesController.delete
);

module.exports = router;
