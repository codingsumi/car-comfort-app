const db = require('../models');

async function logVehicleActivity({ vehicleId, activityType, actorType, actorId, metadata }, { transaction } = {}) {
  await db.VehicleActivityLog.create(
    {
      vehicle_id: vehicleId,
      activity_type: activityType,
      actor_type: actorType,
      actor_id: actorId || null,
      metadata: metadata || null
    },
    { transaction }
  );
}

module.exports = { logVehicleActivity };
