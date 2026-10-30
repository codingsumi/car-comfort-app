const { body, param } = require('express-validator');

const paymentMethodIdValidator = body('payment_method_id')
  .isString()
  .withMessage('payment_method_id must be a string')
  .notEmpty()
  .withMessage('payment_method_id is required');

const removePaymentMethodIdParamValidator = param('id')
  .isString()
  .withMessage('id must be a string')
  .notEmpty()
  .withMessage('id is required');

const SETUP_INTENT_CATEGORIES = new Set([
  'card',
  'debit',
  'credit',
  'paypal',
  'venmo',
  'apple_pay',
  'google_pay',
  'wallet',
]);

const createSetupIntentValidator = [
  body('category')
    .optional({ nullable: true })
    .isString()
    .withMessage('category must be a string')
    .custom((value) => {
      const key = String(value || 'card').trim().toLowerCase();
      if (!SETUP_INTENT_CATEGORIES.has(key)) {
        throw new Error(`category must be one of: ${[...SETUP_INTENT_CATEGORIES].join(', ')}`);
      }
      return true;
    }),
];

module.exports = {
  addCardValidator: [paymentMethodIdValidator],
  setDefaultCardValidator: [paymentMethodIdValidator],
  removeCardValidator: [removePaymentMethodIdParamValidator],
  createSetupIntentValidator,
};

