const express = require('express');

const controller = require('../controllers/legalPage.controller');
const { validateRequest } = require('../middlewares/validateRequest');
const { publicLegalPagesListQueryValidator } = require('../validators/legalPage.validators');

const router = express.Router();

router.get('/', publicLegalPagesListQueryValidator, validateRequest, controller.listLegalPages);

module.exports = router;
