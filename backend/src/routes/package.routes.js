const express = require('express');
const { query, param } = require('express-validator');

const PackageController = require('../controllers/package.controller');
const { validateRequest } = require('../middlewares/validateRequest');

const router = express.Router();

router.get(
  '/',
  [
    query('service').isIn(['car_wash', 'ev_charging', 'combo']).withMessage('service is required'),
    query('page').not().exists().withMessage('pagination is not supported'),
    query('page_size').not().exists().withMessage('pagination is not supported')
  ],
  validateRequest,
  PackageController.list
);

router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validateRequest,
  PackageController.getById
);

module.exports = router;

