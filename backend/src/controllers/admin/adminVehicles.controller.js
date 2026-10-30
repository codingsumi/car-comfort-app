const adminVehiclesService = require('../../services/admin/adminVehicles.service');

module.exports = {
  getSummary: adminVehiclesService.getSummary,
  listVehicles: adminVehiclesService.listVehicles,
  getVehicleById: adminVehiclesService.getVehicleById,
  patchVehicleStatus: adminVehiclesService.patchVehicleStatus,
  removeVehicle: adminVehiclesService.removeVehicle,
  deleteVehicleImage: adminVehiclesService.deleteVehicleImage,
  flagVehicleImage: adminVehiclesService.flagVehicleImage,
  createVehicleFlag: adminVehiclesService.createVehicleFlag,
  patchVehicleFlag: adminVehiclesService.patchVehicleFlag,
  unflagVehicle: adminVehiclesService.unflagVehicle,
  listFlaggedVehicles: adminVehiclesService.listFlaggedVehicles,
};
