const express = require('express');

const { authMiddleware } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  addCardValidator,
  setDefaultCardValidator,
  removeCardValidator,
  createSetupIntentValidator,
} = require('../validators/payment.validators');
const {
  addCard,
  getCards,
  setDefault,
  remove,
  getStripeConfigPublic,
  createSetupIntent,
} = require('../controllers/payment.controller');

const router = express.Router();

router.get('/stripe-config', getStripeConfigPublic);
router.post(
  '/setup-intent',
  authMiddleware,
  createSetupIntentValidator,
  validateRequest,
  createSetupIntent
);
router.post('/add-card', authMiddleware, addCardValidator, validateRequest, addCard);
router.get('/cards', authMiddleware, getCards);
router.post('/set-default-card', authMiddleware, setDefaultCardValidator, validateRequest, setDefault);
router.delete('/remove-card/:id', authMiddleware, removeCardValidator, validateRequest, remove);

module.exports = router;

