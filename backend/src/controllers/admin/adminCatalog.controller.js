const adminCatalogService = require('../../services/admin/adminCatalog.service');

module.exports = {
  listServices: async function listServices(_req, res, next) {
    try {
      const services = await adminCatalogService.listAdminServices();
      return res.success('Services fetched', services);
    } catch (err) {
      return next(err);
    }
  },

  patchService: async function patchService(req, res, next) {
    try {
      const service = await adminCatalogService.patchAdminService(req.params.id, req.body);
      return res.success('Service updated', service);
    } catch (err) {
      return next(err);
    }
  },

  listPackages: async function listPackages(req, res, next) {
    try {
      const data = await adminCatalogService.listAdminPackages(req.query);
      return res.success('Packages fetched', data);
    } catch (err) {
      return next(err);
    }
  },

  createPackage: async function createPackage(req, res, next) {
    try {
      const pkg = await adminCatalogService.createAdminPackage(req.body);
      return res.success('Package created', pkg, 201);
    } catch (err) {
      return next(err);
    }
  },

  updatePackage: async function updatePackage(req, res, next) {
    try {
      const pkg = await adminCatalogService.updateAdminPackage(req.params.id, req.body);
      return res.success('Package updated', pkg);
    } catch (err) {
      return next(err);
    }
  },

  deletePackage: async function deletePackage(req, res, next) {
    try {
      const result = await adminCatalogService.deleteAdminPackage(req.params.id);
      return res.success('Package deleted', result);
    } catch (err) {
      return next(err);
    }
  },
};
