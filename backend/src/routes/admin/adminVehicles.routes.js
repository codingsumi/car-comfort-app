const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const {
  getSummary,
  listVehicles,
  getVehicleById,
  patchVehicleStatus,
  removeVehicle,
  deleteVehicleImage,
  flagVehicleImage,
  createVehicleFlag,
  patchVehicleFlag,
  unflagVehicle,
  listFlaggedVehicles,
} = require('../../controllers/admin/adminVehicles.controller');

router.get('/vehicles/summary', adminAuth, getSummary);
router.get('/vehicles/flagged', adminAuth, listFlaggedVehicles);
router.get('/vehicles', adminAuth, listVehicles);
router.patch('/vehicles/flags/:flagId', adminAuth, patchVehicleFlag);
router.get('/vehicles/:id', adminAuth, getVehicleById);
router.patch('/vehicles/:id/status', adminAuth, patchVehicleStatus);
router.delete('/vehicles/:id', adminAuth, removeVehicle);
router.delete('/vehicles/:id/images/:imageId', adminAuth, deleteVehicleImage);
router.patch('/vehicles/:id/images/:imageId/flag', adminAuth, flagVehicleImage);
router.post('/vehicles/:id/flag', adminAuth, createVehicleFlag);
router.post('/vehicles/:id/unflag', adminAuth, unflagVehicle);

module.exports = router;
