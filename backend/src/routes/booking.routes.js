const express = require('express');
const multer = require('multer');
const { body, query, param } = require('express-validator');

const { authMiddleware } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');
const BookingController = require('../controllers/booking.controller');
const BookingDispatchController = require('../controllers/bookingDispatch.controller');
const BookingTrackingController = require('../controllers/bookingTracking.controller');
const DriverBookingNoShowController = require('../controllers/driverBookingNoShow.controller');
const BookingServiceImagesController = require('../controllers/bookingServiceImages.controller');
const BookingChatController = require('../controllers/bookingChat.controller');
const ReviewController = require('../controllers/review.controller');
const BookingTipController = require('../controllers/bookingTip.controller');
const { TRACKING_STATUSES_SET } = require('../modules/bookings/trackingStatuses');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 10 } });
const reviewImageFields = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'images[]', maxCount: 10 }
]);
const serviceImageFields = upload.fields([
  { name: 'images', maxCount: 20 },
  { name: 'images[]', maxCount: 20 }
]);

const SERVICE_TYPES = ['car_wash', 'ev_charging', 'combo'];
const SCHEDULE_TYPES = ['asap', 'scheduled', 'on_demand'];
const STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
const LIST_STATUSES = ['all', 'pending', 'pending_payment', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled'];

router.post(
  '/',
  authMiddleware,
  [
    body('service_type').isIn(SERVICE_TYPES).withMessage('Invalid service_type'),
    body('package_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('package_id must be a positive integer'),
    body('custom_package_name')
      .optional({ nullable: true })
      .isString()
      .isLength({ min: 1, max: 160 })
      .withMessage('custom_package_name must be 1-160 chars'),
    body('custom_price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('custom_price must be >= 0'),
    body('addons').optional().isArray().withMessage('addons must be an array'),
    body('addons.*').optional().isInt({ min: 1 }).withMessage('addon id must be a positive integer'),
    body('schedule_type').optional({ nullable: true }).isIn(SCHEDULE_TYPES).withMessage('Invalid schedule_type'),
    body('scheduled_at').optional({ nullable: true }).isISO8601().withMessage('scheduled_at must be a valid datetime'),
    body('service_address').optional({ nullable: true }).isString().withMessage('service_address must be a string'),
    body('service_latitude')
      .optional({ nullable: true })
      .isFloat({ min: -90, max: 90 })
      .withMessage('service_latitude must be -90..90'),
    body('service_longitude')
      .optional({ nullable: true })
      .isFloat({ min: -180, max: 180 })
      .withMessage('service_longitude must be -180..180'),
    body().custom((v) => {
      const hasPackage = !!v.package_id;
      const hasCustom = !!(v.custom_package_name && v.custom_price !== undefined && v.custom_price !== null && v.custom_price !== '');
      if (!hasPackage && !hasCustom) {
        throw new Error('Either package_id or (custom_package_name + custom_price) is required');
      }
      if (hasPackage && (v.custom_package_name || v.custom_price !== undefined)) {
        throw new Error('Provide either package_id or custom_package fields, not both');
      }

      const serviceLatProvided = v.service_latitude !== undefined && v.service_latitude !== null && v.service_latitude !== '';
      const serviceLngProvided = v.service_longitude !== undefined && v.service_longitude !== null && v.service_longitude !== '';
      if (serviceLatProvided !== serviceLngProvided) {
        throw new Error('Either both (service_latitude and service_longitude) are required');
      }

      const scheduleType = v.schedule_type === null ? null : v.schedule_type ? String(v.schedule_type).trim() : null;
      const scheduledAt = v.scheduled_at === null ? null : v.scheduled_at ? String(v.scheduled_at).trim() : null;

      // Both can be nullable, but must be coherent:
      // - At least one must be provided
      // - No scheduled_at without schedule_type
      // - If schedule_type is 'scheduled' then scheduled_at is required
      if (!scheduleType && !scheduledAt) throw new Error('Either schedule_type or scheduled_at is required');
      if (!scheduleType && scheduledAt) throw new Error('schedule_type is required when scheduled_at is provided');
      if (scheduleType === 'scheduled' && !scheduledAt) throw new Error('scheduled_at is required when schedule_type is scheduled');
      return true;
    })
  ],
  validateRequest,
  BookingController.create
);

router.get(
  '/',
  authMiddleware,
  [
    query('status').optional().trim().toLowerCase().isIn(LIST_STATUSES).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
    query('origin_lat').optional().isFloat({ min: -90, max: 90 }).withMessage('origin_lat must be -90..90'),
    query('origin_lng').optional().isFloat({ min: -180, max: 180 }).withMessage('origin_lng must be -180..180'),
    query('origin_latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('origin_latitude must be -90..90'),
    query('origin_longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('origin_longitude must be -180..180'),
    query('page_size').not().exists().withMessage('Use limit instead of page_size')
  ],
  validateRequest,
  BookingController.list
);

router.get(
  '/active',
  authMiddleware,
  validateRequest,
  BookingController.getActive
);

router.get(
  '/:id/invoice.pdf',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validateRequest,
  BookingController.downloadInvoice
);

router.get(
  '/:id',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validateRequest,
  BookingController.getById
);

router.get(
  '/:id/chat/session',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validateRequest,
  BookingChatController.session
);

router.get(
  '/:id/chat/transcript',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validateRequest,
  BookingChatController.transcript
);

router.post(
  '/:id/chat/notify',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('message_id').isString().trim().notEmpty().isLength({ max: 128 }).withMessage('message_id is required and must be <= 128 chars'),
    body('message').optional({ nullable: true }).isString().isLength({ max: 4000 }).withMessage('message must be <= 4000 chars')
  ],
  validateRequest,
  BookingChatController.notify
);

router.get(
  '/:id/reviews',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validateRequest,
  ReviewController.getBookingReviews
);

router.post(
  '/:id/reviews',
  authMiddleware,
  reviewImageFields,
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('rating must be 1-5'),
    body('message').optional({ nullable: true }).isString().isLength({ max: 2000 }).withMessage('message must be <= 2000 chars'),
    body('is_satisfied').optional({ nullable: true }).isBoolean().withMessage('is_satisfied must be boolean')
  ],
  validateRequest,
  ReviewController.postBookingReview
);

router.get(
  '/:id/tip',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validateRequest,
  BookingTipController.getBookingTip
);

router.post(
  '/:id/tip',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('amount').isFloat({ min: 1, max: 500 }).withMessage('amount must be between 1 and 500'),
    body('payment_method_id').optional({ nullable: true }).isString().isLength({ min: 1, max: 255 })
  ],
  validateRequest,
  BookingTipController.postBookingTip
);

router.post(
  '/:id/cancel',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('reason')
      .notEmpty()
      .withMessage('reason is required')
      .isString()
      .isLength({ min: 1, max: 2000 })
      .withMessage('reason must be 1-2000 chars')
  ],
  validateRequest,
  BookingController.cancel
);

router.post(
  '/:id/accept',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validateRequest,
  BookingController.accept
);

router.post(
  '/:id/reject',
  authMiddleware,
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validateRequest,
  BookingController.reject
);

router.post(
  '/:id/status',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('status')
      .isString()
      .trim()
      .notEmpty()
      .custom((value) => {
        const u = String(value || '').trim().toUpperCase();
        if (!['ENROUTE', 'ARRIVED'].includes(u)) {
          throw new Error('Invalid status — use ENROUTE or ARRIVED');
        }
        return true;
      })
  ],
  validateRequest,
  BookingDispatchController.postStatus
);

router.post(
  '/:id/service-images/before',
  authMiddleware,
  serviceImageFields,
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validateRequest,
  BookingServiceImagesController.postBeforeServiceImages
);

router.post(
  '/:id/service-images/after',
  authMiddleware,
  serviceImageFields,
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validateRequest,
  BookingServiceImagesController.postAfterServiceImages
);

router.post(
  '/:id/tracking-status',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('tracking_status')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('tracking_status is required')
      .custom((value) => {
        const normalized = String(value || '').trim().toUpperCase();
        if (!TRACKING_STATUSES_SET.has(normalized)) {
          throw new Error('Invalid tracking_status');
        }
        return true;
      })
  ],
  validateRequest,
  BookingTrackingController.postTrackingStatus
);

router.post(
  '/:id/verify-otp',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('otp')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('otp is required')
      .isLength({ min: 4, max: 4 })
      .withMessage('OTP must be exactly 4 digits')
      .isNumeric()
      .withMessage('OTP must contain only digits')
  ],
  validateRequest,
  BookingTrackingController.postVerifyOtp
);

router.post(
  '/:id/customer-no-show',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('reason').optional().isString().isLength({ max: 2000 }).withMessage('reason max 2000 chars'),
  ],
  validateRequest,
  DriverBookingNoShowController.postCustomerNoShow
);

router.patch(
  '/:id/status',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('status').isIn(STATUSES).withMessage('Invalid status')
  ],
  validateRequest,
  BookingController.patchStatus
);

router.post(
  '/:bookingId/dispute',
  authMiddleware,
  [
    param('bookingId').isInt({ min: 1 }).withMessage('bookingId must be a positive integer'),
    body('complaint')
      .notEmpty().withMessage('complaint is required')
      .isString()
      .isLength({ min: 1, max: 1000 }).withMessage('complaint must be 1-1000 chars'),
  ],
  validateRequest,
  (req, res, next) => {
    req.params.id = req.params.bookingId;
    return BookingController.raiseDispute(req, res, next);
  }
);

module.exports = router;

