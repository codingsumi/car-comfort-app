const express = require('express');
const multer = require('multer');

const { authMiddleware } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');
const BookingV2Controller = require('../controllers/bookingV2.controller');
const BookingChargesController = require('../controllers/bookingCharges.controller');
const {
  startBookingValidation,
  locationUpdateValidation,
  serviceDetailsValidation,
  vehicleDetailsValidation,
  bookingIdParamValidation,
  confirmValidation
} = require('../validations/bookingV2.validation');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 20 }
});

const imageFields = upload.fields([
  { name: 'images', maxCount: 20 },
  { name: 'images[]', maxCount: 20 }
]);

router.get(
  '/charges/applicable',
  authMiddleware,
  BookingChargesController.listApplicable
);
router.get('/ev-charging/options', authMiddleware, BookingV2Controller.evChargingOptions);
router.post('/start', authMiddleware, startBookingValidation, validateRequest, BookingV2Controller.start);
router.put(
  '/:id/location',
  authMiddleware,
  locationUpdateValidation,
  validateRequest,
  BookingV2Controller.putLocation
);
router.put('/:id/service', authMiddleware, serviceDetailsValidation, validateRequest, BookingV2Controller.putService);
router.put(
  '/:id/vehicle',
  authMiddleware,
  imageFields,
  vehicleDetailsValidation,
  validateRequest,
  BookingV2Controller.putVehicle
);
router.post(
  '/:id/images',
  authMiddleware,
  imageFields,
  bookingIdParamValidation,
  validateRequest,
  BookingV2Controller.postImages
);
router.get('/:id/review', authMiddleware, bookingIdParamValidation, validateRequest, BookingV2Controller.review);
router.post('/:id/confirm', authMiddleware, confirmValidation, validateRequest, BookingV2Controller.confirm);

module.exports = router;

