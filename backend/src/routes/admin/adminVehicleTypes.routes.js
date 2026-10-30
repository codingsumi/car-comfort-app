const express = require('express');
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const { validateRequest } = require('../../middlewares/validateRequest');
const adminVehicleTypesController = require('../../controllers/admin/adminVehicleTypes.controller');
const {
  createVehicleTypeValidator,
  updateVehicleTypeValidator,
  vehicleTypeIdParamValidator,
  listVehicleTypesValidator,
} = require('../../validators/vehicleType.validators');

const router = express.Router();

router.get(
  '/vehicle-types',
  adminAuth,
  listVehicleTypesValidator,
  validateRequest,
  adminVehicleTypesController.list
);
router.post(
  '/vehicle-types',
  adminAuth,
  createVehicleTypeValidator,
  validateRequest,
  adminVehicleTypesController.create
);
router.patch(
  '/vehicle-types/:id',
  adminAuth,
  vehicleTypeIdParamValidator,
  updateVehicleTypeValidator,
  validateRequest,
  adminVehicleTypesController.update
);
router.delete(
  '/vehicle-types/:id',
  adminAuth,
  vehicleTypeIdParamValidator,
  validateRequest,
  adminVehicleTypesController.remove
);

module.exports = router;
