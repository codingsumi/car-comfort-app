const { Op, fn, col } = require('sequelize');
const db = require('../models');
const { HttpError } = require('../utils/httpError');

async function getServiceLimit(providerId) {
  const user = await db.User.findOne({
    where: { id: providerId, role: 'driver' },
    attributes: ['id', 'name', 'daily_service_limit', 'service_limit_enabled'],
  });
  if (!user) throw new HttpError(404, 'Provider not found');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayCompleted = await db.Booking.count({
    where: {
      assigned_driver_user_id: providerId,
      status: 'completed',
      updated_at: { [Op.gte]: today, [Op.lt]: tomorrow },
    },
  });

  const limit = user.daily_service_limit;
  const enabled = user.service_limit_enabled;

  return {
    provider_id: user.id,
    provider_name: user.name,
    daily_service_limit: limit,
    service_limit_enabled: enabled,
    today_completed: todayCompleted,
    remaining_slots: enabled && limit ? Math.max(0, limit - todayCompleted) : null,
    limit_reached: enabled && limit ? todayCompleted >= limit : false,
  };
}

async function updateServiceLimit(providerId, { dailyServiceLimit, serviceLimitEnabled, adminId, ipAddress }) {
  const user = await db.User.findOne({
    where: { id: providerId, role: 'driver' },
  });
  if (!user) throw new HttpError(404, 'Provider not found');

  const previousValues = {
    daily_service_limit: user.daily_service_limit,
    service_limit_enabled: user.service_limit_enabled,
  };

  const updateData = {};
  if (dailyServiceLimit !== undefined) {
    const parsed = parseInt(dailyServiceLimit);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      throw new HttpError(400, 'daily_service_limit must be a non-negative integer');
    }
    updateData.daily_service_limit = dailyServiceLimit === null ? null : parsed;
  }
  if (serviceLimitEnabled !== undefined) {
    updateData.service_limit_enabled = !!serviceLimitEnabled;
  }

  await user.update(updateData);

  await db.AdminAuditLog.create({
    admin_id: adminId,
    action_type: 'service_limit_updated',
    entity_type: 'user',
    entity_id: providerId,
    details: {
      previous: previousValues,
      new: updateData,
    },
    ip_address: ipAddress,
  });

  return getServiceLimit(providerId);
}

async function validateDailyLimit(providerId) {
  const user = await db.User.findOne({
    where: { id: providerId, role: 'driver' },
    attributes: ['id', 'daily_service_limit', 'service_limit_enabled'],
  });

  if (!user) throw new HttpError(404, 'Provider not found');

  if (!user.service_limit_enabled || !user.daily_service_limit) {
    return { allowed: true, reason: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayCompleted = await db.Booking.count({
    where: {
      assigned_driver_user_id: providerId,
      status: { [Op.in]: ['completed', 'in_progress', 'assigned'] },
      updated_at: { [Op.gte]: today, [Op.lt]: tomorrow },
    },
  });

  if (todayCompleted >= user.daily_service_limit) {
    return {
      allowed: false,
      reason: `Provider has reached the daily service limit of ${user.daily_service_limit}`,
      today_completed: todayCompleted,
      daily_limit: user.daily_service_limit,
    };
  }

  return {
    allowed: true,
    today_completed: todayCompleted,
    daily_limit: user.daily_service_limit,
    remaining: user.daily_service_limit - todayCompleted,
  };
}

async function getGlobalDefault() {
  const setting = await db.AppSetting.findOne({ where: { key: 'provider_default_daily_limit' } }).catch(() => null);
  const totalProviders = await db.User.count({ where: { role: 'driver', status: 'active' } });
  const limitedProviders = await db.User.count({
    where: { role: 'driver', status: 'active', service_limit_enabled: true },
  });
  return {
    default_daily_limit: setting ? parseInt(setting.value) || 4 : 4,
    total_active_providers: totalProviders,
    providers_with_limit_enabled: limitedProviders,
    providers_unlimited: totalProviders - limitedProviders,
  };
}

async function updateGlobalDefault({ defaultDailyLimit, applyToAll, adminId, ipAddress }) {
  // Update the app setting
  await db.AppSetting.upsert({ key: 'provider_default_daily_limit', value: String(defaultDailyLimit) }).catch(() => {});

  let updatedCount = 0;
  // Optionally apply to all active providers
  if (applyToAll && defaultDailyLimit) {
    const [count] = await db.User.update(
      { daily_service_limit: defaultDailyLimit, service_limit_enabled: true },
      { where: { role: 'driver', status: 'active' } }
    );
    updatedCount = count;
  }

  await db.AdminAuditLog.create({
    admin_id: adminId,
    action: 'global_service_limit_updated',
    target_type: 'system',
    target_id: 0,
    details: { default_daily_limit: defaultDailyLimit, apply_to_all: applyToAll, updated_providers: updatedCount },
    ip_address: ipAddress,
  }).catch(() => {});

  return { default_daily_limit: defaultDailyLimit, apply_to_all: applyToAll, updated_providers: updatedCount };
}

module.exports = {
  getServiceLimit,
  updateServiceLimit,
  validateDailyLimit,
  getGlobalDefault,
  updateGlobalDefault,
};
