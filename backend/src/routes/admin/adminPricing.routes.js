const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const { validateRequest } = require('../../middlewares/validateRequest');
const {
  listPricingRules,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
} = require('../../controllers/admin/adminPricing.controller');
const {
  pricingRuleValidator,
  pricingUpdateValidator,
  pricingIdValidator,
} = require('../../validators/pricing.validator');

router.get('/pricing', adminAuth, listPricingRules);
router.post('/pricing', adminAuth, pricingRuleValidator, validateRequest, createPricingRule);
router.patch('/pricing/:id', adminAuth, pricingUpdateValidator, validateRequest, updatePricingRule);
router.delete('/pricing/:id', adminAuth, pricingIdValidator, validateRequest, deletePricingRule);

module.exports = router;
