const express = require('express');
const { body } = require('express-validator');

const { authMiddleware } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');
const RefundController = require('../controllers/refund.controller');

const router = express.Router();

router.post(
  '/',
  authMiddleware,
  [
    body('booking_transaction_id').isInt({ min: 1 }).withMessage('booking_transaction_id is required'),
    body('reason').optional({ nullable: true }).isString().withMessage('reason must be a string')
  ],
  validateRequest,
  RefundController.requestRefund
);

router.get('/', authMiddleware, RefundController.listRefundRequests);

module.exports = router;

