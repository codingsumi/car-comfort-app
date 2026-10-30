'use strict';

const { getMaintenanceStatus } = require('../middlewares/maintenanceMode');
const { getReferralDiscountPercent } = require('../services/referralDiscount.service');

async function getAppStatus(req, res, next) {
  try {
    const [maintenance, referralDiscountPercent] = await Promise.all([
      getMaintenanceStatus(),
      getReferralDiscountPercent().catch(() => 10),
    ]);

    const mapboxPublicToken = String(
      process.env.MAPBOX_PUBLIC_ACCESS_TOKEN || process.env.MAPBOX_ACCESS_TOKEN || ''
    ).trim();
    const googlePlacesPublicApiKey = String(
      process.env.GOOGLE_PLACES_PUBLIC_API_KEY || ''
    ).trim();

    return res.success('App status fetched', {
      maintenance,
      config: {
        referral_discount_percent: referralDiscountPercent,
        // Mapbox browser tokens are public by design. Never return a secret
        // token from this endpoint; configure a `pk.` token for the PWA.
        mapbox_public_token: mapboxPublicToken.startsWith('pk.')
          ? mapboxPublicToken
          : null,
        // Only the dedicated browser-restricted key is public. Do not expose
        // server-side Google credentials through this endpoint.
        google_places_api_key: googlePlacesPublicApiKey.startsWith('AIza')
          ? googlePlacesPublicApiKey
          : null,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getAppStatus };
