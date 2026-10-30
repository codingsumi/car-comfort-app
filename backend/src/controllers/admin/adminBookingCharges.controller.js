const adminBookingChargesService = require('../../services/admin/adminBookingCharges.service');

module.exports = {
  list: async function list(_req, res, next) {
    try {
      const rows = await adminBookingChargesService.listAdminBookingCharges();
      return res.success('Booking charges fetched', rows);
    } catch (err) {
      return next(err);
    }
  },

  create: async function create(req, res, next) {
    try {
      const row = await adminBookingChargesService.createAdminBookingCharge(req.body);
      return res.success('Booking charge created', row, 201);
    } catch (err) {
      return next(err);
    }
  },

  update: async function update(req, res, next) {
    try {
      const row = await adminBookingChargesService.updateAdminBookingCharge(req.params.id, req.body);
      return res.success('Booking charge updated', row);
    } catch (err) {
      return next(err);
    }
  },

  delete: async function deleteBookingCharge(req, res, next) {
    try {
      const row = await adminBookingChargesService.deleteAdminBookingCharge(req.params.id);
      return res.success('Booking charge deleted', row);
    } catch (err) {
      return next(err);
    }
  },
};
