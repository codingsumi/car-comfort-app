const express = require('express');
const { body, query, param } = require('express-validator');

const { authMiddleware } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');
const NotificationsController = require('../controllers/notifications.controller');

const router = express.Router();

router.post(
  '/register-device',
  authMiddleware,
  [
    body('onesignal_id').isString().trim().notEmpty().withMessage('onesignal_id is required'),
    body('platform').isString().trim().notEmpty().withMessage('platform is required')
  ],
  validateRequest,
  NotificationsController.postRegisterDevice
);

router.get(
  '/',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be 1-50')
  ],
  validateRequest,
  NotificationsController.getList
);

router.post(
  '/welcome',
  authMiddleware,
  [
    body('title').isString().trim().notEmpty().withMessage('title is required'),
    body('message').isString().trim().notEmpty().withMessage('message is required')
  ],
  validateRequest,
  NotificationsController.postWelcome
);

router.delete(
  '/',
  authMiddleware,
  NotificationsController.deleteAll
);

router.delete(
  '/:id',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validateRequest,
  NotificationsController.deleteOne
);

module.exports = router;
