/**
 * Normalize validation / client-error payloads so mobile apps can read `message` only.
 */

const GENERIC_VALIDATION_MESSAGES = new Set([
  'validation error',
  'missing required fields',
  'invalid input',
  'bad request'
]);

/**
 * @param {string} field
 */
function humanizeFieldName(field) {
  const raw = String(field || '').trim();
  if (!raw) return 'Field';
  const leaf = raw.includes('.') ? raw.split('.').pop() : raw;
  return leaf.replace(/_/g, ' ').replace(/\[\d+]/g, '').trim() || 'Field';
}

/**
 * @param {{ field?: string, path?: string, param?: string, message?: string, msg?: string }} item
 */
function formatFieldErrorItem(item) {
  if (!item || typeof item !== 'object') return '';

  const field = item.field ?? item.path ?? item.param;
  const rawMsg = String(item.message ?? item.msg ?? '').trim();

  if (rawMsg && rawMsg !== 'required' && rawMsg !== 'is required') {
    return rawMsg;
  }

  const label = humanizeFieldName(field);
  if (field) return `${label} is required`;
  return rawMsg || 'Invalid value';
}

/**
 * @param {Array<unknown>} items
 */
function formatValidationMessage(items) {
  if (!Array.isArray(items) || items.length === 0) return 'Validation error';

  if (typeof items[0] === 'string') {
    return items
      .map((field) => `${humanizeFieldName(field)} is required`)
      .join('. ');
  }

  const parts = items.map((item) => formatFieldErrorItem(item)).filter(Boolean);

  if (parts.length === 0) return 'Validation error';
  if (parts.length === 1) return parts[0];
  return parts.join('. ');
}

/**
 * @param {string} message
 */
function isGenericValidationMessage(message) {
  const normalized = String(message || '').trim().toLowerCase();
  return !normalized || GENERIC_VALIDATION_MESSAGES.has(normalized);
}

/**
 * @param {unknown} details
 * @param {string} fallbackMessage
 * @returns {string|null}
 */
function messageFromDetails(details, fallbackMessage = '') {
  if (details == null) return null;

  if (Array.isArray(details)) {
    const formatted = formatValidationMessage(details);
    if (!isGenericValidationMessage(fallbackMessage)) return null;
    return formatted;
  }

  if (typeof details === 'object') {
    const obj = details;
    if (obj.stripe || obj.error || obj.export_url) return null;

    const entries = Object.entries(obj).filter(
      ([, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    );

    if (entries.length === 0) return null;

    const parts = entries.map(([field, value]) => {
      const msg = String(value).trim();
      const label = humanizeFieldName(field);
      if (!msg || msg === 'required') return `${label} is required`;
      if (msg.toLowerCase().includes(label.toLowerCase())) return msg;
      return `${label}: ${msg}`;
    });

    if (parts.length === 0) return null;
    if (!isGenericValidationMessage(fallbackMessage)) return null;
    return parts.join('. ');
  }

  return null;
}

/**
 * @param {import('multer').MulterError | Error & { code?: string }} err
 */
function multerErrorMessage(err) {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return 'File is too large';
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_FILES':
      return 'Too many files uploaded';
    case 'LIMIT_UNEXPECTED_FILE':
      return 'Unexpected file field';
    case 'LIMIT_PART_COUNT':
      return 'Too many parts in the upload';
    default:
      return err.message || 'File upload failed';
  }
}

/**
 * @param {Error & { errors?: Array<{ path?: string, message?: string }>, statusCode?: number, status?: number, error_type?: string, details?: unknown }} err
 * @param {number} status
 */
function resolveApiErrorPayload(err, status) {
  const errorType =
    err.error_type ||
    err.errorType ||
    err.type ||
    (status === 400 ? 'validation_error' : null) ||
    (status === 422 ? 'validation_error' : null) ||
    (status === 401 ? 'unauthorized' : null) ||
    (status === 403 ? 'forbidden' : null) ||
    (status === 404 ? 'not_found' : null) ||
    (status === 409 ? 'conflict' : null) ||
    (status >= 500 ? 'internal_error' : null) ||
    'error';

  let message = err.message || 'Internal server error';
  let resolvedType = errorType;
  let omitData = false;

  if (err?.name === 'SequelizeValidationError' && Array.isArray(err.errors)) {
    return {
      message: formatValidationMessage(
        err.errors.map((e) => ({ field: e.path, message: e.message }))
      ),
      errorType: 'validation_error',
      omitData: true
    };
  }

  if (err?.name === 'MulterError' || (err?.code && String(err.code).startsWith('LIMIT_'))) {
    return {
      message: multerErrorMessage(err),
      errorType: 'validation_error',
      omitData: true
    };
  }

  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return {
      message: 'Invalid JSON in request body',
      errorType: 'validation_error',
      omitData: true
    };
  }

  const fromDetails = messageFromDetails(err.details, message);
  if (fromDetails) {
    message = fromDetails;
    if (status === 400 || status === 422) resolvedType = 'validation_error';
    omitData = true;
  } else if (err.error_type === 'validation_error' || resolvedType === 'validation_error') {
    omitData = true;
  } else if (status === 400 || status === 422) {
    omitData = true;
    if (isGenericValidationMessage(message)) {
      message = messageFromDetails(err.details, message) || message || 'Validation error';
    }
  }

  if (!String(message).trim()) {
    message = 'Validation error';
  }

  return { message, errorType: resolvedType, omitData };
}

module.exports = {
  formatValidationMessage,
  formatFieldErrorItem,
  messageFromDetails,
  isGenericValidationMessage,
  resolveApiErrorPayload,
  multerErrorMessage,
  humanizeFieldName
};
