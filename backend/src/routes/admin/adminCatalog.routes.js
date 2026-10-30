const express = require('express');
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const { validateRequest } = require('../../middlewares/validateRequest');
const adminCatalogController = require('../../controllers/admin/adminCatalog.controller');
const {
  createPackageValidator,
  updatePackageValidator,
  listPackagesValidator,
  patchServiceValidator,
  packageIdParam,
} = require('../../validators/adminCatalog.validator');

const router = express.Router();

router.get('/services', adminAuth, adminCatalogController.listServices);
router.patch(
  '/services/:id',
  adminAuth,
  patchServiceValidator,
  validateRequest,
  adminCatalogController.patchService
);

router.get(
  '/packages',
  adminAuth,
  listPackagesValidator,
  validateRequest,
  adminCatalogController.listPackages
);
router.post(
  '/packages',
  adminAuth,
  createPackageValidator,
  validateRequest,
  adminCatalogController.createPackage
);
router.patch(
  '/packages/:id',
  adminAuth,
  updatePackageValidator,
  validateRequest,
  adminCatalogController.updatePackage
);
router.delete(
  '/packages/:id',
  adminAuth,
  packageIdParam,
  validateRequest,
  adminCatalogController.deletePackage
);

module.exports = router;
