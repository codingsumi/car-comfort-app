const { body, param, query } = require('express-validator');

const manualPayoutValidator = [
  body('provider_id')
    .isInt({ min: 1 })
    .withMessage('Valid provider_id is required'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string'),
];

const transactionIdValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid transaction ID is required'),
];

const payoutIdValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid payout ID is required'),
];

const providerIdValidator = [
  param('providerId')
    .isInt({ min: 1 })
    .withMessage('Valid provider ID is required'),
];

const exportQueryValidator = [
  query('type')
    .isIn(['revenue', 'refunds', 'payouts', 'taxes', 'commissions'])
    .withMessage('Valid report type is required'),
];

module.exports = {
  manualPayoutValidator,
  transactionIdValidator,
  payoutIdValidator,
  providerIdValidator,
  exportQueryValidator,
};
