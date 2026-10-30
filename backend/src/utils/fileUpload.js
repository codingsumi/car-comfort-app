const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sanitizeBaseName(name) {
  return String(name || 'file')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function buildAbsoluteUrl(req, publicPath) {
  const base = process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL;
  if (base) return `${String(base).replace(/\/+$/g, '')}${publicPath}`;
  return `${req.protocol}://${req.get('host')}${publicPath}`;
}

function ensureAbsoluteUrl(req, maybeUrlOrPath) {
  if (!maybeUrlOrPath) return null;
  const raw = String(maybeUrlOrPath).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return rewriteUnreachableMediaHost(req, raw);
  const pathOnly = raw.startsWith('/') ? raw : `/${raw}`;
  return rewriteUnreachableMediaHost(req, buildAbsoluteUrl(req, pathOnly));
}

/**
 * Replace localhost / loopback hosts in stored upload URLs with the request's public origin.
 * @param {import('express').Request} [req]
 * @param {string} url
 */
function rewriteUnreachableMediaHost(req, url) {
  const raw = String(url || '').trim();
  if (!raw) return raw;
  try {
    const parsed = new URL(raw);
    const host = String(parsed.hostname || '').toLowerCase();
    const unreachable = host === 'localhost' || host === '127.0.0.1' || host === '10.0.2.2';
    if (!unreachable) return raw;

    const base =
      process.env.PUBLIC_BASE_URL ||
      process.env.APP_BASE_URL ||
      (req ? `${req.protocol}://${req.get('host')}` : '');
    if (!base) return raw;

    const origin = String(base).replace(/\/+$/g, '');
    return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (_e) {
    return raw;
  }
}

/**
 * Resolves a stored public path (e.g. /uploads/vehicles/...) to an on-disk path under UPLOAD_DIR.
 */
function publicPathToDiskPath(publicPath) {
  if (!publicPath) return null;
  const root = process.env.UPLOAD_DIR || 'uploads';
  const mount = String(process.env.UPLOAD_PUBLIC_BASE || '/uploads')
    .replace(/\/+$/g, '') || '/uploads';
  const normalized = String(publicPath).replace(/\\/g, '/').trim();
  if (!normalized) return null;
  if (normalized.startsWith(mount + '/')) {
    return path.join(root, normalized.slice(mount.length + 1));
  }
  if (normalized.startsWith('/')) {
    return path.join(root, normalized.replace(/^\//, ''));
  }
  return path.join(root, normalized);
}

async function bufferToWebp(buffer, { width, height, fit = 'cover', quality = 80, maxWidth = 1920 } = {}) {
  let img = sharp(buffer, { failOn: 'none' }).rotate();

  if (width && height) {
    img = img.resize(width, height, { fit });
  } else {
    img = img.resize({ width: maxWidth, withoutEnlargement: true });
  }

  return await img.webp({ quality }).toBuffer();
}

async function saveWebpFile({ buffer, uploadDir, publicBase, req, fileBaseName, variant }) {
  const root = process.env.UPLOAD_DIR || 'uploads';
  const relDir = path.join(root, uploadDir);
  ensureDir(relDir);

  const safeName = sanitizeBaseName(fileBaseName);
  const suffix = variant ? `-${sanitizeBaseName(variant)}` : '';
  const filename = `${Date.now()}-${safeName}${suffix}.webp`;
  const diskPath = path.join(relDir, filename);

  fs.writeFileSync(diskPath, buffer);

  const mount = publicBase || process.env.UPLOAD_PUBLIC_BASE || '/uploads';
  const publicPath = `${mount}/${path.posix.join(uploadDir.replace(/\\/g, '/'), filename)}`.replace(/\/{2,}/g, '/');
  const absoluteUrl = buildAbsoluteUrl(req, publicPath);

  return { diskPath, publicPath, absoluteUrl };
}

/**
 * Save a binary file (e.g. PDF) without image conversion.
 */
async function saveBinaryFile({
  buffer,
  uploadDir,
  publicBase,
  req,
  fileBaseName,
  extension = 'pdf'
}) {
  const root = process.env.UPLOAD_DIR || 'uploads';
  const relDir = path.join(root, uploadDir);
  ensureDir(relDir);

  const safeName = sanitizeBaseName(fileBaseName);
  const ext = String(extension || 'pdf').replace(/^\./, '');
  const filename = `${Date.now()}-${safeName}.${ext}`;
  const diskPath = path.join(relDir, filename);

  fs.writeFileSync(diskPath, buffer);

  const mount = publicBase || process.env.UPLOAD_PUBLIC_BASE || '/uploads';
  const publicPath = `${mount}/${path.posix.join(uploadDir.replace(/\\/g, '/'), filename)}`.replace(/\/{2,}/g, '/');
  const absoluteUrl = buildAbsoluteUrl(req, publicPath);

  return { diskPath, publicPath, absoluteUrl };
}

/**
 * Validate and store an uploaded image without changing its bytes, dimensions,
 * aspect ratio, colour depth, or encoding. Provider profile photos are retained
 * as identity-verification originals; avatar views crop them only at render time.
 */
async function saveOriginalImageFile({
  buffer,
  uploadDir,
  publicBase,
  req,
  fileBaseName,
  variant
}) {
  const metadata = await sharp(buffer, { failOn: 'error' }).metadata();
  const extensionByFormat = {
    jpeg: 'jpg',
    png: 'png',
    webp: 'webp',
    gif: 'gif',
    tiff: 'tiff',
    heif: 'heic',
    avif: 'avif'
  };
  const extension = extensionByFormat[metadata.format];
  if (!extension) {
    throw new Error('Unsupported profile image format');
  }

  const suffix = variant ? `-${sanitizeBaseName(variant)}` : '';
  return saveBinaryFile({
    buffer,
    uploadDir,
    publicBase,
    req,
    fileBaseName: `${fileBaseName || 'profile'}${suffix}`,
    extension
  });
}

module.exports = {
  ensureDir,
  buildAbsoluteUrl,
  ensureAbsoluteUrl,
  rewriteUnreachableMediaHost,
  publicPathToDiskPath,
  bufferToWebp,
  saveWebpFile,
  saveBinaryFile,
  saveOriginalImageFile
};
