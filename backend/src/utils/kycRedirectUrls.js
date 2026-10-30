'use strict';

/**
 * Stripe Account Link return/refresh URLs and app deep-link targets after KYC.
 */

function trimSlash(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function resolveDriverAppBaseUrl() {
  const explicit =
    process.env.DRIVER_APP_URL ||
    process.env.DRIVER_FRONTEND_URL ||
    process.env.MOBILE_APP_URL;
  if (explicit) return trimSlash(explicit);
  return 'carcomfort://kyc';
}

function resolveApiPublicBaseUrl() {
  return trimSlash(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '');
}

function buildKycAppTarget(appBase, kind) {
  const base = trimSlash(appBase);
  if (/\/kyc$/i.test(base) || /^carcomfort:\/\/kyc$/i.test(base)) {
    return `${base}/${kind}`;
  }
  return `${base}/kyc/${kind}`;
}

/** Final URL opened in the app after API redirect (deep link or web route). */
function resolveKycAppTarget(kind) {
  const appBase = resolveDriverAppBaseUrl();
  const map = {
    success: process.env.DRIVER_KYC_APP_SUCCESS_URL || buildKycAppTarget(appBase, 'success'),
    error: process.env.DRIVER_KYC_APP_ERROR_URL || buildKycAppTarget(appBase, 'error'),
    refresh: process.env.DRIVER_KYC_APP_REFRESH_URL || process.env.DRIVER_KYC_APP_ERROR_URL || buildKycAppTarget(appBase, 'refresh'),
  };
  return map[kind] || map.success;
}

/**
 * URLs passed to Stripe accountLinks.create.
 * Prefer API HTTPS redirects when PUBLIC_BASE_URL is set (mobile deep links).
 */
function resolveStripeAccountLinkUrls() {
  if (process.env.DRIVER_KYC_RETURN_URL) {
    return {
      returnUrl: String(process.env.DRIVER_KYC_RETURN_URL).trim(),
      refreshUrl:
        String(process.env.DRIVER_KYC_REFRESH_URL || process.env.DRIVER_KYC_ERROR_URL || process.env.DRIVER_KYC_RETURN_URL).trim(),
    };
  }

  const apiBase = resolveApiPublicBaseUrl();
  const useApiRedirect =
    process.env.DRIVER_KYC_USE_API_REDIRECT === 'true' ||
    (process.env.DRIVER_KYC_USE_API_REDIRECT !== 'false' && Boolean(apiBase));

  if (useApiRedirect && apiBase) {
    return {
      returnUrl: `${apiBase}/api/driver/stripe/connect/kyc/redirect/success`,
      refreshUrl: `${apiBase}/api/driver/stripe/connect/kyc/redirect/refresh`,
    };
  }

  const appBase = resolveDriverAppBaseUrl();
  return {
    returnUrl: buildKycAppTarget(appBase, 'success'),
    refreshUrl: buildKycAppTarget(appBase, 'refresh'),
  };
}

module.exports = {
  resolveDriverAppBaseUrl,
  resolveKycAppTarget,
  resolveStripeAccountLinkUrls,
};
