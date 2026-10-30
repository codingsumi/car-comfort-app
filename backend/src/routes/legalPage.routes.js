const express = require('express');

const controller = require('../controllers/legalPage.controller');
const { validateRequest } = require('../middlewares/validateRequest');
const { publicLegalPageQueryValidator } = require('../validators/legalPage.validators');

const router = express.Router();

router.get('/', publicLegalPageQueryValidator, validateRequest, controller.getLegalPage);

module.exports = router;
