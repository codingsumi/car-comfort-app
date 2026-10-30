const express = require('express');
const ServiceController = require('../controllers/service.controller');

const router = express.Router();

// Backwards-compatible: service catalog (lookup table)
router.get('/catalog', ServiceController.listCatalog);

// Default: catalog list
router.get('/', ServiceController.listCatalog);

module.exports = router;

