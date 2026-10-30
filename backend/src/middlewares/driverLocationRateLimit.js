const rateLimit = require('express-rate-limit');

function createDriverLocationLimiter() {
  const windowMs = Number(process.env.DRIVER_LOCATION_RATE_WINDOW_MS || 60000);
  const max = Number(process.env.DRIVER_LOCATION_RATE_LIMIT_MAX || 120);
  return rateLimit({
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60000,
    max: Number.isFinite(max) && max > 0 ? max : 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        status: 'error',
        message: 'Too many location updates',
        error_type: 'rate_limit',
        data: {}
      });
    }
  });
}

module.exports = { createDriverLocationLimiter };
