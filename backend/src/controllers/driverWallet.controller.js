const { getProviderWalletForAuth } = require('../services/providerWallet.service');
const {
  listDriverWalletTransactions,
  requestDriverPayout,
  getDriverStripeConnectStatus,
} = require('../services/driverWallet.service');
const { generateDriverEarningsStatementPdf } = require('../services/driverEarningsStatement.service');
const { reconnectConnectAccount } = require('../services/stripeConnect.service');

async function getWallet(req, res, next) {
  try {
    const data = await getProviderWalletForAuth(req.auth || {});
    return res.success('Wallet fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function listTransactions(req, res, next) {
  try {
    const data = await listDriverWalletTransactions(req.auth || {}, req.query, req);
    return res.success('Wallet transactions fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function createPayout(req, res, next) {
  try {
    const data = await requestDriverPayout(req.auth || {}, { amount: req.body?.amount });
    return res.success('Payout requested', data);
  } catch (err) {
    return next(err);
  }
}

async function getConnectStatus(req, res, next) {
  try {
    const data = await getDriverStripeConnectStatus(req.auth || {});
    const message = data.kyc_complete
      ? 'Stripe Connect verified'
      : data.kyc_url
        ? 'Stripe Connect status — complete KYC using kyc_url'
        : 'Stripe Connect status fetched';
    return res.success(message, data);
  } catch (err) {
    return next(err);
  }
}

async function reconnectConnect(req, res, next) {
  try {
    const data = await reconnectConnectAccount(req.auth.userId);
    return res.success('Stripe Connect reconnected — please complete KYC', data);
  } catch (err) {
    return next(err);
  }
}

async function downloadEarningsStatement(req, res, next) {
  try {
    const { buffer, filename } = await generateDriverEarningsStatementPdf(
      req.auth || {},
      req.query || {},
      req,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getWallet,
  listTransactions,
  createPayout,
  getConnectStatus,
  reconnectConnect,
  downloadEarningsStatement,
};
