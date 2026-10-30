'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');

const {
  resolveAppTimeZone,
  formatDateTimeInTimeZone,
  formatDateInTimeZone,
  formatDurationMinutes,
  formatProviderId,
} = require('../utils/timezoneFormat');

function formatUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function serviceTypeLabel(serviceType) {
  if (!serviceType) return 'Service';
  const raw = String(serviceType).trim();
  if (raw === 'ev_charging') return 'EV Charging';
  if (raw === 'car_wash') return 'Car Wash';
  if (raw === 'combo') return 'Combo Service';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatCustomerName(user) {
  if (!user) return 'Customer';
  const combined = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return combined || user.name || user.email || 'Customer';
}

function formatProviderName(provider) {
  if (!provider) return 'Service Provider';
  const combined = [provider.first_name, provider.last_name].filter(Boolean).join(' ').trim();
  return combined || provider.name || provider.email || 'Service Provider';
}

function resolvePickupDropoffAddress(booking) {
  return String(booking?.address || '').trim() || '—';
}

function resolveServiceLocationAddress(booking) {
  const type = String(booking?.service_type || '').trim();
  if (type === 'ev_charging' || type === 'combo') {
    return (
      String(booking?.ev_charging_address || '').trim() ||
      String(booking?.service_address || '').trim() ||
      String(booking?.service_location_name || '').trim() ||
      '—'
    );
  }
  if (type === 'car_wash') {
    return (
      String(booking?.service_address || '').trim() ||
      String(booking?.address || '').trim() ||
      '—'
    );
  }
  return (
    String(booking?.service_address || '').trim() ||
    String(booking?.ev_charging_address || '').trim() ||
    '—'
  );
}

function buildJobIdDisplay(booking) {
  if (booking?.booking_code) return `#${booking.booking_code}`;
  if (booking?.id) return `#${booking.id}`;
  return '—';
}

async function loadLogoPngBuffer() {
  const svgPath = path.join(__dirname, '..', '..', 'assets', 'images', 'logo.svg');
  const svg = fs.readFileSync(svgPath);
  return sharp(svg).resize({ width: 240 }).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

function drawLabelValue(doc, label, value, x, width) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151').text(label, x, doc.y, { width });
  doc.font('Helvetica').fontSize(11).fillColor('#111827').text(value || '—', x, doc.y + 2, { width });
  doc.moveDown(0.8);
}

async function generateProviderServiceRecordPdf({
  booking,
  provider,
  customer,
  providerEarning = null,
}) {
  const timeZone = resolveAppTimeZone();
  const logoPng = await loadLogoPngBuffer();
  const companyName = String(process.env.INVOICE_COMPANY_NAME || 'CarComfort').trim();

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    compress: true,
    pdfVersion: '1.5',
  });

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const margin = doc.page.margins.left;
  const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.image(logoPng, margin, 40, { width: 130 });
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#111827')
    .text(companyName, margin + 150, 48, { width: contentW - 150 });
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#4B5563')
    .text('Service Provider Job Record', margin + 150, doc.y + 4, { width: contentW - 150 });

  doc.moveDown(2.2);
  doc.moveTo(margin, doc.y).lineTo(margin + contentW, doc.y).strokeColor('#E5E7EB').stroke();
  doc.moveDown(0.8);

  const serviceDate =
    booking?.service_completed_at ||
    booking?.service_started_at ||
    booking?.scheduled_at ||
    booking?.created_at;

  const durationMinutes =
    // Prefer the measured duration (written at completion) for accuracy.
    booking?.actual_service_duration_minutes != null
      ? Number(booking.actual_service_duration_minutes)
      : booking?.service_duration_minutes != null
        ? Number(booking.service_duration_minutes)
        : booking?.service_started_at && booking?.service_completed_at
          ? Math.max(
              0,
              Math.round(
                (new Date(booking.service_completed_at).getTime() -
                  new Date(booking.service_started_at).getTime()) / 60000
              )
            )
          : null;

  drawLabelValue(doc, 'Name of service provider', formatProviderName(provider), margin, contentW);
  drawLabelValue(doc, 'Service provider ID', formatProviderId(provider?.id), margin, contentW);
  drawLabelValue(doc, 'Service type', serviceTypeLabel(booking?.service_type), margin, contentW);
  drawLabelValue(doc, 'Job ID', buildJobIdDisplay(booking), margin, contentW);
  drawLabelValue(
    doc,
    'Date of service',
    formatDateInTimeZone(serviceDate, { timeZone }),
    margin,
    contentW
  );
  drawLabelValue(
    doc,
    'Service started (customer PIN verified)',
    formatDateTimeInTimeZone(booking?.service_started_at, { timeZone }),
    margin,
    contentW
  );
  drawLabelValue(
    doc,
    'Service completed',
    formatDateTimeInTimeZone(booking?.service_completed_at, { timeZone }),
    margin,
    contentW
  );
  drawLabelValue(
    doc,
    'Duration of service',
    formatDurationMinutes(durationMinutes),
    margin,
    contentW
  );
  drawLabelValue(
    doc,
    'Service provider earning',
    providerEarning != null ? formatUsd(providerEarning) : '—',
    margin,
    contentW
  );

  doc.moveDown(0.4);
  doc.moveTo(margin, doc.y).lineTo(margin + contentW, doc.y).strokeColor('#E5E7EB').stroke();
  doc.moveDown(0.8);

  drawLabelValue(doc, 'Name of customer', formatCustomerName(customer), margin, contentW);
  drawLabelValue(
    doc,
    'Vehicle pick-up/drop-off location',
    resolvePickupDropoffAddress(booking),
    margin,
    contentW
  );
  drawLabelValue(doc, 'Service location', resolveServiceLocationAddress(booking), margin, contentW);

  doc.moveDown(1);
  const footerY = doc.y;
  doc.roundedRect(margin, footerY, contentW, 88, 8).strokeColor('#E5E7EB').stroke();
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor('#6B7280')
    .text(
      `Generated ${formatDateTimeInTimeZone(new Date(), { timeZone })}. ` +
        'Service duration is measured from customer 4-digit PIN verification through service completion ' +
        '(0–3 hour service timer). Timestamps are shown in ' +
        `${timeZone}. This record may be used for insurance, claims, and law-enforcement purposes.`,
      margin + 12,
      footerY + 12,
      { width: contentW - 24, lineGap: 2 }
    );

  doc.end();
  return done;
}

module.exports = {
  generateProviderServiceRecordPdf,
  resolvePickupDropoffAddress,
  resolveServiceLocationAddress,
  formatProviderName,
  formatCustomerName,
};
