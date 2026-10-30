const { listApplicableBookingCharges } = require('../services/bookingCharges.service');
const { APPLICABILITY_LABELS } = require('../constants/bookingChargeApplicability');

async function listApplicable(req, res, next) {
  try {
    const serviceType = String(req.query.service_type || req.query.serviceType || '').trim();
    if (!serviceType) {
      return res.fail('service_type query parameter is required', 400);
    }

    const rows = await listApplicableBookingCharges(serviceType);
    const charges = rows.map((row) => ({
      code: row.code,
      label: row.label,
      amount: row.amount,
      service_applicability: row.service_applicability,
      service_applicability_label: APPLICABILITY_LABELS[row.service_applicability] || row.service_applicability,
    }));

    return res.success('Applicable booking charges fetched', {
      service_type: serviceType,
      charges,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listApplicable };
