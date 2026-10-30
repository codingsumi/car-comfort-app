const adminVehicleTypesService = require('../../services/admin/adminVehicleTypes.service');

module.exports = {
  list: async function list(req, res, next) {
    try {
      if (req.query.all === 'true') {
        const rows = await adminVehicleTypesService.listAdminVehicleTypesAll({
          status: req.query.status || undefined,
        });
        return res.success('Vehicle types fetched', rows);
      }

      const data = await adminVehicleTypesService.listAdminVehicleTypes(req.query);
      return res.success('Vehicle types fetched', data);
    } catch (err) {
      return next(err);
    }
  },

  create: async function create(req, res, next) {
    try {
      const row = await adminVehicleTypesService.createAdminVehicleType(req.body);
      return res.success('Vehicle type created', row, 201);
    } catch (err) {
      return next(err);
    }
  },

  update: async function update(req, res, next) {
    try {
      const row = await adminVehicleTypesService.updateAdminVehicleType(req.params.id, req.body);
      return res.success('Vehicle type updated', row);
    } catch (err) {
      return next(err);
    }
  },

  remove: async function remove(req, res, next) {
    try {
      const result = await adminVehicleTypesService.deleteAdminVehicleType(req.params.id);
      return res.success('Vehicle type deactivated', result);
    } catch (err) {
      return next(err);
    }
  },
};
