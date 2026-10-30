const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const ENCODING = 'hex';

function getEncryptionKey() {
  const key = process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!key) {
    throw new Error('SETTINGS_ENCRYPTION_KEY or JWT_SECRET must be set');
  }
  return crypto.createHash('sha256').update(key).digest();
}

function encrypt(plainText) {
  if (!plainText) return plainText;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(String(plainText), 'utf8', ENCODING);
  encrypted += cipher.final(ENCODING);

  const tag = cipher.getAuthTag();

  return `${iv.toString(ENCODING)}:${tag.toString(ENCODING)}:${encrypted}`;
}

function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;

  const raw = String(encryptedText);
  const parts = raw.split(':');

  // Not encrypted with our format — treat as plaintext (e.g. sk_test_...).
  if (parts.length !== 3) return raw;

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[0], ENCODING);
    const tag = Buffer.from(parts[1], ENCODING);
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    // Wrong SETTINGS_ENCRYPTION_KEY / JWT_SECRET or corrupted value.
    return null;
  }
}

function maskSensitiveValue(value) {
  if (!value) return '';
  const str = String(value);
  if (str.length <= 8) return '••••••••';
  return str.substring(0, 4) + '••••••••' + str.substring(str.length - 4);
}

module.exports = { encrypt, decrypt, maskSensitiveValue };
