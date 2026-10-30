const express = require('express');

const VehicleTypeController = require('../controllers/vehicleType.controller');

const router = express.Router();

/** Public catalog for mobile apps — active types only */
router.get('/', VehicleTypeController.listPublic);

module.exports = router;
