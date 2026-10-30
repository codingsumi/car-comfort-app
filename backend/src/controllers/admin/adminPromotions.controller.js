'use strict';

const {
  listPromotions,
  getPromotion,
  createPromotion,
  updatePromotion,
  togglePromotion,
  deletePromotion,
  notifyCustomersOfPromotion,
} = require('../../services/promotionalDiscount.service');

async function list(req, res) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const result = await listPromotions({ page, limit, status });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[adminPromotions] list error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch promotions' });
  }
}

async function show(req, res) {
  try {
    const promo = await getPromotion(req.params.id);
    if (!promo) return res.status(404).json({ success: false, message: 'Promotion not found' });
    return res.json({ success: true, data: promo });
  } catch (err) {
    console.error('[adminPromotions] show error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch promotion' });
  }
}

async function create(req, res) {
  try {
    const adminId = req.admin?.id || null;
    const promo = await createPromotion(req.body, adminId);
    return res.status(201).json({ success: true, data: promo, message: 'Promotion created' });
  } catch (err) {
    console.error('[adminPromotions] create error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create promotion' });
  }
}

async function update(req, res) {
  try {
    const promo = await updatePromotion(req.params.id, req.body);
    if (!promo) return res.status(404).json({ success: false, message: 'Promotion not found' });
    return res.json({ success: true, data: promo, message: 'Promotion updated' });
  } catch (err) {
    console.error('[adminPromotions] update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update promotion' });
  }
}

async function toggle(req, res) {
  try {
    const promo = await togglePromotion(req.params.id);
    if (!promo) return res.status(404).json({ success: false, message: 'Promotion not found' });
    return res.json({ success: true, data: promo, message: `Promotion is now ${promo.status}` });
  } catch (err) {
    console.error('[adminPromotions] toggle error:', err);
    return res.status(500).json({ success: false, message: 'Failed to toggle promotion' });
  }
}

async function remove(req, res) {
  try {
    const ok = await deletePromotion(req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: 'Promotion not found' });
    return res.json({ success: true, message: 'Promotion deleted' });
  } catch (err) {
    console.error('[adminPromotions] delete error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete promotion' });
  }
}

async function notifyCustomers(req, res) {
  try {
    const adminId = req.auth?.userId || req.admin?.id || null;
    const result = await notifyCustomersOfPromotion(req.params.id, adminId);
    return res.json({
      success: true,
      message: `Notification sent to ${result.audience_size} customers`,
      audience_size: result.audience_size,
      campaign_id: result.campaign?.id,
    });
  } catch (err) {
    console.error('[adminPromotions] notify error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to send notification' });
  }
}

module.exports = { list, show, create, update, toggle, remove, notifyCustomers };
