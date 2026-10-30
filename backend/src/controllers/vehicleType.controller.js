const db = require('../models');

async function listPublic(req, res, next) {
  try {
    const rows = await db.VehicleType.findAll({
      where: { status: 'active' },
      attributes: ['id', 'name', 'charges'],
      order: [['name', 'ASC']],
    });

    const data = rows.map((r) => r.get({ plain: true }));
    return res.success('Vehicle types fetched', data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listPublic,
};

