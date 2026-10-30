const { body } = require('express-validator');

const ROLES = ['customer', 'driver', 'garage', 'admin'];
const PUBLIC_REGISTRATION_ROLES = ['customer', 'driver'];
const AUTH_TYPES = ['normal', 'social'];
const SOCIAL_TYPES = ['google', 'apple', 'facebook'];

function socialTypeBody(field) {
  return body(field).custom((value, { req }) => {
    if ((req.body.auth_type || 'normal') !== 'social') return true;
    if (field === 'social_type') {
      const v = value == null ? '' : String(value).trim().toLowerCase();
      if (!v) throw new Error('social_type is required');
      if (!SOCIAL_TYPES.includes(v)) {
        throw new Error(`social_type must be one of: ${SOCIAL_TYPES.join(', ')}`);
      }
      return true;
    }
    if (!value || (typeof value === 'string' && !String(value).trim())) {
      throw new Error(`${field} is required`);
    }
    return true;
  });
}

const registerValidator = [
  body('auth_type').optional().isIn(AUTH_TYPES).withMessage(`auth_type must be one of: ${AUTH_TYPES.join(', ')}`),
  socialTypeBody('social_type'),
  socialTypeBody('social_id'),
  socialTypeBody('social_token'),
  body('referral_code')
    .optional({ nullable: true })
    .trim()
    .customSanitizer((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v))
    .matches(/^CC\d{6}$/)
    .withMessage('referral_code must be like CC123456'),
  body('first_name')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 60 })
    .withMessage('first_name is too long')
    .custom((value, { req }) => {
      if ((req.body.auth_type || 'normal') !== 'normal') return true;
      if (!value) throw new Error('first_name is required');
      return true;
    }),
  body('last_name')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 60 })
    .withMessage('last_name is too long')
    .custom((value, { req }) => {
      if ((req.body.auth_type || 'normal') !== 'normal') return true;
      if (!value) throw new Error('last_name is required');
      return true;
    }),
  body('email')
    .optional({ nullable: true })
    .trim()
    .custom((value, { req }) => {
      if ((req.body.auth_type || 'normal') !== 'normal') return true;
      if (!value) throw new Error('email is required');
      return true;
    })
    .isEmail()
    .withMessage('email must be valid'),
  body('country_code')
    .optional({ nullable: true })
    .trim()
    .custom((value, { req }) => {
      // Keep required for normal registration only
      if ((req.body.auth_type || 'normal') !== 'normal') return true;
      if (!value) throw new Error('country_code is required');
      return true;
    })
    .matches(/^\+\d{1,4}$/)
    .withMessage('country_code must be a calling code like +1, +91'),
  body('agreed_to_terms').custom((value, { req }) => {
    const v = value;
    if (v === true || v === 'true' || v === 1 || v === '1') return true;
    throw new Error('agreed_to_terms must be true');
  }),
  body('phone')
    .optional({ nullable: true })
    .trim()
    .custom((value, { req }) => {
      if ((req.body.auth_type || 'normal') !== 'normal') return true;
      if (!value) throw new Error('phone is required');
      return true;
    })
    .matches(/^\d{10}$/)
    .withMessage('phone must be 10 digits'),
  body('password')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      if ((req.body.auth_type || 'normal') !== 'normal') return true;
      if (!value) throw new Error('password is required');
      return true;
    })
    .isLength({ min: 6, max: 72 })
    .withMessage('password must be between 6 and 72 chars'),
  body('role')
    .optional()
    .isIn(PUBLIC_REGISTRATION_ROLES)
    .withMessage(`role must be one of: ${PUBLIC_REGISTRATION_ROLES.join(', ')}`)  // admin/garage cannot self-register
  ,
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).withMessage('latitude must be -90..90'),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).withMessage('longitude must be -180..180')
];

const verifyOtpValidator = [
  body('otp')
    .trim()
    .notEmpty()
    .withMessage('otp is required')
    .matches(/^\d{4,6}$/)
    .withMessage('otp must be 4 to 6 digits')
];

const resendOtpByEmailValidator = [
  body('email').trim().notEmpty().withMessage('email is required').isEmail().withMessage('email must be valid')
];

const verifyOtpByEmailValidator = [
  body('email').trim().notEmpty().withMessage('email is required').isEmail().withMessage('email must be valid'),
  body('otp')
    .trim()
    .notEmpty()
    .withMessage('otp is required')
    .matches(/^\d{4,6}$/)
    .withMessage('otp must be 4 to 6 digits')
];

const sendTestSmsValidator = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('phone is required')
    .matches(/^[+]?[\d\s().-]{7,20}$/)
    .withMessage('phone must be valid'),
  body('message').optional().isString().isLength({ min: 1, max: 300 }).withMessage('message is too long')
];

const verifyAppleTokenTestValidator = [
  body('identity_token')
    .optional({ nullable: true })
    .isString()
    .withMessage('identity_token must be a string')
    .customSanitizer((v) => (typeof v === 'string' ? v.trim() : v)),
  body('social_token')
    .optional({ nullable: true })
    .isString()
    .withMessage('social_token must be a string')
    .customSanitizer((v) => (typeof v === 'string' ? v.trim() : v))
    .custom((value, { req }) => {
      const idt = typeof req.body.identity_token === 'string' ? req.body.identity_token.trim() : '';
      const st = typeof value === 'string' ? value.trim() : '';
      if (!idt && !st) throw new Error('identity_token is required');
      return true;
    })
];

const loginValidator = [
  body('auth_type').optional().isIn(AUTH_TYPES).withMessage(`auth_type must be one of: ${AUTH_TYPES.join(', ')}`),
  socialTypeBody('social_type'),
  socialTypeBody('social_id'),
  socialTypeBody('social_token'),
  body('email')
    .optional({ nullable: true })
    .trim()
    .custom((value, { req }) => {
      if ((req.body.auth_type || 'normal') !== 'normal') return true;
      if (!value) throw new Error('email is required');
      return true;
    })
    .isEmail()
    .withMessage('email must be valid'),
  body('password')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      if ((req.body.auth_type || 'normal') !== 'normal') return true;
      if (!value) throw new Error('password is required');
      return true;
    }),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).withMessage('latitude must be -90..90'),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).withMessage('longitude must be -180..180'),
  body('role')
    .optional({ nullable: true })
    .trim()
    .isIn(['customer', 'driver'])
    .withMessage('role must be customer or driver')
];

const switchRoleValidator = [
  body('role')
    .trim()
    .notEmpty()
    .withMessage('role is required')
    .isIn(['customer', 'driver'])
    .withMessage('role must be customer or driver'),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).withMessage('latitude must be -90..90'),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).withMessage('longitude must be -180..180')
];

const forgotPasswordValidator = [
  body('email').trim().notEmpty().withMessage('email is required').isEmail().withMessage('email must be valid')
];

const verifyResetOtpValidator = [
  body('email').trim().notEmpty().withMessage('email is required').isEmail().withMessage('email must be valid'),
  body('otp')
    .trim()
    .notEmpty()
    .withMessage('otp is required')
    .matches(/^\d{4,6}$/)
    .withMessage('otp must be 4 to 6 digits')
];

const resetPasswordValidator = [
  body('reset_token').trim().notEmpty().withMessage('reset_token is required'),
  body('new_password')
    .notEmpty()
    .withMessage('new_password is required')
    .isLength({ min: 6, max: 72 })
    .withMessage('new_password must be between 6 and 72 chars'),
  body('confirm_password')
    .notEmpty()
    .withMessage('confirm_password is required')
    .custom((value, { req }) => value === req.body.new_password)
    .withMessage('confirm_password must match new_password')
];

module.exports = {
  registerValidator,
  verifyOtpValidator,
  resendOtpByEmailValidator,
  verifyOtpByEmailValidator,
  sendTestSmsValidator,
  verifyAppleTokenTestValidator,
  loginValidator,
  forgotPasswordValidator,
  verifyResetOtpValidator,
  resetPasswordValidator,
  switchRoleValidator
};

