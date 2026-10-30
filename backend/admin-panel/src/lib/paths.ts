/** Must match `basePath` in next.config.js */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/admin';

/** Backend origin only — no trailing slash, no `/api` suffix. */
export function normalizeBackendOrigin(url: string | undefined): string {
  const raw = String(url || 'http://localhost:3000').trim().replace(/\/+$/, '');
  return raw.replace(/\/api$/i, '');
}

export const API_BASE_URL = normalizeBackendOrigin(process.env.NEXT_PUBLIC_API_URL);

/** Full app URL, e.g. http://localhost:4002/admin */
export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || `http://localhost:4002${BASE_PATH}`
).replace(/\/+$/, '');

/** Origin + base path in the browser; falls back to APP_URL during SSR. */
export function getAppOrigin(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${BASE_PATH}`;
  }
  return APP_URL;
}

/** Browser: http://localhost:4002/admin/api (proxied). SSR: direct backend API. */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return `${getAppOrigin()}/api`;
  }
  return `${API_BASE_URL}/api`;
}

/** Resolve upload/media URLs to the admin app origin (not bare /admin/ or site root). */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const origin = getAppOrigin();
  let path = url.startsWith(BASE_PATH) ? url.slice(BASE_PATH.length) || '/' : url;
  if (!path.startsWith('/')) path = `/${path}`;
  return `${origin}${path}`;
}

/** Absolute URL for hard navigations (401 redirect, etc.). */
export function adminPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getAppOrigin()}${normalized}`;
}
