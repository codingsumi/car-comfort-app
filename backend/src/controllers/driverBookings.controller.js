const { listNearbyUnassignedBookings } = require('../services/driverNearbyUnassignedBookings.service');
const { updateServiceLocationByDriver } = require('../services/driverBookingLocation.service');

async function listNearbyUnassigned(req, res, next) {
  try {
    const auth = req.auth || {};
    const data = await listNearbyUnassignedBookings({ auth, query: req.query });
    return res.success('Nearby unassigned bookings fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function patchServiceLocation(req, res, next) {
  try {
    const data = await updateServiceLocationByDriver({
      bookingId: req.params.id,
      auth: req.auth || {},
      body: req.body
    });
    return res.success('Service location updated', data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { listNearbyUnassigned, patchServiceLocation };
