const { HttpError } = require('../utils/httpError');

let googleOAuthClient = null;

function getGoogleClient() {
  // Lazy-load to avoid requiring the dependency if unused.
  if (!googleOAuthClient) {
    // eslint-disable-next-line global-require
    const { OAuth2Client } = require('google-auth-library');
    googleOAuthClient = new OAuth2Client();
  }
  return googleOAuthClient;
}

async function verifyGoogleIdToken(idToken) {
  const rawAudience = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const audienceList = rawAudience
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (!audienceList.length) throw new HttpError(500, 'Google client id not configured');

  const client = getGoogleClient();
  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken, audience: audienceList });
  } catch (e) {
    // If audience mismatch happens, verify again (without audience) so we can log the token aud
    // and make misconfiguration obvious. We still enforce the audience ourselves after decoding.
    try {
      ticket = await client.verifyIdToken({ idToken });
    } catch (_e2) {
      const msg2 = _e2 && typeof _e2.message === 'string' ? _e2.message : 'verifyIdToken failed';
      // eslint-disable-next-line no-console
      console.warn('[socialAuth] Google token verification failed', {
        reason: msg2,
        audienceList,
        tokenPrefix: typeof idToken === 'string' ? idToken.slice(0, 16) : null
      });
      throw new HttpError(401, 'Invalid Google token');
    }

    const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    const msg = e && typeof e.message === 'string' ? e.message : 'verifyIdToken failed';
    const payload = ticket.getPayload() || {};
    const tokenAud = payload.aud ? String(payload.aud) : null;
    const tokenAzp = payload.azp ? String(payload.azp) : null;

    // eslint-disable-next-line no-console
    console.warn('[socialAuth] Google token audience mismatch', {
      reason: msg,
      expectedAudiences: audienceList,
      tokenAud,
      tokenAzp,
      tokenPrefix: typeof idToken === 'string' ? idToken.slice(0, 16) : null
    });

    if (!tokenAud || !audienceList.includes(tokenAud)) {
      // Keep response generic, but logs will show the mismatch.
      throw new HttpError(401, 'Invalid Google token');
    }
  }

  const payload = ticket.getPayload() || {};
  if (!payload.sub) throw new HttpError(401, 'Invalid Google token');

  const tokenAud = payload.aud ? String(payload.aud) : null;
  if (!tokenAud || !audienceList.includes(tokenAud)) throw new HttpError(401, 'Invalid Google token');

  return {
    provider: 'google',
    provider_user_id: String(payload.sub),
    email: payload.email ? String(payload.email) : null,
    email_verified: payload.email_verified === true,
    name: payload.name ? String(payload.name) : null,
    given_name: payload.given_name ? String(payload.given_name) : null,
    family_name: payload.family_name ? String(payload.family_name) : null,
    picture: payload.picture ? String(payload.picture) : null,
    token_issuer: payload.iss ? String(payload.iss) : null,
    token_audience: payload.aud ? String(payload.aud) : null,
    token_authorized_party: payload.azp ? String(payload.azp) : null,
    token_expires_at: payload.exp ? Number(payload.exp) : null,
    token_issued_at: payload.iat ? Number(payload.iat) : null
  };
}

async function verifyAppleIdentityToken(identityToken) {
  const rawAudience = String(process.env.APPLE_CLIENT_ID || '').trim();
  const audienceList = rawAudience
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (!audienceList.length) throw new HttpError(500, 'Apple client id not configured');

  // Native iOS tokens use the app **bundle ID** as `aud`. Web Sign in with Apple uses the **Services ID**.
  // Set APPLE_CLIENT_ID to one or both, comma-separated (e.g. io.app.bundle,com.example.serviceid).

  // Lazy-load to avoid requiring the dependency if unused.
  // eslint-disable-next-line global-require
  const { createRemoteJWKSet, jwtVerify } = require('jose');

  const jwksUrl = new URL('https://appleid.apple.com/auth/keys');
  const JWKS = createRemoteJWKSet(jwksUrl);

  let result;
  try {
    result = await jwtVerify(identityToken, JWKS, {
      issuer: 'https://appleid.apple.com',
      audience: audienceList.length === 1 ? audienceList[0] : audienceList,
      clockTolerance: 60
    });
  } catch (e) {
    const msg = e && typeof e.message === 'string' ? e.message : String(e);
    const code = e && typeof e.code === 'string' ? e.code : undefined;
    // eslint-disable-next-line no-console
    console.warn('[socialAuth] Apple token verification failed', {
      reason: msg,
      code,
      configuredAudiences: audienceList,
      tokenPrefix: typeof identityToken === 'string' ? identityToken.slice(0, 24) : null
    });
    throw new HttpError(401, 'Invalid Apple token');
  }

  const claims = result.payload || {};
  if (!claims.sub) throw new HttpError(401, 'Invalid Apple token');

  return {
    provider: 'apple',
    provider_user_id: String(claims.sub),
    email: claims.email ? String(claims.email).trim().toLowerCase() : null,
    email_verified: claims.email_verified === 'true' || claims.email_verified === true,
    name: null,
    given_name: null,
    family_name: null,
    picture: null
  };
}

async function verifyFacebookAccessToken(accessToken) {
  const appId = String(process.env.FACEBOOK_APP_ID || '').trim();
  const appSecret = String(process.env.FACEBOOK_APP_SECRET || '').trim();
  if (!appId || !appSecret) throw new HttpError(500, 'Facebook app not configured');

  const appAccessToken = `${appId}|${appSecret}`;

  let debugJson;
  try {
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appAccessToken)}`
    );
    debugJson = await debugRes.json();
  } catch (_e) {
    throw new HttpError(502, 'Facebook verification failed');
  }

  const data = debugJson?.data;
  if (!data?.is_valid) throw new HttpError(401, 'Invalid Facebook token');
  if (String(data.app_id || '') !== appId) throw new HttpError(401, 'Invalid Facebook token');

  let meJson;
  try {
    const meRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`
    );
    meJson = await meRes.json();
  } catch (_e) {
    throw new HttpError(502, 'Facebook verification failed');
  }

  if (!meJson?.id) throw new HttpError(401, 'Invalid Facebook token');

  return {
    provider: 'facebook',
    provider_user_id: String(meJson.id),
    email: meJson.email ? String(meJson.email) : null,
    email_verified: null,
    name: meJson.name ? String(meJson.name) : null,
    given_name: null,
    family_name: null,
    picture: null
  };
}

async function verifySocialToken({ social_type, social_token }) {
  const st = String(social_type || '').trim().toLowerCase();
  const token = String(social_token || '').trim();
  if (!st) throw new HttpError(400, 'social_type is required');
  if (!token) throw new HttpError(400, 'social_token is required');

  if (st === 'google') return verifyGoogleIdToken(token);
  if (st === 'apple') return verifyAppleIdentityToken(token);
  if (st === 'facebook') return verifyFacebookAccessToken(token);

  throw new HttpError(400, 'Unsupported social_type');
}

module.exports = {
  verifySocialToken
};

