const { Op } = require('sequelize');
const db = require('../../models');
const { HttpError } = require('../../utils/httpError');
const { validatePricingRule } = require('../../services/pricingEngine.service');

// ─── LIST PRICING RULES ──────────────────────────────────────────────────────

async function listPricingRules(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      service_type,
      location_type,
      is_active,
      search,
      sort = 'created_at',
      order = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (service_type) where.service_type = service_type;
    if (location_type) where.location_type = location_type;
    if (is_active !== undefined) where.is_active = is_active === 'true';

    if (search) {
      where[Op.or] = [
        { country: { [Op.like]: `%${search}%` } },
        { state: { [Op.like]: `%${search}%` } },
        { county: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
      ];
    }

    const validSortFields = ['created_at', 'base_price', 'service_type', 'location_type', 'commission_percentage'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const result = await db.PricingRule.findAndCountAll({
      where,
      include: [
        { model: db.User, as: 'creator', attributes: ['id', 'name'] },
        { model: db.User, as: 'updater', attributes: ['id', 'name'] },
      ],
      order: [[sortField, sortOrder]],
      limit: limitNum,
      offset,
    });

    return res.success('Pricing rules fetched', {
      rows: result.rows,
      count: result.count,
      totalPages: Math.ceil(result.count / limitNum),
      currentPage: pageNum,
    });
  } catch (err) {
    return next(err);
  }
}

// ─── CREATE PRICING RULE ─────────────────────────────────────────────────────

async function createPricingRule(req, res, next) {
  try {
    const adminId = req.auth.userId;
    const ip = req.ip || req.headers['x-forwarded-for'];

    const ruleData = {
      service_type: req.body.service_type,
      location_type: req.body.location_type || 'default',
      country: req.body.country || null,
      state: req.body.state || null,
      county: req.body.county || null,
      city: req.body.city || null,
      base_price: req.body.base_price,
      surge_multiplier: req.body.surge_multiplier || 1.0,
      surge_enabled: req.body.surge_enabled || false,
      tax_percentage: req.body.tax_percentage || 0,
      commission_percentage: req.body.commission_percentage || 0,
      provider_earning_percentage: req.body.provider_earning_percentage || 0,
      peak_hour_multiplier: req.body.peak_hour_multiplier || null,
      peak_hour_start: req.body.peak_hour_start || null,
      peak_hour_end: req.body.peak_hour_end || null,
      weekend_multiplier: req.body.weekend_multiplier || null,
      effective_from: req.body.effective_from,
      effective_to: req.body.effective_to || null,
      is_active: req.body.is_active !== false,
      created_by: adminId,
      updated_by: adminId,
    };

    await validatePricingRule(ruleData);

    const rule = await db.PricingRule.create(ruleData);

    await db.FinancialAuditLog.create({
      admin_id: adminId,
      action: 'pricing_created',
      entity_type: 'pricing_rule',
      entity_id: rule.id,
      new_values: ruleData,
      ip_address: ip,
    });

    return res.success('Pricing rule created', rule, 201);
  } catch (err) {
    return next(err);
  }
}

// ─── UPDATE PRICING RULE ─────────────────────────────────────────────────────

async function updatePricingRule(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.auth.userId;
    const ip = req.ip || req.headers['x-forwarded-for'];

    const rule = await db.PricingRule.findByPk(id);
    if (!rule) throw new HttpError(404, 'Pricing rule not found');

    const previousValues = rule.get({ plain: true });

    const updatableFields = [
      'service_type', 'location_type', 'country', 'state', 'county', 'city',
      'base_price', 'surge_multiplier', 'surge_enabled', 'tax_percentage',
      'commission_percentage', 'provider_earning_percentage', 'peak_hour_multiplier',
      'peak_hour_start', 'peak_hour_end', 'weekend_multiplier',
      'effective_from', 'effective_to', 'is_active',
    ];

    const updateData = {};
    for (const field of updatableFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }
    updateData.updated_by = adminId;

    const merged = { ...previousValues, ...updateData };
    await validatePricingRule(merged, rule.id);

    await rule.update(updateData);

    await db.FinancialAuditLog.create({
      admin_id: adminId,
      action: 'pricing_updated',
      entity_type: 'pricing_rule',
      entity_id: rule.id,
      previous_values: previousValues,
      new_values: updateData,
      ip_address: ip,
    });

    return res.success('Pricing rule updated', rule);
  } catch (err) {
    return next(err);
  }
}

// ─── DELETE PRICING RULE ─────────────────────────────────────────────────────

async function deletePricingRule(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.auth.userId;
    const ip = req.ip || req.headers['x-forwarded-for'];

    const rule = await db.PricingRule.findByPk(id);
    if (!rule) throw new HttpError(404, 'Pricing rule not found');

    const previousValues = rule.get({ plain: true });

    await rule.update({ is_active: false, updated_by: adminId });

    await db.FinancialAuditLog.create({
      admin_id: adminId,
      action: 'pricing_deleted',
      entity_type: 'pricing_rule',
      entity_id: rule.id,
      previous_values: previousValues,
      ip_address: ip,
      notes: 'Soft deleted (deactivated)',
    });

    return res.success('Pricing rule deleted');
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listPricingRules,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
};
