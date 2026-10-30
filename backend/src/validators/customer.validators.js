const { body } = require('express-validator');

const updateCustomerProfileValidator = [
  body()
    .custom((value, { req }) => {
      const hasAny =
        typeof req.body?.name === 'string' ||
        typeof req.body?.first_name === 'string' ||
        typeof req.body?.last_name === 'string' ||
        typeof req.body?.phone === 'string' ||
        req.body?.profile !== undefined ||
        Boolean(req.file);
      if (!hasAny) throw new Error('At least one field is required');
      return true;
    })
    .withMessage('At least one field is required'),

  body('name')
    .optional()
    .isString()
    .withMessage('name must be a string')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('name must be between 2 and 120 characters'),

  body('first_name')
    .optional()
    .isString()
    .withMessage('first_name must be a string')
    .trim()
    .isLength({ min: 1, max: 60 })
    .withMessage('first_name must be between 1 and 60 characters'),

  body('last_name')
    .optional()
    .isString()
    .withMessage('last_name must be a string')
    .trim()
    .isLength({ min: 1, max: 60 })
    .withMessage('last_name must be between 1 and 60 characters'),

  body('phone')
    .optional()
    .isString()
    .withMessage('phone must be a string')
    .trim()
    .isLength({ min: 6, max: 32 })
    .withMessage('phone must be between 6 and 32 characters'),

  // `profile` can be:
  // - JSON body: a URL string (or null to clear) or an object like { picture_url: "..." }
  // - multipart/form-data: a URL string or a stringified JSON object
  // - multipart/form-data: a file upload in req.file (handled in controller)
  body('profile')
    .optional()
    .custom((value) => {
      if (value === null) return true;
      if (typeof value === 'string') {
        const raw = value.trim();
        if (!raw) return true;
        // plain URL/path is allowed
        if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return true;

        // or a JSON string like {"picture_url":"..."} or "https://..."
        try {
          const parsed = JSON.parse(raw);
          if (parsed === null) return true;
          if (typeof parsed === 'string') return Boolean(parsed.trim());
          if (typeof parsed === 'object' && !Array.isArray(parsed)) {
            if (parsed.picture_url === undefined) throw new Error('profile.picture_url is required');
            if (typeof parsed.picture_url !== 'string' || !parsed.picture_url.trim()) {
              throw new Error('profile.picture_url must be a non-empty string');
            }
            return true;
          }
          throw new Error('profile must be a URL or JSON object');
        } catch (_e) {
          throw new Error('profile must be a URL or valid JSON');
        }
      }
      if (typeof value === 'object') {
        if (Array.isArray(value)) throw new Error('profile must be an object');
        if (value.picture_url === undefined) throw new Error('profile.picture_url is required');
        if (typeof value.picture_url !== 'string' || !value.picture_url.trim()) {
          throw new Error('profile.picture_url must be a non-empty string');
        }
        return true;
      }
      throw new Error('profile must be a URL string or object');
    })
];

module.exports = {
  updateCustomerProfileValidator
};

