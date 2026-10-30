'use strict';

const { Op } = require('sequelize');
const db = require('../models');

/**
 * Auto-expire promotions whose end_date has passed.
 * Called on reads so the list stays up-to-date without a cron.
 */
async function autoExpirePromotions() {
  const today = new Date().toISOString().slice(0, 10);
  await db.PromotionalDiscount.update(
    { status: 'expired' },
    {
      where: {
        status: { [Op.in]: ['active', 'scheduled'] },
        end_date: { [Op.lt]: today },
      },
    }
  );
}

/**
 * Auto-activate promotions whose start_date has arrived and are still 'scheduled'.
 * Also fires customer notifications for newly-activated promos that had notify_customers=true.
 */
async function autoActivatePromotions() {
  const today = new Date().toISOString().slice(0, 10);

  // Find scheduled promos that should go active now
  const toActivate = await db.PromotionalDiscount.findAll({
    where: {
      status: 'scheduled',
      start_date: { [Op.lte]: today },
      [Op.or]: [{ end_date: null }, { end_date: { [Op.gte]: today } }],
    },
  });

  if (!toActivate.length) return;

  const ids = toActivate.map((p) => p.id);
  await db.PromotionalDiscount.update(
    { status: 'active' },
    { where: { id: { [Op.in]: ids } } }
  );

  // Fire notifications for promos that want it and haven't been notified yet
  const toNotify = toActivate.filter((p) => p.notify_customers && !p.notified_at);
  for (const promo of toNotify) {
    notifyCustomersOfPromotion(promo.id, promo.created_by)
      .then(() =>
        db.PromotionalDiscount.update(
          { notified_at: new Date() },
          { where: { id: promo.id } }
        )
      )
      .catch((err) => {
        console.error('[autoActivatePromotions] notify failed for promo', promo.id, err?.message);
      });
  }
}

async function syncPromotionStatuses() {
  await autoExpirePromotions();
  await autoActivatePromotions();
}

/**
 * Find the best active promotional discount applicable to a booking.
 * Evaluates the actual dollar discount each promo would give against the
 * booking subtotal and returns the one that saves the customer the most.
 * Falls back to a dummy subtotal of 1 when no subtotal is provided so that
 * percentage promos can still be ranked by their real value.
 *
 * @param {object} opts
 * @param {string}  [opts.serviceType]     - booking service type for filtering
 * @param {number|string} [opts.userId]    - customer user id for audience check
 * @param {number}  [opts.subtotal]        - booking subtotal before tax (used to
 *                                           pick best actual $ value)
 */
async function findActivePromotion({ serviceType, userId, subtotal } = {}) {
  await syncPromotionStatuses();

  const today = new Date().toISOString().slice(0, 10);

  const promos = await db.PromotionalDiscount.findAll({
    where: {
      status: 'active',
      [Op.or]: [{ start_date: null }, { start_date: { [Op.lte]: today } }],
      [Op.and]: [
        { [Op.or]: [{ end_date: null }, { end_date: { [Op.gte]: today } }] },
        { [Op.or]: [{ max_uses: null }, db.sequelize.literal('uses_count < max_uses')] },
      ],
    },
  });

  // Filter by service type and audience, then pick the one that gives the
  // highest actual dollar discount.
  const eligible = [];

  for (const promo of promos) {
    // Check service type match
    const services = promo.applicable_services;
    if (Array.isArray(services) && services.length > 0) {
      if (serviceType && !services.includes(serviceType)) continue;
    }

    // Check audience
    if (promo.audience === 'new_customers' && userId) {
      const bookingCount = await db.Booking.count({
        where: {
          user_id: userId,
          status: { [Op.notIn]: ['draft', 'cancelled', 'failed'] },
        },
      });
      if (bookingCount > 0) continue; // not a new customer
    }

    eligible.push(promo.get({ plain: true }));
  }

  if (!eligible.length) return null;
  if (eligible.length === 1) return eligible[0];

  // Use the actual booking subtotal when available; otherwise use a reference
  // value of 100 so percentages rank relative to each other sensibly.
  const refSubtotal = Number(subtotal) > 0 ? Number(subtotal) : 100;

  let best = null;
  let bestAmount = -1;

  for (const promo of eligible) {
    const amount = calcPromotionalDiscountAmount(promo, refSubtotal);
    if (amount > bestAmount) {
      bestAmount = amount;
      best = promo;
    }
  }

  return best;
}

/**
 * Calculate the promotional discount amount for a given subtotal.
 */
function calcPromotionalDiscountAmount(promo, subtotalBeforeTax) {
  if (!promo) return 0;
  const value = Number(promo.discount_value) || 0;
  if (promo.discount_type === 'flat') {
    return Math.min(value, subtotalBeforeTax);
  }
  // percentage
  return Number(((subtotalBeforeTax * value) / 100).toFixed(2));
}

/**
 * Increment uses_count when a booking is confirmed with a promo.
 */
async function recordPromotionUse(promoId, { transaction } = {}) {
  if (!promoId) return;
  await db.PromotionalDiscount.increment('uses_count', {
    by: 1,
    where: { id: promoId },
    transaction,
  });
}

// ─── Admin CRUD ─────────────────────────────────────────────────────────────

async function listPromotions({ page = 1, limit = 20, status } = {}) {
  await syncPromotionStatuses();

  const where = {};
  if (status) where.status = status;

  const offset = (Number(page) - 1) * Number(limit);

  const { count, rows } = await db.PromotionalDiscount.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: Number(limit),
    offset,
  });

  return { total: count, page: Number(page), limit: Number(limit), data: rows };
}

async function getPromotion(id) {
  return db.PromotionalDiscount.findByPk(id);
}

async function createPromotion(data, adminId) {
  const today = new Date().toISOString().slice(0, 10);
  let status = data.status || 'inactive';

  // Auto-set status based on dates if not explicitly set
  if (status !== 'inactive') {
    if (data.start_date && data.start_date > today) {
      status = 'scheduled';
    } else if (!data.start_date || data.start_date <= today) {
      status = 'active';
    }
  }

  const { notify_customers, ...promoData } = data;

  const promo = await db.PromotionalDiscount.create({
    ...promoData,
    notify_customers: !!notify_customers,
    status,
    uses_count: 0,
    created_by: adminId || null,
  });

  // Fire notification immediately if promotion is active and notify flag is set.
  // For scheduled promotions the notification goes out when autoActivatePromotions runs.
  if (notify_customers && status === 'active') {
    notifyCustomersOfPromotion(promo.id, adminId)
      .then(() =>
        db.PromotionalDiscount.update(
          { notified_at: new Date() },
          { where: { id: promo.id } }
        )
      )
      .catch((err) => {
        console.error('[createPromotion] auto-notify failed:', err?.message);
      });
  }

  return promo;
}

async function updatePromotion(id, data) {
  const promo = await db.PromotionalDiscount.findByPk(id);
  if (!promo) return null;
  await promo.update(data);
  return promo;
}

async function togglePromotion(id) {
  const promo = await db.PromotionalDiscount.findByPk(id);
  if (!promo) return null;

  const today = new Date().toISOString().slice(0, 10);
  let newStatus;

  if (promo.status === 'active') {
    newStatus = 'inactive';
  } else if (promo.status === 'inactive' || promo.status === 'scheduled') {
    // Reactivate — pick correct status
    if (promo.end_date && promo.end_date < today) {
      newStatus = 'expired'; // can't reactivate expired
    } else if (promo.start_date && promo.start_date > today) {
      newStatus = 'scheduled';
    } else {
      newStatus = 'active';
    }
  } else {
    // expired → can't toggle
    newStatus = promo.status;
  }

  await promo.update({ status: newStatus });
  return promo;
}

async function deletePromotion(id) {
  const promo = await db.PromotionalDiscount.findByPk(id);
  if (!promo) return false;
  await promo.destroy();
  return true;
}

/**
 * Send a push + email broadcast to all customers announcing a promotion.
 * Uses the existing notification campaign infrastructure.
 */
async function notifyCustomersOfPromotion(promoId, adminId) {
  const promo = await db.PromotionalDiscount.findByPk(promoId);
  if (!promo) throw new Error('Promotion not found');

  const { sendNotification } = require('./admin/adminNotificationManagement.service');

  // created_by is NOT NULL — resolve a valid admin id if none was passed
  let resolvedAdminId = adminId ? Number(adminId) : null;
  if (!resolvedAdminId) {
    const fallbackAdmin = await db.User.findOne({
      where: { role: 'admin' },
      attributes: ['id'],
      order: [['id', 'ASC']],
    });
    resolvedAdminId = fallbackAdmin?.id || null;
  }
  if (!resolvedAdminId) throw new Error('No admin account found to attribute this campaign to');

  const discountLabel =
    promo.discount_type === 'percentage'
      ? `${Number(promo.discount_value)}% off`
      : `$${Number(promo.discount_value).toFixed(2)} off`;

  const serviceScope =
    Array.isArray(promo.applicable_services) && promo.applicable_services.length > 0
      ? promo.applicable_services
          .map((s) =>
            s === 'car_wash' ? 'Car Wash' : s === 'ev_charging' ? 'EV Charging' : 'Combo'
          )
          .join(' & ')
      : 'all services';

  const dateNote =
    promo.end_date
      ? ` Valid until ${new Date(promo.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
      : '';

  const title = `🎉 ${discountLabel} — ${promo.name}`;
  const message =
    `Great news! CarComfort is running a special promotion: ${discountLabel} on ${serviceScope}.${dateNote} ` +
    `Book now through the app and save automatically — no code needed.`;

  const result = await sendNotification(resolvedAdminId, {
    campaign_name: `Promo Announcement: ${promo.name}`,
    notification_type: 'promotional',
    title,
    message,
    channels: ['push', 'email'],
    audience_filters: { segment: 'all_customers' },
  }, null);

  return result;
}

module.exports = {
  listPromotions,
  getPromotion,
  createPromotion,
  updatePromotion,
  togglePromotion,
  deletePromotion,
  findActivePromotion,
  calcPromotionalDiscountAmount,
  recordPromotionUse,
  syncPromotionStatuses,
  notifyCustomersOfPromotion,
};
