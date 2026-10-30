'use strict';

const { logger } = require('./logger');

let firebaseAdmin = null;
let initAttempted = false;

function normalizePrivateKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/\\n/g, '\n');
}

function getFirebaseAdmin() {
  if (firebaseAdmin || initAttempted) return firebaseAdmin;
  initAttempted = true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    logger.warn('firebase_admin_not_configured', {
      hasProjectId: !!projectId,
      hasClientEmail: !!clientEmail,
      hasPrivateKey: !!privateKey,
      hasDatabaseURL: !!databaseURL,
    });
    return null;
  }

  // Lazy require keeps local boot working until firebase-admin is installed/configured.
  // eslint-disable-next-line global-require
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      databaseURL,
    });
  }
  firebaseAdmin = admin;
  return firebaseAdmin;
}

function isFirebaseAdminConfigured() {
  return !!getFirebaseAdmin();
}

module.exports = {
  getFirebaseAdmin,
  isFirebaseAdminConfigured,
};
