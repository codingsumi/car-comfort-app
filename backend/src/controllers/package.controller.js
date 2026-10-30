const { listPackagesByService, getPackageDetails } = require('../services/package.service');

async function list(req, res, next) {
  try {
    const service = req.query.service;
    const data = await listPackagesByService({ serviceType: service, query: req.query });
    return res.success('Packages fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const row = await getPackageDetails(req.params.id);
    return res.success('Package fetched', row);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  getById
};

