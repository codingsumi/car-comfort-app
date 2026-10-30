const db = require('../models');

module.exports = {
  listCatalog: async function listCatalog(_req, res, next) {
    try {
      const services = await db.Service.findAll({
        attributes: ['id', 'name', 'icon'],
        order: [['id', 'ASC']]
      });

      return res.success(
        'Services fetched',
        services.map((s) => s.get({ plain: true }))
      );
    } catch (err) {
      return next(err);
    }
  }
};

