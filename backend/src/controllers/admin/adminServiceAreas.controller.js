const db = require('../../models');
const serviceAreaService = require('../../services/serviceArea.service');
const { HttpError } = require('../../utils/httpError');

async function listServiceAreas(req, res, next) {
  try {
    const areas = await serviceAreaService.listServiceAreas(db);
    return res.success('Service areas fetched', areas);
  } catch (err) {
    return next(err);
  }
}

async function createServiceArea(req, res, next) {
  try {
    const area = await serviceAreaService.createServiceArea(db, req.body);
    return res.success('Service area created', area, 201);
  } catch (err) {
    return next(err);
  }
}

async function updateServiceArea(req, res, next) {
  try {
    const area = await serviceAreaService.updateServiceArea(db, req.params.id, req.body);
    if (!area) throw new HttpError(404, 'Service area not found');
    return res.success('Service area updated', area);
  } catch (err) {
    return next(err);
  }
}

async function deleteServiceArea(req, res, next) {
  try {
    const deleted = await serviceAreaService.deleteServiceArea(db, req.params.id);
    if (!deleted) throw new HttpError(404, 'Service area not found');
    return res.success('Service area deleted');
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listServiceAreas,
  createServiceArea,
  updateServiceArea,
  deleteServiceArea,
};
