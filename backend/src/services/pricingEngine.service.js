const { Op } = require('sequelize');
const db = require('../models');
const { HttpError } = require('../utils/httpError');

const LOCATION_PRIORITY = ['city', 'county', 'state', 'country', 'default'];

async function resolvePricing({ serviceType, city, county, state, country }) {
  const today = new Date().toISOString().slice(0, 10);

  const rules = await db.PricingRule.findAll({
    where: {
      service_type: serviceType,
      is_active: true,
      effective_from: { [Op.lte]: today },
      [Op.or]: [
        { effective_to: null },
        { effective_to: { [Op.gte]: today } },
      ],
    },
    order: [['location_type', 'ASC']],
  });

  if (!rules.length) return null;

  for (const locType of LOCATION_PRIORITY) {
    const match = rules.find((r) => {
      if (r.location_type !== locType) return false;
      if (locType === 'default') return true;
      if (locType === 'country') return r.country === country;
      if (locType === 'state') return r.country === country && r.state === state;
      if (locType === 'county') return r.country === country && r.state === state && r.county === county;
      if (locType === 'city') return r.country === country && r.state === state && r.city === city;
      return false;
    });
    if (match) return match.get({ plain: true });
  }

  return null;
}

async function validatePricingRule(rule, excludeId = null) {
  if (rule.commission_percentage !== undefined && rule.provider_earning_percentage !== undefined) {
    const total = parseFloat(rule.commission_percentage) + parseFloat(rule.provider_earning_percentage);
    if (total > 100) {
      throw new HttpError(400, 'Commission + provider earning percentage cannot exceed 100%');
    }
  }

  if (rule.tax_percentage !== undefined && parseFloat(rule.tax_percentage) > 50) {
    throw new HttpError(400, 'Tax percentage cannot exceed 50%');
  }

  if (rule.surge_multiplier !== undefined && parseFloat(rule.surge_multiplier) > 10) {
    throw new HttpError(400, 'Surge multiplier cannot exceed 10x');
  }

  if (rule.base_price !== undefined && parseFloat(rule.base_price) < 0) {
    throw new HttpError(400, 'Base price cannot be negative');
  }

  if (rule.peak_hour_start && rule.peak_hour_end && rule.peak_hour_start >= rule.peak_hour_end) {
    throw new HttpError(400, 'Peak hour start must be before peak hour end');
  }

  if (rule.effective_from && rule.effective_to && rule.effective_from > rule.effective_to) {
    throw new HttpError(400, 'Effective from date must be before effective to date');
  }

  const overlapWhere = {
    service_type: rule.service_type,
    location_type: rule.location_type,
    is_active: true,
  };
  if (rule.country) overlapWhere.country = rule.country;
  if (rule.state) overlapWhere.state = rule.state;
  if (rule.county) overlapWhere.county = rule.county;
  if (rule.city) overlapWhere.city = rule.city;
  if (excludeId) overlapWhere.id = { [Op.ne]: excludeId };

  if (rule.effective_from) {
    overlapWhere[Op.or] = [
      { effective_to: null, effective_from: { [Op.lte]: rule.effective_to || '9999-12-31' } },
      {
        effective_to: { [Op.gte]: rule.effective_from },
        effective_from: { [Op.lte]: rule.effective_to || '9999-12-31' },
      },
    ];
  }

  const overlap = await db.PricingRule.findOne({ where: overlapWhere });
  if (overlap) {
    throw new HttpError(
      400,
      `Overlapping pricing rule exists (ID: ${overlap.id}) for ${rule.service_type} at ${rule.location_type} level`
    );
  }
}

module.exports = {
  resolvePricing,
  validatePricingRule,
};
