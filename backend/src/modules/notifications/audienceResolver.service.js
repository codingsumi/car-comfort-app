const { Op } = require('sequelize');
const db = require('../../models');

/**
 * Resolve recipient user IDs from audience filter JSON.
 * @param {object} filters
 * @returns {Promise<number[]>}
 */
async function resolveAudienceUserIds(filters = {}) {
  const segment = String(filters.segment || 'all_customers');
  const where = { role: { [Op.ne]: 'admin' } };

  if (segment === 'all_customers') {
    where.role = 'customer';
  } else if (segment === 'all_providers') {
    where.role = 'driver';
  } else if (segment === 'specific_users' && Array.isArray(filters.user_ids)) {
    const ids = filters.user_ids.map(Number).filter(Boolean);
    if (!ids.length) return [];
    where.id = { [Op.in]: ids };
  } else if (segment === 'custom' && filters.role) {
    where.role = filters.role;
  }

  if (filters.user_status === 'active') where.status = 'active';
  else if (filters.user_status === 'inactive') {
    where.status = { [Op.in]: ['suspended', 'deactivated'] };
  }

  const users = await db.User.findAll({
    where,
    attributes: ['id'],
    raw: true,
  });
  let ids = users.map((u) => Number(u.id));

  if (filters.city || filters.state) {
    const addressClauses = [];
    if (filters.city) {
      addressClauses.push({
        service_address: { [Op.like]: `%${String(filters.city).slice(0, 80)}%` },
      });
    }
    if (filters.state) {
      addressClauses.push({
        service_address: { [Op.like]: `%${String(filters.state).slice(0, 40)}%` },
      });
    }
    const bookingWhere =
      addressClauses.length === 1 ? addressClauses[0] : { [Op.and]: addressClauses };
    const bookings = await db.Booking.findAll({
      where: bookingWhere,
      attributes: ['user_id'],
      group: ['user_id'],
      raw: true,
    });
    const bookingUserIds = new Set(bookings.map((b) => Number(b.user_id)));
    ids = ids.filter((id) => bookingUserIds.has(id));
  }

  if (filters.has_booking_days) {
    const days = Number(filters.has_booking_days);
    if (Number.isFinite(days) && days > 0) {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const recent = await db.Booking.findAll({
        where: { created_at: { [Op.gte]: since }, user_id: { [Op.in]: ids } },
        attributes: ['user_id'],
        group: ['user_id'],
        raw: true,
      });
      const recentIds = new Set(recent.map((b) => Number(b.user_id)));
      ids = ids.filter((id) => recentIds.has(id));
    }
  }

  if (filters.service_type) {
    const typed = await db.Booking.findAll({
      where: { service_type: filters.service_type, user_id: { [Op.in]: ids } },
      attributes: ['user_id'],
      group: ['user_id'],
      raw: true,
    });
    const typedIds = new Set(typed.map((b) => Number(b.user_id)));
    ids = ids.filter((id) => typedIds.has(id));
  }

  return [...new Set(ids)];
}

module.exports = { resolveAudienceUserIds };
