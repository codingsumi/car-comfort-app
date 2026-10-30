const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const { validateRequest } = require('../../middlewares/validateRequest');
const {
  listTransactions,
  getTransaction,
  listPayouts,
  getPayoutDashboard,
  handleManualPayout,
  getPayoutDetail,
  getProviderEarningsEndpoint,
  exportTransactionsCsv,
  listRefundHistory,
} = require('../../controllers/admin/adminFinance.controller');
const {
  revenueReport,
  refundReport,
  payoutReport,
  taxReport,
  handleExport,
} = require('../../controllers/admin/adminReports.controller');
const {
  manualPayoutValidator,
  transactionIdValidator,
  payoutIdValidator,
  providerIdValidator,
} = require('../../validators/finance.validator');

// Transactions
router.get('/finance/transactions', adminAuth, listTransactions);
router.get('/finance/transactions/export', adminAuth, exportTransactionsCsv);
router.get('/finance/transactions/:id', adminAuth, transactionIdValidator, validateRequest, getTransaction);

// Payouts
router.get('/finance/payouts/dashboard', adminAuth, getPayoutDashboard);
router.get('/finance/payouts', adminAuth, listPayouts);
router.post('/finance/payouts/manual', adminAuth, manualPayoutValidator, validateRequest, handleManualPayout);
router.get('/finance/payouts/:id', adminAuth, payoutIdValidator, validateRequest, getPayoutDetail);
router.get('/finance/providers/:providerId/earnings', adminAuth, providerIdValidator, validateRequest, getProviderEarningsEndpoint);

// Refunds
router.get('/finance/refunds', adminAuth, listRefundHistory);

// Reports
router.get('/finance/reports/revenue', adminAuth, revenueReport);
router.get('/finance/reports/refunds', adminAuth, refundReport);
router.get('/finance/reports/payouts', adminAuth, payoutReport);
router.get('/finance/reports/taxes', adminAuth, taxReport);
router.get('/finance/reports/export', adminAuth, handleExport);

module.exports = router;
