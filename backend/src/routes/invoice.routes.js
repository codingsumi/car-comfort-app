const express = require('express');
const InvoiceController = require('../controllers/invoice.controller');

const router = express.Router();

// Public invoice access via unguessable token (embedded only in QR code / link).
router.get('/:token', InvoiceController.getByToken);

module.exports = router;

