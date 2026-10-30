const { body } = require('express-validator');

const upsertTutorialValidator = [
  body('video_url')
    .optional({ nullable: true })
    .custom((value) => value === null || typeof value === 'string')
    .withMessage('video_url must be a string or null'),
  body('instructions')
    .isArray({ min: 1 })
    .withMessage('instructions must be a non-empty array'),
  body('instructions.*')
    .isString()
    .withMessage('each instruction must be a string')
    .trim()
    .notEmpty()
    .withMessage('instruction cannot be empty')
    .isLength({ max: 200 })
    .withMessage('instruction must be at most 200 characters')
];

module.exports = {
  upsertTutorialValidator
};
