const {
  getRevenueReport,
  getRefundReport,
  getPayoutReport,
  getTaxReport,
  exportReport,
} = require('../../services/financialReport.service');

async function revenueReport(req, res, next) {
  try {
    const data = await getRevenueReport(req.query);
    return res.success('Revenue report fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function refundReport(req, res, next) {
  try {
    const data = await getRefundReport(req.query);
    return res.success('Refund report fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function payoutReport(req, res, next) {
  try {
    const data = await getPayoutReport(req.query);
    return res.success('Payout report fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function taxReport(req, res, next) {
  try {
    const data = await getTaxReport(req.query);
    return res.success('Tax report fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function handleExport(req, res, next) {
  try {
    const { type } = req.query;
    if (!type) {
      return res.fail('Report type is required', 400);
    }

    const validTypes = ['revenue', 'refunds', 'payouts', 'taxes', 'commissions'];
    if (!validTypes.includes(type)) {
      return res.fail(`Invalid report type. Must be one of: ${validTypes.join(', ')}`, 400);
    }

    const { csv } = await exportReport(type, req.query);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-report-${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  revenueReport,
  refundReport,
  payoutReport,
  taxReport,
  handleExport,
};
