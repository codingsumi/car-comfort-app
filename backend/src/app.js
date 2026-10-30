const path = require('path');
const express = require('express');
const cors = require('cors');

const { notFoundHandler } = require('./middlewares/notFoundHandler');
const { errorHandler } = require('./middlewares/errorHandler');
const authRoutes = require('./routes/auth.routes');
const driverRoutes = require('./routes/driver.routes');
const customerRoutes = require('./routes/customer.routes');
const appCustomerRoutes = require('./routes/appCustomer.routes');
const paymentRoutes = require('./routes/payment.routes');
const serviceRoutes = require('./routes/service.routes');
const packageRoutes = require('./routes/package.routes');
const bookingRoutes = require('./routes/booking.routes');
const bookingV2Routes = require('./routes/bookingV2.routes');
const accountDeletionRequestRoutes = require('./routes/accountDeletionRequest.routes');
const refundRoutes = require('./routes/refund.routes');
const vehicleRoutes = require('./routes/vehicle.routes');
const vehicleTypeRoutes = require('./routes/vehicleType.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const adminDriverRoutes = require('./routes/adminDriver.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const tutorialRoutes = require('./routes/tutorial.routes');
const { formatResponse } = require('./traits/formatResponse');
const { sequelize } = require('./config/sequelize');
const { logger } = require('./config/logger');
const adminAuthRoutes = require('./routes/admin/auth/auth.routes');
const adminUsersRoutes = require('./routes/admin/adminUsers.routes');
const adminTutorialRoutes = require('./routes/admin/adminTutorial.routes');
const legalPageRoutes = require('./routes/legalPage.routes');
const legalPagesRoutes = require('./routes/legalPages.routes');
const adminLegalPageRoutes = require('./routes/admin/adminLegalPage.routes');
const adminDashboardRoutes = require('./routes/admin/adminDashboard.routes');
const adminBookingsRoutes = require('./routes/admin/adminBookings.routes');
const adminPaymentsRoutes = require('./routes/admin/adminPayments.routes');
const adminDriversListRoutes = require('./routes/admin/adminDriversList.routes');
const adminVehiclesRoutes = require('./routes/admin/adminVehicles.routes');
const adminNotificationsRoutes = require('./routes/admin/adminNotifications.routes');
const adminNotificationManagementRoutes = require('./routes/admin/adminNotificationManagement.routes');
const adminSettingsRoutes = require('./routes/admin/adminSettings.routes');
const adminCustomersRoutes = require('./routes/admin/adminCustomers.routes');
const adminProvidersRoutes = require('./routes/admin/adminProviders.routes');
const adminFinanceRoutes = require('./routes/admin/adminFinance.routes');
const adminPricingRoutes = require('./routes/admin/adminPricing.routes');
const adminPromotionsRoutes = require('./routes/admin/adminPromotions.routes');
const adminCatalogRoutes = require('./routes/admin/adminCatalog.routes');
const adminVehicleTypesRoutes = require('./routes/admin/adminVehicleTypes.routes');
const adminBookingChargesRoutes = require('./routes/admin/adminBookingCharges.routes');
const adminProviderPerformanceRoutes = require('./routes/admin/adminProviderPerformance.routes');
const adminContentModerationRoutes = require('./routes/admin/adminContentModeration.routes');
const adminSupportRoutes = require('./routes/admin/adminSupport.routes');
const adminSecurityRoutes = require('./routes/admin/adminSecurity.routes');
const adminAnalyticsRoutes = require('./routes/admin/adminAnalytics.routes');
const adminAccountDeletionRequestsRoutes = require('./routes/admin/adminAccountDeletionRequests.routes');
const onesignalWebhookRoutes = require('./routes/webhooks/onesignal.routes');
const stripeWebhookRoutes = require('./routes/webhooks/stripe.routes');
const appStatusRoutes = require('./routes/appStatus.routes');
const { maintenanceModeGuard } = require('./middlewares/maintenanceMode');

const app = express();
const blockDuringMaintenance = maintenanceModeGuard();

function configureTrustProxy(expressApp) {
  const raw = String(process.env.TRUST_PROXY ?? '').trim().toLowerCase();
  if (raw === 'false' || raw === '0') return;

  if (raw === 'true' || raw === '1') {
    expressApp.set('trust proxy', 1);
    return;
  }

  if (raw) {
    expressApp.set('trust proxy', process.env.TRUST_PROXY);
    return;
  }

  // Production behind a reverse proxy (nginx/Apache): always trust proxy.
  // Local dev: Next.js / admin-panel rewrites forward X-Forwarded-For.
  expressApp.set('trust proxy', 1);
}

configureTrustProxy(app);

app.use(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookRoutes
);
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001').split(',').map(s => s.trim()),
  credentials: true,
}));
app.use(formatResponse);

const uploadPublicBase = process.env.UPLOAD_PUBLIC_BASE || '/uploads';
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use(uploadPublicBase, express.static(uploadDir));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// check server health — no credentials returned; /health/db requires admin auth
app.get('/health', (_req, res) => {
  return res.json({ status: 'ok' });
});

// check database health — admin-only; strips error internals from response
{
  const { adminAuth } = require('./middlewares/admin/auth/authMiddleware');
  app.get('/health/db', adminAuth, async (_req, res) => {
    try {
      await sequelize.authenticate();
      return res.success('db ok');
    } catch (err) {
      logger.error('DB health check failed', { message: err?.message, code: err?.code, errno: err?.errno });
      return res.fail('db error', 500);
    }
  });
}

app.get('/delete-account-request', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Delete Account Request &mdash; Car Comfort</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f5f5f5; color: #1a1a1a;
      min-height: 100vh; display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 24px 16px;
    }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 40px 36px; max-width: 520px; width: 100%; }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo-text { font-size: 22px; font-weight: 700; color: #c0392b; letter-spacing: -0.3px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
    p { font-size: 14px; color: #555; line-height: 1.6; margin-bottom: 16px; }
    .warning { background: #fff5f5; border: 1px solid #fcc; border-radius: 10px; padding: 14px 16px; font-size: 13px; color: #c0392b; margin-bottom: 24px; line-height: 1.5; }
    label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #333; }
    input, textarea { width: 100%; padding: 11px 14px; border: 1.5px solid #ddd; border-radius: 10px; font-size: 14px; font-family: inherit; color: #1a1a1a; outline: none; transition: border-color 0.2s; margin-bottom: 4px; }
    input:focus, textarea:focus { border-color: #c0392b; }
    textarea { min-height: 90px; resize: vertical; margin-bottom: 16px; }
    .field-row { margin-bottom: 16px; }
    .change-link { display: inline-block; font-size: 12px; color: #c0392b; cursor: pointer; text-decoration: underline; margin-bottom: 12px; }
    button { width: 100%; padding: 14px; background: #c0392b; color: #fff; font-size: 15px; font-weight: 700; border: none; border-radius: 10px; cursor: pointer; transition: background 0.2s; margin-top: 4px; }
    button:hover { background: #a93226; }
    button:disabled { background: #e0a09a; cursor: not-allowed; }
    .hint { font-size: 12px; color: #888; margin-bottom: 16px; }
    .divider { text-align: center; font-size: 13px; color: #aaa; margin: 20px 0; }
    .email-link { display: block; text-align: center; font-size: 14px; color: #c0392b; text-decoration: none; font-weight: 600; }
    .email-link:hover { text-decoration: underline; }
    .success-msg { display: none; background: #eafaf1; border: 1px solid #a9dfbf; border-radius: 10px; padding: 20px; color: #1e8449; font-size: 14px; text-align: center; line-height: 1.6; }
    .footer { margin-top: 28px; text-align: center; font-size: 12px; color: #aaa; }
    .footer a { color: #aaa; text-decoration: underline; }
    #step2 { display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo"><span class="logo-text">Car Comfort</span></div>
    <h1>Request Account Deletion</h1>
    <p>You can delete your Car Comfort account and all associated data at any time. This action is irreversible.</p>
    <div class="warning">&#9888;&nbsp; Deleting your account will permanently remove your profile, booking history, and all personal data. Complete or cancel any active bookings before requesting deletion.</div>

    <form id="deletionForm">
      <!-- Step 1 -->
      <div id="step1">
        <div class="field-row">
          <label for="email">Email address on your account</label>
          <input type="email" id="email" name="email" placeholder="you@example.com" required autocomplete="email" />
        </div>
        <button type="submit" id="submitBtn">Send Verification Code</button>
      </div>

      <!-- Step 2 -->
      <div id="step2">
        <div class="field-row">
          <label>Email address</label>
          <input type="email" id="emailDisplay" disabled />
          <span class="change-link" id="changeEmailBtn">&#x270E; Change email</span>
        </div>
        <div class="field-row">
          <label for="otp">Verification code <span style="font-weight:400;color:#888">(sent to your email)</span></label>
          <input type="text" id="otp" name="otp" placeholder="Enter 6-digit code" maxlength="6" inputmode="numeric" autocomplete="one-time-code" />
          <span class="hint">Check your spam/junk folder if you don&rsquo;t see it. Code expires in 10 minutes.</span>
        </div>
        <div class="field-row">
          <label for="reason">Reason for deletion <span style="font-weight:400;color:#888">(optional)</span></label>
          <textarea id="reason" name="reason" placeholder="Let us know why you want to delete your account…"></textarea>
        </div>
        <button type="submit" id="submitBtn2">Confirm Account Deletion</button>
      </div>
    </form>

    <div class="success-msg" id="successMsg">
      &#10003;&nbsp; Your deletion request has been received.<br />We will process it within 30 days and send a confirmation to your email.
    </div>

    <div class="divider">or contact us directly</div>
    <a class="email-link" href="mailto:info@carcomfort-llc.com?subject=Account%20Deletion%20Request">info@carcomfort-llc.com</a>
    <div class="footer">
      <a href="https://carcomfort-llc.com/privacy-policy/">Privacy Policy</a> &nbsp;&middot;&nbsp;
      <a href="https://carcomfort-llc.com">carcomfort-llc.com</a>
    </div>
  </div>
  <script>
    const form        = document.getElementById('deletionForm');
    const step1       = document.getElementById('step1');
    const step2       = document.getElementById('step2');
    const emailInput  = document.getElementById('email');
    const emailDisplay= document.getElementById('emailDisplay');
    const otpInput    = document.getElementById('otp');
    const btn         = document.getElementById('submitBtn');
    const btn2        = document.getElementById('submitBtn2');
    const msg         = document.getElementById('successMsg');
    const changeBtn   = document.getElementById('changeEmailBtn');
    let verifiedEmail = '';

    changeBtn.addEventListener('click', () => {
      step2.style.display = 'none';
      step1.style.display = 'block';
      emailInput.value = verifiedEmail;
      emailInput.disabled = false;
      otpInput.value = '';
      btn.disabled = false;
      btn.textContent = 'Send Verification Code';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const active = step1.style.display !== 'none' ? 1 : 2;

      if (active === 1) {
        btn.disabled = true;
        btn.textContent = 'Sending code…';
        try {
          const res = await fetch('/api/account-deletion-requests/public/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailInput.value.trim() }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            verifiedEmail = emailInput.value.trim();
            emailDisplay.value = verifiedEmail;
            step1.style.display = 'none';
            step2.style.display = 'block';
          } else {
            alert(data.message || 'Could not send verification code. Please try again.');
            btn.disabled = false;
            btn.textContent = 'Send Verification Code';
          }
        } catch (_) {
          alert('Could not connect. Please email us at info@carcomfort-llc.com');
          btn.disabled = false;
          btn.textContent = 'Send Verification Code';
        }

      } else {
        btn2.disabled = true;
        btn2.textContent = 'Submitting…';
        try {
          const res = await fetch('/api/account-deletion-requests/public/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: verifiedEmail,
              otp: otpInput.value.trim(),
              reason: document.getElementById('reason').value.trim(),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            form.style.display = 'none';
            msg.style.display = 'block';
          } else {
            alert(data.message || 'Invalid code. Please check and try again, or use the Change email link to start over.');
            btn2.disabled = false;
            btn2.textContent = 'Confirm Account Deletion';
          }
        } catch (_) {
          alert('Could not connect. Please email us at info@carcomfort-llc.com');
          btn2.disabled = false;
          btn2.textContent = 'Confirm Account Deletion';
        }
      }
    });
  </script>
</body>
</html>`)
});

app.use('/api/webhooks/onesignal', onesignalWebhookRoutes);

app.use('/api/app', appStatusRoutes);
app.use('/api/app/customer', blockDuringMaintenance, appCustomerRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/driver', blockDuringMaintenance, driverRoutes);
app.use('/api/customer', blockDuringMaintenance, customerRoutes);

app.use('/api/admin', adminAuthRoutes);
app.use('/api/admin', adminUsersRoutes);
app.use('/api/admin', adminTutorialRoutes);
app.use('/api/admin', adminLegalPageRoutes);
app.use('/api/admin', adminDashboardRoutes);
app.use('/api/admin', adminBookingsRoutes);
app.use('/api/admin', adminPaymentsRoutes);
app.use('/api/admin', adminDriversListRoutes);
app.use('/api/admin', adminVehiclesRoutes);
app.use('/api/admin', adminNotificationManagementRoutes);
app.use('/api/admin', adminNotificationsRoutes);
app.use('/api/admin', adminSettingsRoutes);
app.use('/api/admin', adminCustomersRoutes);
app.use('/api/admin', adminProvidersRoutes);
app.use('/api/admin', adminFinanceRoutes);
app.use('/api/admin', adminPricingRoutes);
app.use('/api/admin', adminPromotionsRoutes);
app.use('/api/admin', adminCatalogRoutes);
app.use('/api/admin', adminVehicleTypesRoutes);
app.use('/api/admin', adminBookingChargesRoutes);
app.use('/api/admin', adminProviderPerformanceRoutes);
app.use('/api/admin', adminAnalyticsRoutes);
app.use('/api/admin', adminSupportRoutes);
app.use('/api/admin', adminSecurityRoutes);
app.use('/api/admin', adminContentModerationRoutes);
app.use('/api/admin', adminAccountDeletionRequestsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/account-deletion-requests', accountDeletionRequestRoutes);
app.use('/api/bookings', blockDuringMaintenance, bookingRoutes);
app.use('/api/bookings', blockDuringMaintenance, bookingV2Routes);
app.use('/api/refunds', refundRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/vehicle-types', vehicleTypeRoutes);
app.use('/invoices', invoiceRoutes);
app.use('/api/admin', adminDriverRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/tutorial', tutorialRoutes);
app.use('/api/legal-page', legalPageRoutes);
app.use('/api/legal-pages', legalPagesRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
