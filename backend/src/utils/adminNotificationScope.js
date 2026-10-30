'use strict';

const { Op } = require('sequelize');
const db = require('../models');

/** In-app types created for admin recipients (support desk, etc.). */
const ADMIN_INBOX_NOTIFICATION_TYPES = [
  'SUPPORT_TICKET_CREATED',
  'SUPPORT_TICKET_MESSAGE',
  'SUPPORT_TICKET_REPLY',
  'SUPPORT_TICKET_RESOLVED',
];

async function getActiveAdminUserIds() {
  const rows = await db.User.findAll({
    where: { role: 'admin', status: 'active' },
    attributes: ['id'],
    raw: true,
  });
  return rows.map((r) => Number(r.id)).filter(Boolean);
}

function adminRecipientUserInclude() {
  return {
    model: db.User,
    as: 'user',
    attributes: ['id', 'name', 'email', 'role'],
    where: { role: 'admin' },
    required: true,
  };
}

async function assertAdminRecipientNotification(notification) {
  if (!notification) return false;
  const user = await db.User.findByPk(notification.user_id, {
    attributes: ['id', 'role'],
  });
  return Boolean(user && user.role === 'admin');
}

module.exports = {
  ADMIN_INBOX_NOTIFICATION_TYPES,
  getActiveAdminUserIds,
  adminRecipientUserInclude,
  assertAdminRecipientNotification,
};
