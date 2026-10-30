const express = require('express');
const multer = require('multer');

const { authMiddleware } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  createVehicleValidator,
  updateVehicleValidator,
  vehicleIdParamValidator
} = require('../validators/vehicle.validators');
const VehicleController = require('../controllers/vehicle.controller');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 20 }
});

const imageFields = upload.fields([
  { name: 'images', maxCount: 20 },
  { name: 'images[]', maxCount: 20 }
]);

router.post(
  '/',
  authMiddleware,
  imageFields,
  createVehicleValidator,
  validateRequest,
  VehicleController.create
);

router.get('/', authMiddleware, VehicleController.list);

router.get('/catalog', authMiddleware, VehicleController.catalog);

router.get(
  '/:id',
  authMiddleware,
  vehicleIdParamValidator,
  validateRequest,
  VehicleController.getById
);

router.patch(
  '/:id/default',
  authMiddleware,
  vehicleIdParamValidator,
  validateRequest,
  VehicleController.setDefault
);

router.put(
  '/:id',
  authMiddleware,
  imageFields,
  vehicleIdParamValidator,
  updateVehicleValidator,
  validateRequest,
  VehicleController.update
);

router.delete(
  '/:id',
  authMiddleware,
  vehicleIdParamValidator,
  validateRequest,
  VehicleController.remove
);

module.exports = router;
