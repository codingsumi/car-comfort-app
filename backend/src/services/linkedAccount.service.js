const { Op } = require('sequelize');

const db = require('../models');

function normalizeEmail(email) {
  const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return e || null;
}

function normalizePhone(phone) {
  const p = typeof phone === 'string' ? phone.trim() : '';
  return p || null;
}

function sharesIdentity(userA, userB) {
  const emailA = normalizeEmail(userA?.email);
  const emailB = normalizeEmail(userB?.email);
  const phoneA = normalizePhone(userA?.phone);
  const phoneB = normalizePhone(userB?.phone);

  if (emailA && emailB && emailA === emailB) return true;
  if (phoneA && phoneB && phoneA === phoneB) return true;
  return false;
}

function linkedIdentityClauses(user) {
  const clauses = [];
  const email = normalizeEmail(user?.email);
  const phone = normalizePhone(user?.phone);
  if (email) clauses.push({ email });
  if (phone) clauses.push({ phone });
  return clauses;
}

async function findLinkedUsers(user) {
  const clauses = linkedIdentityClauses(user);
  if (!clauses.length) return user ? [user] : [];

  const candidates = await db.User.findAll({
    where: { [Op.or]: clauses }
  });

  return candidates.filter((candidate) => sharesIdentity(user, candidate));
}

async function findLinkedUserForRole(user, role) {
  const targetRole = String(role || '').trim().toLowerCase();
  if (!targetRole) return null;
  const linked = await findLinkedUsers(user);
  return linked.find((u) => String(u.role || '').toLowerCase() === targetRole) || null;
}

async function listAvailableAppRoles(user) {
  const linked = await findLinkedUsers(user);
  const roles = new Set();
  for (const u of linked) {
    const role = String(u.role || '').trim().toLowerCase();
    if (role === 'customer' || role === 'driver') roles.add(role);
  }
  return Array.from(roles);
}

function buildRoleConflictWhere({ role, email, phone }) {
  const finalRole = String(role || '').trim().toLowerCase();
  const finalEmail = normalizeEmail(email);
  const finalPhone = normalizePhone(phone);
  const identity = [];
  if (finalEmail) identity.push({ email: finalEmail });
  if (finalPhone) identity.push({ phone: finalPhone });
  if (!identity.length) return null;
  return {
    role: finalRole,
    [Op.or]: identity
  };
}

async function findRegistrationConflict({ role, email, phone }) {
  const where = buildRoleConflictWhere({ role, email, phone });
  if (!where) return null;
  return db.User.findOne({ where });
}

async function resolvePasswordLoginUser({ email, password, role }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) return null;

  const candidates = await db.User.findAll({ where: { email: normalizedEmail } });
  if (!candidates.length) return null;

  const bcrypt = require('bcrypt');
  const matches = [];
  for (const user of candidates) {
    if (user.auth_type === 'social' && !user.password) continue;
    if (!user.password) continue;
    const ok = await bcrypt.compare(String(password), user.password);
    if (ok) matches.push(user);
  }
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];

  const requestedRole = String(role || '').trim().toLowerCase();
  if (requestedRole) {
    const preferred = matches.find((u) => String(u.role || '').toLowerCase() === requestedRole);
    if (preferred) return preferred;
  }

  const customer = matches.find((u) => String(u.role || '').toLowerCase() === 'customer');
  return customer || matches[0];
}

module.exports = {
  sharesIdentity,
  findLinkedUsers,
  findLinkedUserForRole,
  listAvailableAppRoles,
  findRegistrationConflict,
  resolvePasswordLoginUser,
  normalizeEmail,
  normalizePhone
};
