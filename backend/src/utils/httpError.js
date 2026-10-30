const { formatValidationMessage, isGenericValidationMessage } = require('./apiErrorMessage');

class HttpError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {unknown} [details]
   */
  constructor(statusCode, message, details) {
    let resolvedMessage = message;
    let clientDetails = details;
    let errorType =
      details && typeof details === 'object' && !Array.isArray(details)
        ? details.error_type
        : undefined;

    if (statusCode === 400 || statusCode === 422) {
      if (Array.isArray(details) && details.length > 0 && isGenericValidationMessage(message)) {
        resolvedMessage = formatValidationMessage(details);
        clientDetails = null;
      } else if (
        details &&
        typeof details === 'object' &&
        !Array.isArray(details) &&
        isGenericValidationMessage(message)
      ) {
        const entries = Object.entries(details).filter(
          ([key]) => !['stripe', 'error', 'export_url'].includes(key)
        );
        if (entries.length > 0 && entries.every(([, v]) => typeof v === 'string')) {
          resolvedMessage = formatValidationMessage(
            entries.map(([field, msg]) => ({ field, message: msg }))
          );
          clientDetails = null;
        }
      }
    }

    super(resolvedMessage);
    this.statusCode = statusCode;
    this.details = clientDetails;
    if (errorType) {
      this.error_type = errorType;
    } else if (statusCode === 400 || statusCode === 422) {
      this.error_type = 'validation_error';
    }
  }
}

module.exports = { HttpError };
