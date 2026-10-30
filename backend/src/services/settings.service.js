const { Op } = require('sequelize');
const { encrypt, decrypt, maskSensitiveValue } = require('../utils/encryption');
const { logger } = require('../config/logger');

const CACHE_TTL = 5 * 60 * 1000;
let settingsCache = null;
let cacheTimestamp = 0;

const SETTING_GROUPS = [
  'general',
  'stripe',
  'onesignal',
  'email',
  'social_links',
  'finance',
  'theme',
  'invoice',
  'admin_panel',
  'maintenance',
  'notifications',
  'services',
  'provider_performance',
];

const ADMIN_PANEL_BRANDING_KEYS = [
  'admin_panel_name',
  'admin_panel_logo',
  'admin_panel_favicon',
  'admin_panel_theme_mode',
  'admin_panel_primary_color',
  'admin_panel_sidebar_color',
  'admin_panel_header_color',
];

const CREATE_ON_SAVE_INVOICE_SETTINGS = {
  invoice_website: {
    type: 'url',
    label: 'Company Website',
    description: 'Website shown on customer receipts',
    sort_order: 3,
  },
};

function invalidateCache() {
  settingsCache = null;
  cacheTimestamp = 0;
}

async function getAllSettings(db, { includeSecrets = false } = {}) {
  const now = Date.now();
  if (settingsCache && now - cacheTimestamp < CACHE_TTL) {
    return formatSettings(settingsCache, includeSecrets);
  }

  const settings = await db.AppSetting.findAll({
    order: [['group_name', 'ASC'], ['sort_order', 'ASC']],
  });

  settingsCache = settings;
  cacheTimestamp = now;

  return formatSettings(settings, includeSecrets);
}

async function getSettingsByGroup(db, groupName, { includeSecrets = false } = {}) {
  const settings = await db.AppSetting.findAll({
    where: { group_name: groupName },
    order: [['sort_order', 'ASC']],
  });

  return formatGroupSettings(settings, includeSecrets);
}

async function updateSettingsByGroup(db, groupName, updates, { userId, ip, userAgent } = {}) {
  const existing = await db.AppSetting.findAll({
    where: { group_name: groupName },
  });

  const existingMap = new Map(existing.map((s) => [s.key, s]));
  const auditLogs = [];

  for (const [key, newValue] of Object.entries(updates)) {
    let setting = existingMap.get(key);
    const definition = groupName === 'invoice' ? CREATE_ON_SAVE_INVOICE_SETTINGS[key] : null;
    if (!setting && definition) {
      setting = await db.AppSetting.create({
        key,
        value: '',
        group_name: groupName,
        is_sensitive: false,
        is_public: false,
        ...definition,
      });
      existingMap.set(key, setting);
    }
    if (!setting) continue;

    let valueToStore = newValue;

    if (setting.is_sensitive && newValue) {
      if (newValue === maskSensitiveValue(decrypt(setting.value))) continue;
      valueToStore = encrypt(String(newValue));
    } else if (setting.type === 'boolean') {
      valueToStore = String(newValue === true || newValue === 'true');
    } else if (setting.type === 'json') {
      valueToStore = typeof newValue === 'string' ? newValue : JSON.stringify(newValue);
    } else {
      valueToStore = newValue === null ? null : String(newValue);
    }

    const oldValue = setting.is_sensitive ? '[REDACTED]' : setting.value;
    const logNewValue = setting.is_sensitive ? '[REDACTED]' : valueToStore;

    auditLogs.push({
      user_id: userId,
      group_name: groupName,
      setting_key: key,
      old_value: oldValue,
      new_value: logNewValue,
      ip_address: ip,
      user_agent: userAgent,
    });

    await setting.update({ value: valueToStore });
  }

  if (auditLogs.length > 0) {
    try {
      await db.SettingsAuditLog.bulkCreate(auditLogs);
    } catch (err) {
      logger.error('Failed to write settings audit logs', { error: err.message });
    }
  }

  invalidateCache();

  if (groupName === 'maintenance') {
    try {
      const { invalidateMaintenanceCache } = require('../middlewares/maintenanceMode');
      invalidateMaintenanceCache();
    } catch {
      // middleware may not be loaded in all contexts
    }
  }

  if (groupName === 'stripe') {
    try {
      const { invalidateStripeClient } = require('../config/stripe');
      invalidateStripeClient();
    } catch {
      // stripe config may not be loaded in all contexts
    }
  }

  return getSettingsByGroup(db, groupName);
}

async function getPublicSettings(db) {
  const settings = await db.AppSetting.findAll({
    where: { is_public: true, is_sensitive: false },
    order: [['group_name', 'ASC'], ['sort_order', 'ASC']],
  });

  return formatSettings(settings, false);
}

async function getSettingByKey(db, key) {
  const setting = await db.AppSetting.findOne({ where: { key } });
  if (!setting) return null;

  if (setting.is_sensitive) {
    const value = decrypt(setting.value);
    return { ...setting.toJSON(), value: value === null ? null : value };
  }
  return setting.toJSON();
}

async function getAuditLogs(db, { page = 1, limit = 20, groupName } = {}) {
  const where = {};
  if (groupName) where.group_name = groupName;

  const offset = (page - 1) * limit;

  const { count, rows } = await db.SettingsAuditLog.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
    include: [
      {
        model: db.User,
        as: 'user',
        attributes: ['id', 'name', 'email'],
      },
    ],
  });

  return {
    logs: rows,
    pagination: {
      total: count,
      page,
      limit,
      total_pages: Math.ceil(count / limit),
    },
  };
}

async function deleteAllAuditLogs(db, { groupName } = {}) {
  const where = {};
  if (groupName) where.group_name = groupName;

  const deleted = await db.SettingsAuditLog.destroy({ where });
  return { deleted };
}

function formatSettings(settings, includeSecrets) {
  const grouped = {};

  for (const setting of settings) {
    const group = setting.group_name;
    if (!grouped[group]) grouped[group] = {};

    grouped[group][setting.key] = formatSingleSetting(setting, includeSecrets);
  }

  return grouped;
}

function formatGroupSettings(settings, includeSecrets) {
  const result = {};

  for (const setting of settings) {
    result[setting.key] = formatSingleSetting(setting, includeSecrets);
  }

  return result;
}

function formatSingleSetting(setting, includeSecrets) {
  let value = setting.value;

  if (setting.is_sensitive) {
    const decrypted = decrypt(value);
    if (includeSecrets) {
      value = decrypted === null ? null : decrypted;
    } else {
      value = decrypted === null ? null : maskSensitiveValue(decrypted);
    }
  } else if (setting.type === 'boolean') {
    value = value === 'true' || value === '1';
  } else if (setting.type === 'number') {
    value = value ? Number(value) : null;
  } else if (setting.type === 'json') {
    try {
      value = value ? JSON.parse(value) : null;
    } catch {
      // keep as string
    }
  }

  return {
    key: setting.key,
    value,
    type: setting.type,
    label: setting.label,
    description: setting.description,
    is_sensitive: setting.is_sensitive,
    group_name: setting.group_name,
    sort_order: setting.sort_order,
  };
}

async function getAdminPanelBranding(db) {
  const settings = await db.AppSetting.findAll({
    where: { key: { [Op.in]: ADMIN_PANEL_BRANDING_KEYS } },
    order: [['sort_order', 'ASC']],
  });

  const formatted = formatGroupSettings(settings, false);

  const primaryAllowed = new Set(['#E4101F', '#FF7A00', '#FFA92C', '#00A416']);
  let primaryColor = formatted.admin_panel_primary_color?.value || '#E4101F';
  const primaryUpper = String(primaryColor).toUpperCase();
  if (!primaryAllowed.has(primaryUpper)) {
    primaryColor = '#E4101F';
  } else {
    primaryColor = primaryUpper;
  }

  return {
    name: formatted.admin_panel_name?.value || 'Car Comfort',
    logo: formatted.admin_panel_logo?.value || null,
    favicon: formatted.admin_panel_favicon?.value || null,
    primary_color: primaryColor,
  };
}

module.exports = {
  SETTING_GROUPS,
  ADMIN_PANEL_BRANDING_KEYS,
  getAllSettings,
  getSettingsByGroup,
  updateSettingsByGroup,
  getPublicSettings,
  getAdminPanelBranding,
  getSettingByKey,
  getAuditLogs,
  deleteAllAuditLogs,
  invalidateCache,
};
