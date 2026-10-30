const db = require('../models');
const { HttpError } = require('./httpError');
const { LICENSE_EXPIRED_SUSPENSION_REASON } = require('./driverPersonalInfo');

const ACCOUNT_DELETED_MESSAGE = 'Your account has been deleted';

function isDeletionSuspensionReason(user) {
  return /account deletion|deletion request/i.test(String(user?.suspended_reason || ''));
}

async function hasApprovedDeletionRequest(userId) {
  const uid = Number(userId);
  if (!uid) return false;

  const request = await db.AccountDeletionRequest.findOne({
    where: {
      user_id: uid,
      status: 'approved'
    },
    attributes: ['id']
  });
  return Boolean(request);
}

async function getBlockedAccountMessage(user) {
  const status = String(user?.status || 'active').toLowerCase();
  if (status === 'active') return null;

  if (status === 'deactivated') {
    return ACCOUNT_DELETED_MESSAGE;
  }

  if (status === 'suspended') {
    if (user?.suspended_reason === LICENSE_EXPIRED_SUSPENSION_REASON) {
      return null;
    }
    if (isDeletionSuspensionReason(user) || await hasApprovedDeletionRequest(user?.id)) {
      return ACCOUNT_DELETED_MESSAGE;
    }
    return 'Account suspended';
  }

  return 'Account unavailable';
}

async function assertUserAccountActive(user, statusCode = 403) {
  const message = await getBlockedAccountMessage(user);
  if (!message) return;

  throw new HttpError(statusCode, message, {
    error_type: message === ACCOUNT_DELETED_MESSAGE ? 'account_deleted' : 'account_blocked'
  });
}

module.exports = {
  ACCOUNT_DELETED_MESSAGE,
  assertUserAccountActive,
  getBlockedAccountMessage
};
