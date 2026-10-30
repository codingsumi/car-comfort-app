const { validationResult } = require('express-validator');
const { formatValidationMessage } = require('../utils/apiErrorMessage');

function validateRequest(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const fieldErrors = result.array().map((e) => ({
    field: e.path,
    message: e.msg
  }));

  return next({
    statusCode: 400,
    error_type: 'validation_error',
    message: formatValidationMessage(fieldErrors),
    details: null
  });
}

module.exports = { validateRequest };
