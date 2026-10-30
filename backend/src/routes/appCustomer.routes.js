'use strict';

const { Router } = require('express');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { getCustomerActiveBooking } = require('../controllers/app/activeBookingController');

const router = Router();

// Lightweight payload used by the customer's Active Booking dashboard tab.
router.get('/active-booking', authMiddleware, getCustomerActiveBooking);

module.exports = router;
