const { resolveApiErrorPayload } = require('../utils/apiErrorMessage');

function errorHandler(err, _req, res, _next) {
  let status = err.statusCode || err.status || 500;

  if (err?.name === 'MulterError' || (err?.code && String(err.code).startsWith('LIMIT_'))) {
    status = 400;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
  }

  const { message, errorType, omitData } = resolveApiErrorPayload(err, status);

  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }

  try {
    const { logger } = require('../config/logger');

    logger.error('Request error', {
      status,
      message,
      errorType,
      details: err.details,
      method: _req.method,
      path: _req.originalUrl,
    });
  } catch (_) {}

  const data =
    omitData || err.details == null
      ? null
      : err.details && typeof err.details === 'object'
        ? err.details
        : null;

  if (typeof res.fail === 'function') {
    return res.fail(message, status, data, errorType);
  }

  return res.status(status).json({
    status: 'error',
    message,
    error_type: errorType,
    data
  });
}

module.exports = {
  errorHandler
};
