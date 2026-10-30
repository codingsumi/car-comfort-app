'use strict';

const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const { validateRequest } = require('../../middlewares/validateRequest');
const {
  list,
  show,
  create,
  update,
  toggle,
  remove,
  notifyCustomers,
} = require('../../controllers/admin/adminPromotions.controller');
const {
  promotionCreateValidator,
  promotionUpdateValidator,
  promotionIdValidator,
} = require('../../validators/promotions.validator');

router.get('/promotions', adminAuth, list);
router.get('/promotions/:id', adminAuth, promotionIdValidator, validateRequest, show);
router.post('/promotions', adminAuth, promotionCreateValidator, validateRequest, create);
router.patch('/promotions/:id', adminAuth, promotionUpdateValidator, validateRequest, update);
router.post('/promotions/:id/toggle', adminAuth, promotionIdValidator, validateRequest, toggle);
router.delete('/promotions/:id', adminAuth, promotionIdValidator, validateRequest, remove);
router.post('/promotions/:id/notify', adminAuth, promotionIdValidator, validateRequest, notifyCustomers);

module.exports = router;
