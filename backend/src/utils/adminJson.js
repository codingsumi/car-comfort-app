'use strict';

/**
 * Admin API responses use snake_case (created_at). Sequelize models with
 * underscored: true still expose createdAt on plain objects.
 */
function withSnakeTimestamps(plain) {
  if (!plain || typeof plain !== 'object' || plain instanceof Date) {
    return plain;
  }

  const { createdAt, updatedAt, ...rest } = plain;
  const out = { ...rest };

  if (createdAt !== undefined || plain.created_at !== undefined) {
    out.created_at = plain.created_at ?? createdAt ?? null;
  }
  if (updatedAt !== undefined || plain.updated_at !== undefined) {
    out.updated_at = plain.updated_at ?? updatedAt ?? null;
  }

  return out;
}

function toAdminUserJson(user) {
  const plain = typeof user.get === 'function' ? user.get({ plain: true }) : { ...user };
  return withSnakeTimestamps(plain);
}

function toAdminPlainJson(record) {
  if (!record) return record;
  const plain = typeof record.get === 'function' ? record.get({ plain: true }) : { ...record };
  const out = withSnakeTimestamps(plain);
  if (out.user && typeof out.user === 'object' && !Array.isArray(out.user)) {
    out.user = withSnakeTimestamps(out.user);
  }
  return out;
}

function mapAdminPlainList(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => toAdminPlainJson(row));
}

/** User + nested driver_profile for admin provider list/detail. */
function toAdminProviderJson(user) {
  const base = toAdminUserJson(user);
  if (base.driver_profile && typeof base.driver_profile === 'object') {
    base.driver_profile = toAdminPlainJson(base.driver_profile);
  }
  return base;
}

module.exports = {
  withSnakeTimestamps,
  toAdminUserJson,
  toAdminPlainJson,
  toAdminProviderJson,
  mapAdminPlainList,
};
