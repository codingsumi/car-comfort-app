const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const sharp = require('sharp');
const db = require('../models');
const {
  formatDateTimeInTimeZone,
  formatDateInTimeZone,
} = require('../utils/timezoneFormat');

function formatUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function asLines(value) {
  if (!value) return [];
  const s = String(value).trim();
  if (!s) return [];
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function formatDateTime(value) {
  return formatDateTimeInTimeZone(value);
}

function formatDate(value) {
  return formatDateInTimeZone(value);
}

function buildInvoiceNumber(booking) {
  if (booking?.booking_code) return String(booking.booking_code);
  if (booking?.id) return String(booking.id);
  return String(Date.now());
}

function normalizeHttpUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/\/$/, '')}`;
}

function resolveInvoicePublicBaseUrl() {
  // Prefer a dedicated invoice base url, then fall back to PUBLIC_BASE_URL / INVOICE_WEBSITE.
  const explicit = normalizeHttpUrl(process.env.INVOICE_PUBLIC_BASE_URL || process.env.INVOICE_QR_BASE_URL);
  if (explicit) return explicit;
  const publicBase = normalizeHttpUrl(process.env.PUBLIC_BASE_URL);
  if (publicBase) return publicBase;
  const website = normalizeHttpUrl(process.env.INVOICE_WEBSITE);
  return website;
}

const { getSupportContact } = require('./settingsRuntime.service');
const { getSettingByKey } = require('./settings.service');

const DEFAULT_COMPANY_ADDRESS = '166 Geary Street\nSan Francisco, California 94108';
const DEFAULT_RECEIPT_NOTES =
  'This receipt was generated electronically and is valid without a signature. Prices are in USD. For questions, please contact Car Comfort support.';

function isPlaceholderValue(value) {
  return /\b(demo|test|placeholder)\b/i.test(String(value || ''));
}

async function resolveInvoiceSetting(key, envKey, fallback = '') {
  try {
    const setting = await getSettingByKey(db, key);
    const value = String(setting?.value || '').trim();
    if (value) return value;
  } catch {
    // Fall back to environment configuration when settings are unavailable.
  }

  return String(envKey ? process.env[envKey] || '' : fallback).trim() || fallback;
}

async function loadLogoPngBuffer() {
  const svgPath = path.join(__dirname, '..', '..', 'assets', 'images', 'logo.svg');
  const svg = fs.readFileSync(svgPath);
  // Keep it lightweight: rasterize small, no alpha needed.
  return await sharp(svg).resize({ width: 240 }).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

async function generateQrPngBuffer(url) {
  if (!url) return null;
  return await QRCode.toBuffer(String(url), {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 140
  });
}

async function getCompanyDetails() {
  const [name, websiteRaw, invoiceEmail, invoicePhone, addressRaw, taxIdRaw, footerNotesRaw] = await Promise.all([
    resolveInvoiceSetting('invoice_company_name', 'INVOICE_COMPANY_NAME', 'Car Comfort LLC'),
    resolveInvoiceSetting('invoice_website', 'INVOICE_WEBSITE'),
    resolveInvoiceSetting('invoice_email', 'INVOICE_EMAIL'),
    resolveInvoiceSetting('invoice_phone', 'INVOICE_PHONE'),
    resolveInvoiceSetting('invoice_address', 'INVOICE_COMPANY_ADDRESS', DEFAULT_COMPANY_ADDRESS),
    resolveInvoiceSetting('invoice_gst_vat_number', 'INVOICE_TAX_ID'),
    resolveInvoiceSetting('invoice_footer_notes', 'INVOICE_DISCLAIMER', DEFAULT_RECEIPT_NOTES),
  ]);
  const { supportEmail, supportPhone } = await getSupportContact(db);
  const addressLines = asLines(addressRaw || DEFAULT_COMPANY_ADDRESS);
  const website = isPlaceholderValue(websiteRaw) ? '' : normalizeHttpUrl(websiteRaw);
  const taxId = isPlaceholderValue(taxIdRaw) ? '' : String(taxIdRaw || '').trim();
  const footerNotes = isPlaceholderValue(footerNotesRaw) ? DEFAULT_RECEIPT_NOTES : footerNotesRaw;
  return {
    name,
    website,
    supportEmail: invoiceEmail || supportEmail,
    supportPhone: invoicePhone || supportPhone,
    addressLines,
    taxId,
    footerNotes,
  };
}

// ─── Distance helpers ──────────────────────────────────────────────────────

/**
 * Haversine straight-line distance between two lat/lng points, in miles.
 */
function haversineMiles(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 3958.8; // Earth radius in miles
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const miles = R * c;
  return Number.isFinite(miles) && miles > 0 ? miles : null;
}

/**
 * Estimates round-trip travel distance (pickup ↔ service location) from booking
 * coordinates. Returns a formatted string like "12.4 miles" or null when coords
 * are unavailable.
 */
function estimateRoundTripMilesLabel(booking) {
  const pickupLat  = Number(booking?.latitude  || 0);
  const pickupLng  = Number(booking?.longitude || 0);
  // For combo bookings the service stop may be ev_charging location.
  const serviceLat = Number(
    booking?.service_latitude  || booking?.charging_latitude  || 0
  );
  const serviceLng = Number(
    booking?.service_longitude || booking?.charging_longitude || 0
  );

  if (!pickupLat || !pickupLng || !serviceLat || !serviceLng) return null;
  const oneway = haversineMiles(pickupLat, pickupLng, serviceLat, serviceLng);
  if (!oneway) return null;

  // Round-trip: pickup → service location → return to drop-off.
  const roundTrip = oneway * 2;
  const rounded   = Math.round(roundTrip * 10) / 10;
  return `${rounded} miles`;
}

function serviceTypeLabel(serviceType) {
  if (!serviceType) return 'Service';
  return String(serviceType)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Build a display name for a driver/provider user object.
 * Accepts Sequelize User plain objects with first_name/last_name or a name field.
 */
function resolveProviderDisplayName(driver) {
  if (!driver) return null;
  const full = [driver.first_name, driver.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  const name = String(driver.name || '').trim();
  return name || null;
}

/**
 * Build a single-line vehicle label from a Vehicle plain object.
 * Returns null when no usable fields are present.
 */
function resolveVehicleLabel(vehicle) {
  if (!vehicle) return null;
  const parts = [
    vehicle.year ? String(vehicle.year) : null,
    vehicle.make ? String(vehicle.make).trim() : null,
    vehicle.model ? String(vehicle.model).trim() : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

async function generateBookingInvoicePdf({
  booking,
  user,
  token,
  invoiceId,
  vehicle,
  driver,
  paymentStatus,        // e.g. 'Paid' — shown after Total
  beforePhotoCount = 0, // number of before-service photos
  afterPhotoCount  = 0, // number of after-service photos
}) {
  const invoiceNo = buildInvoiceNumber(booking);
  const bookingIdDisplay = booking?.booking_code ? `#${booking.booking_code}` : booking?.id ? `#${booking.id}` : '';
  const company = await getCompanyDetails();

  const baseUrl = resolveInvoicePublicBaseUrl();
  const invoiceUrl = token && baseUrl ? `${baseUrl}/invoices/${encodeURIComponent(String(token))}` : '';
  const [logoPng, qrPng] = await Promise.all([loadLogoPngBuffer(), generateQrPngBuffer(invoiceUrl)]);

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    compress: true,
    pdfVersion: '1.5'
  });

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const pageW = doc.page.width;
  const margin = doc.page.margins.left;
  const contentW = pageW - doc.page.margins.left - doc.page.margins.right;

  // Header with logo + company block
  doc.image(logoPng, margin, 38, { width: 140 });
  const headerRightX = margin + 160;
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#111827')
    .text(company.name, headerRightX, 40, { width: contentW - 160 });
  doc.font('Helvetica').fontSize(9).fillColor('#4B5563');
  const addr = company.addressLines.length ? company.addressLines.join('\n') : 'EV charging and car wash services';
  doc.text(addr, headerRightX, doc.y + 4, { width: contentW - 160 });
  const contactLines = [
    company.website ? company.website : null,
    company.supportEmail ? `Support: ${company.supportEmail}` : null,
    company.supportPhone ? `Phone: ${company.supportPhone}` : null,
    company.taxId ? `Tax ID: ${company.taxId}` : null
  ].filter(Boolean);
  if (contactLines.length) doc.text(contactLines.join('\n'), headerRightX, doc.y + 6, { width: contentW - 160 });
  doc.fillColor('#111827');

  // Title
  doc.moveDown(2.2);
  doc.font('Helvetica-Bold').fontSize(18).text('Invoice', margin, doc.y, { width: contentW });
  doc.moveDown(0.4);

  // Divider
  doc.moveTo(margin, doc.y).lineTo(margin + contentW, doc.y).strokeColor('#E5E7EB').stroke();
  doc.moveDown(0.8);

  // Invoice meta
  const metaLeftX = margin;
  const metaRightX = margin + Math.floor(contentW * 0.55);
  doc.font('Helvetica').fontSize(10).fillColor('#111827');
  const invoiceIdDisplay = invoiceId != null && String(invoiceId).trim() ? `#${String(invoiceId).trim()}` : '';
  const scheduleLabel =
    booking?.schedule_type === 'scheduled'
      ? formatDateTime(booking?.scheduled_at)
      : booking?.schedule_type === 'on_demand'
        ? 'On-demand service'
        : 'ASAP';
  doc.text(`Invoice Id : ${invoiceIdDisplay || invoiceNo}`, metaLeftX, doc.y, { width: contentW * 0.5 });
  doc.text(`Invoice date: ${formatDate(new Date())}`, metaRightX, doc.y - 12, { width: contentW * 0.45 });
  doc.text(`Booking Id : ${bookingIdDisplay || '—'}`, metaLeftX, doc.y, { width: contentW * 0.5 });
  doc.text(
    `Scheduled: ${scheduleLabel}`,
    metaRightX,
    doc.y - 12,
    { width: contentW * 0.45 }
  );
  doc.fillColor('#111827');
  doc.moveDown(0.6);

  // Two-column block: billed to + service
  const colGap = 24;
  const colW = (contentW - colGap) / 2;
  const yStart = doc.y;
  const customerName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.name || 'Customer';
  doc.font('Helvetica-Bold').fontSize(11).text('Billed to', metaLeftX, yStart, { width: colW });
  doc.font('Helvetica').fontSize(10);
  const billedLines = [customerName, user?.email || null, user?.phone ? String(user.phone) : null].filter(Boolean).join('\n');
  doc.text(billedLines, metaLeftX, doc.y + 4, { width: colW });

  doc.font('Helvetica-Bold').fontSize(11).text('Service', metaLeftX + colW + colGap, yStart, { width: colW });
  doc.font('Helvetica').fontSize(10);
  const serviceLines = [serviceTypeLabel(booking?.service_type), scheduleLabel].join('\n');
  doc.text(serviceLines, metaLeftX + colW + colGap, doc.y + 4, { width: colW });

  doc.y = Math.max(doc.y, yStart + 70);
  doc.moveDown(0.8);

  // ─── Supplementary details block ───────────────────────────────────────────
  // Resolve vehicle — prefer explicitly passed param, fall back to eager-loaded
  // association on the booking object (when fetched with `include`).
  const resolvedVehicle  = vehicle || booking?.vehicle || null;
  const resolvedDriver   = driver  || booking?.assigned_driver || null;
  const distanceLabel    = estimateRoundTripMilesLabel(booking);

  const vehicleLabel    = resolveVehicleLabel(resolvedVehicle);
  const vehicleColor    = resolvedVehicle?.color ? String(resolvedVehicle.color).trim() : null;
  const vehiclePlate    = resolvedVehicle?.license_plate ? String(resolvedVehicle.license_plate).trim() : null;
  const vehicleType     = resolvedVehicle?.vehicle_type ? String(resolvedVehicle.vehicle_type).trim() : null;
  const providerName    = resolveProviderDisplayName(resolvedDriver);

  // Pickup / service address
  const pickupAddress   = String(
    booking?.address || booking?.service_address || booking?.ev_charging_address || ''
  ).trim();

  const hasVehicle   = !!(vehicleLabel || vehicleColor || vehiclePlate || vehicleType);
  const hasLocation  = !!(pickupAddress || distanceLabel);
  const hasProvider  = !!providerName;

  if (hasVehicle || hasLocation || hasProvider) {
    // Light divider before details block
    doc.moveTo(margin, doc.y).lineTo(margin + contentW, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(0.7);

    const detailColW   = Math.floor(contentW / 3);
    const detailGap    = 16;
    const availableCols = [hasVehicle, hasLocation, hasProvider].filter(Boolean).length;
    const detailBlockW = availableCols === 1
      ? contentW
      : availableCols === 2
        ? Math.floor((contentW - detailGap) / 2)
        : Math.floor((contentW - detailGap * 2) / 3);

    const detailStartY = doc.y;
    let detailColX     = margin;

    if (hasVehicle) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827')
         .text('Vehicle', detailColX, detailStartY, { width: detailBlockW });
      doc.font('Helvetica').fontSize(9).fillColor('#4B5563');
      const vehicleLines = [
        vehicleLabel,
        vehicleType ? `Type: ${vehicleType}` : null,
        vehicleColor ? `Color: ${vehicleColor}` : null,
        vehiclePlate ? `Plate: ${vehiclePlate}` : null,
      ].filter(Boolean);
      doc.text(vehicleLines.join('\n'), detailColX, doc.y + 4, { width: detailBlockW });
      if (availableCols > 1) {
        detailColX += detailBlockW + detailGap;
        doc.y = detailStartY; // reset Y for next column
      }
    }

    if (hasLocation) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827')
         .text('Service location', detailColX, detailStartY, { width: detailBlockW });
      doc.font('Helvetica').fontSize(9).fillColor('#4B5563');
      const locationLines = [
        pickupAddress || null,
        distanceLabel ? `Est. round-trip: ${distanceLabel}` : null,
      ].filter(Boolean);
      doc.text(locationLines.join('\n') || '—', detailColX, doc.y + 4, { width: detailBlockW });
      if (hasProvider) {
        detailColX += detailBlockW + detailGap;
        doc.y = detailStartY;
      }
    }

    if (hasProvider) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827')
         .text('Service provider', detailColX, detailStartY, { width: detailBlockW });
      doc.font('Helvetica').fontSize(9).fillColor('#4B5563');
      doc.text(providerName, detailColX, doc.y + 4, { width: detailBlockW });
    }

    // Advance past whichever column is tallest
    doc.y = Math.max(doc.y, detailStartY + 70);
    doc.fillColor('#111827');
    doc.moveDown(0.7);
  }

  // ─── Pricing (simple, lightweight table) ───────────────────────────────────
  const base = booking?.base_price ?? booking?.custom_price ?? 0;
  const baseBeforeDiscount = booking?.base_price_before_discount;
  const referralDiscount = Number(booking?.referral_discount_amount || 0);
  const fee = booking?.service_fee ?? 0;
  const platformFee = booking?.platform_fee ?? 0;
  const convenienceFee = Number(booking?.convenience_fee || 0);
  const onDemandFee = Number(booking?.on_demand_fee || 0);
  const towingFee = Number(booking?.towing_fee || 0);
  const tax = booking?.tax ?? 0;
  const total =
    booking?.total_price != null
      ? Number(booking.total_price)
      : Number(base) +
        Number(fee) +
        Number(platformFee) +
        convenienceFee +
        onDemandFee +
        towingFee +
        Number(tax) -
        referralDiscount;

  const tableX = margin;
  const tableW = contentW;
  const labelW = Math.floor(tableW * 0.7);
  const valueW = tableW - labelW;

  function row(label, value, { bold = false } = {}) {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#111827');
    const y = doc.y;
    doc.text(label, tableX, y, { width: labelW });
    doc.text(value, tableX + labelW, y, { width: valueW, align: 'right' });
    doc.moveDown(0.5);
  }

  doc.font('Helvetica-Bold').fontSize(11).text('Summary', tableX, doc.y, { width: tableW });
  doc.moveDown(0.5);
  if (referralDiscount > 0 && baseBeforeDiscount != null) {
    row('Base price', formatUsd(baseBeforeDiscount));
    row('Base price (after referral)', formatUsd(base));
  } else {
    row('Base price', formatUsd(base));
  }
  row('Service fee', formatUsd(fee));
  row('Platform fee', formatUsd(platformFee));
  if (convenienceFee > 0) row('Convenience fee', formatUsd(convenienceFee));
  if (onDemandFee > 0) row('On-demand service fee', formatUsd(onDemandFee));
  if (towingFee > 0) row('Towing fee', formatUsd(towingFee));
  if (Number(tax) > 0) row('Tax', formatUsd(tax));
  if (referralDiscount > 0) {
    const subtotal =
      Number(baseBeforeDiscount ?? base) +
      Number(fee) +
      Number(platformFee) +
      convenienceFee +
      onDemandFee +
      towingFee +
      Number(tax);
    row('Subtotal', formatUsd(subtotal));
    row('Referral discount', `-${formatUsd(referralDiscount)}`);
  }
  doc.moveDown(0.1);
  doc.moveTo(tableX, doc.y).lineTo(tableX + tableW, doc.y).strokeColor('#E5E7EB').stroke();
  doc.moveDown(0.4);
  row('Total', formatUsd(total), { bold: true });

  // Payment status
  const resolvedPaymentStatus = String(paymentStatus || '').trim();
  if (resolvedPaymentStatus) {
    doc.moveDown(0.3);
    doc.moveTo(tableX, doc.y).lineTo(tableX + tableW, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10).fillColor('#111827');
    const psY = doc.y;
    doc.text('Payment status', tableX, psY, { width: labelW });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1B5E20');
    doc.text(resolvedPaymentStatus, tableX + labelW, psY, { width: valueW, align: 'right' });
    doc.fillColor('#111827');
    doc.moveDown(0.5);
  }

  // Before / after service photos note
  const hasBeforePhotos = Number(beforePhotoCount) > 0;
  const hasAfterPhotos  = Number(afterPhotoCount)  > 0;
  if (hasBeforePhotos || hasAfterPhotos) {
    doc.moveDown(0.6);
    doc.moveTo(tableX, doc.y).lineTo(tableX + tableW, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(0.7);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Service photos', tableX, doc.y, { width: tableW });
    doc.moveDown(0.4);
    const photoLines = [];
    if (hasBeforePhotos) {
      const n = Number(beforePhotoCount);
      photoLines.push(`${n} before-service photo${n === 1 ? '' : 's'}`);
    }
    if (hasAfterPhotos) {
      const n = Number(afterPhotoCount);
      photoLines.push(`${n} after-service photo${n === 1 ? '' : 's'}`);
    }
    const photoNote = photoLines.join(' \u00b7 ') + ' \u2014 view in the Car Comfort app';
    doc.font('Helvetica').fontSize(9).fillColor('#4B5563').text(photoNote, tableX, doc.y, { width: tableW });
    doc.fillColor('#111827');
    doc.moveDown(0.8);
  } else {
    doc.moveDown(0.8);
  }

  // Footer: disclaimer + QR
  doc.moveDown(0.8);
  const disclaimer = company.footerNotes || DEFAULT_RECEIPT_NOTES;

  const footerY = doc.y;
  const footerBoxH = 120;
  doc.roundedRect(margin, footerY, contentW, footerBoxH, 10).strokeColor('#E5E7EB').stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Notes', margin + 14, footerY + 12, {
    width: contentW - 28
  });
  doc.font('Helvetica').fontSize(9).fillColor('#4B5563').text(disclaimer, margin + 14, footerY + 30, {
    width: qrPng ? contentW - 28 - 120 : contentW - 28
  });

  if (qrPng) {
    const qrSize = 92;
    const qrX = margin + contentW - 14 - qrSize;
    const qrY = footerY + 18;
    doc.image(qrPng, qrX, qrY, { width: qrSize, height: qrSize });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#6B7280')
      .text('View invoice', qrX, qrY + qrSize + 6, { width: qrSize, align: 'center' });
  }

  doc.fillColor('#111827');

  doc.end();
  return await done;
}

function formatTimelineEventLabel(eventType) {
  return String(eventType || 'event')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ensurePdfSpace(doc, needed = 48) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

function resolveScheduleLabel(booking) {
  const serviceWhen = booking?.service_datetime || booking?.scheduled_at;
  if (booking?.schedule_type === 'scheduled' && serviceWhen) {
    return formatDateTime(serviceWhen);
  }
  if (booking?.schedule_type === 'on_demand') return 'On-demand service';
  if (booking?.schedule_type === 'asap') return 'ASAP';
  return serviceWhen ? formatDateTime(serviceWhen) : '—';
}

/**
 * Admin export: invoice-style header + booking details + full lifecycle timeline.
 */
async function generateBookingRecordPdf({
  booking,
  user,
  vehicle,
  driver,
  timeline = [],
  paymentStatus = null,
  latestTransaction = null,
}) {
  const bookingIdDisplay = booking?.booking_code ? `#${booking.booking_code}` : booking?.id ? `#${booking.id}` : '—';
  const company = await getCompanyDetails();
  const logoPng = await loadLogoPngBuffer();

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

  const pageW = doc.page.width;
  const margin = doc.page.margins.left;
  const contentW = pageW - doc.page.margins.left - doc.page.margins.right;

  // ─── Header (matches invoice branding) ─────────────────────────────────────
  doc.image(logoPng, margin, 38, { width: 140 });
  const headerRightX = margin + 160;
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#111827')
    .text(company.name, headerRightX, 40, { width: contentW - 160 });
  doc.font('Helvetica').fontSize(9).fillColor('#4B5563');
  const addr = company.addressLines.length ? company.addressLines.join('\n') : 'EV charging and car wash services';
  doc.text(addr, headerRightX, doc.y + 4, { width: contentW - 160 });
  const contactLines = [
    company.website ? company.website : null,
    company.supportEmail ? `Support: ${company.supportEmail}` : null,
    company.supportPhone ? `Phone: ${company.supportPhone}` : null,
  ].filter(Boolean);
  if (contactLines.length) doc.text(contactLines.join('\n'), headerRightX, doc.y + 6, { width: contentW - 160 });
  doc.fillColor('#111827');

  doc.moveDown(2.2);
  doc.font('Helvetica-Bold').fontSize(18).text('Booking Service Record', margin, doc.y, { width: contentW });
  doc.moveDown(0.4);
  doc.moveTo(margin, doc.y).lineTo(margin + contentW, doc.y).strokeColor('#E5E7EB').stroke();
  doc.moveDown(0.8);

  const metaRightX = margin + Math.floor(contentW * 0.55);
  doc.font('Helvetica').fontSize(10);
  doc.text(`Booking ID: ${bookingIdDisplay}`, margin, doc.y, { width: contentW * 0.5 });
  doc.text(`Generated: ${formatDateTime(new Date())}`, metaRightX, doc.y - 12, { width: contentW * 0.45 });
  doc.text(`Status: ${String(booking?.status || '—').replace(/_/g, ' ')}`, margin, doc.y, { width: contentW * 0.5 });
  doc.text(
    `Tracking: ${booking?.tracking_status ? String(booking.tracking_status).replace(/_/g, ' ') : '—'}`,
    metaRightX,
    doc.y - 12,
    { width: contentW * 0.45 }
  );
  doc.text(`Service type: ${serviceTypeLabel(booking?.service_type)}`, margin, doc.y, { width: contentW * 0.5 });
  doc.text(`Scheduled: ${resolveScheduleLabel(booking)}`, metaRightX, doc.y - 12, { width: contentW * 0.45 });
  doc.moveDown(0.8);

  const colGap = 24;
  const colW = (contentW - colGap) / 2;
  const yStart = doc.y;
  const customerName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.name || 'Customer';
  doc.font('Helvetica-Bold').fontSize(11).text('Customer', margin, yStart, { width: colW });
  doc.font('Helvetica').fontSize(10);
  doc.text(
    [customerName, user?.email || null, user?.phone ? String(user.phone) : null].filter(Boolean).join('\n'),
    margin,
    doc.y + 4,
    { width: colW }
  );

  const resolvedDriver = driver || booking?.assigned_driver || null;
  const providerName = resolveProviderDisplayName(resolvedDriver) || '—';
  doc.font('Helvetica-Bold').fontSize(11).text('Service provider', margin + colW + colGap, yStart, { width: colW });
  doc.font('Helvetica').fontSize(10);
  doc.text(
    [providerName, resolvedDriver?.email || null, resolvedDriver?.phone ? String(resolvedDriver.phone) : null]
      .filter(Boolean)
      .join('\n'),
    margin + colW + colGap,
    doc.y + 4,
    { width: colW }
  );
  doc.y = Math.max(doc.y, yStart + 70);
  doc.moveDown(0.6);

  const resolvedVehicle = vehicle || booking?.vehicle || null;
  const vehicleLabel = resolveVehicleLabel(resolvedVehicle);
  const pickupAddress = String(
    booking?.address || booking?.service_address || booking?.ev_charging_address || ''
  ).trim();
  const serviceAddress = String(
    booking?.service_address || booking?.ev_charging_address || booking?.service_location_name || ''
  ).trim();

  doc.moveTo(margin, doc.y).lineTo(margin + contentW, doc.y).strokeColor('#E5E7EB').stroke();
  doc.moveDown(0.7);
  const detailColW = Math.floor(contentW / 3);
  const detailGap = 16;
  const detailStartY = doc.y;

  doc.font('Helvetica-Bold').fontSize(10).text('Vehicle', margin, detailStartY, { width: detailColW });
  doc.font('Helvetica').fontSize(9).fillColor('#4B5563');
  const vehicleLines = [
    vehicleLabel,
    resolvedVehicle?.color ? `Color: ${resolvedVehicle.color}` : null,
    resolvedVehicle?.license_plate ? `Plate: ${resolvedVehicle.license_plate}` : null,
  ].filter(Boolean);
  doc.text(vehicleLines.length ? vehicleLines.join('\n') : '—', margin, doc.y + 4, { width: detailColW });

  doc.y = detailStartY;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Pick-up / drop-off', margin + detailColW + detailGap, detailStartY, {
    width: detailColW,
  });
  doc.font('Helvetica').fontSize(9).fillColor('#4B5563').text(pickupAddress || '—', margin + detailColW + detailGap, doc.y + 4, {
    width: detailColW,
  });

  doc.y = detailStartY;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Service location', margin + (detailColW + detailGap) * 2, detailStartY, {
    width: detailColW,
  });
  doc.font('Helvetica').fontSize(9).fillColor('#4B5563').text(serviceAddress || '—', margin + (detailColW + detailGap) * 2, doc.y + 4, {
    width: detailColW,
  });

  doc.y = Math.max(doc.y, detailStartY + 58);
  doc.fillColor('#111827');
  doc.moveDown(0.8);

  // Service timing
  doc.font('Helvetica-Bold').fontSize(11).text('Service timing', margin, doc.y, { width: contentW });
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(10);
  const timingLines = [
    `Created: ${formatDateTime(booking?.created_at)}`,
    `Service started: ${booking?.service_started_at ? formatDateTime(booking.service_started_at) : '—'}`,
    `Service completed: ${booking?.service_completed_at ? formatDateTime(booking.service_completed_at) : '—'}`,
    booking?.actual_service_duration_minutes != null
      ? `Actual duration: ${booking.actual_service_duration_minutes} min`
      : booking?.service_duration_minutes != null
        ? `Est. duration: ${booking.service_duration_minutes} min`
        : null,
  ].filter(Boolean);
  doc.text(timingLines.join('\n'), margin, doc.y, { width: contentW });
  doc.moveDown(0.8);

  // Pricing summary
  const base = booking?.base_price ?? booking?.custom_price ?? 0;
  const fee = booking?.service_fee ?? 0;
  const platformFee = booking?.platform_fee ?? 0;
  const tax = booking?.tax ?? 0;
  const total =
    booking?.total_price != null
      ? Number(booking.total_price)
      : Number(base) + Number(fee) + Number(platformFee) + Number(tax);

  const tableX = margin;
  const tableW = contentW;
  const labelW = Math.floor(tableW * 0.7);
  const valueW = tableW - labelW;

  function row(label, value, { bold = false } = {}) {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#111827');
    const y = doc.y;
    doc.text(label, tableX, y, { width: labelW });
    doc.text(value, tableX + labelW, y, { width: valueW, align: 'right' });
    doc.moveDown(0.45);
  }

  doc.font('Helvetica-Bold').fontSize(11).text('Payment summary', tableX, doc.y, { width: tableW });
  doc.moveDown(0.45);
  row('Base price', formatUsd(base));
  row('Service fee', formatUsd(fee));
  row('Platform fee', formatUsd(platformFee));
  if (Number(tax) > 0) row('Tax', formatUsd(tax));
  doc.moveTo(tableX, doc.y).lineTo(tableX + tableW, doc.y).strokeColor('#E5E7EB').stroke();
  doc.moveDown(0.35);
  row('Total', formatUsd(total), { bold: true });
  if (paymentStatus) row('Payment status', String(paymentStatus));
  if (latestTransaction?.transaction_code) {
    row('Transaction', String(latestTransaction.transaction_code));
  }
  doc.moveDown(0.8);

  // ─── Timeline ──────────────────────────────────────────────────────────────
  doc.moveTo(margin, doc.y).lineTo(margin + contentW, doc.y).strokeColor('#E5E7EB').stroke();
  doc.moveDown(0.7);
  doc.font('Helvetica-Bold').fontSize(12).text('Booking timeline', margin, doc.y, { width: contentW });
  doc.moveDown(0.5);

  const events = Array.isArray(timeline) ? [...timeline] : [];
  events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (!events.length) {
    doc.font('Helvetica').fontSize(10).fillColor('#6B7280').text('No timeline events recorded.', margin, doc.y, {
      width: contentW,
    });
  } else {
    const timeW = 118;
    const actorW = 62;
    const eventW = contentW - timeW - actorW - 12;

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151');
    const headerY = doc.y;
    doc.text('Date & time', margin, headerY, { width: timeW });
    doc.text('Event', margin + timeW + 6, headerY, { width: eventW });
    doc.text('Actor', margin + timeW + eventW + 12, headerY, { width: actorW });
    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(margin + contentW, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(0.35);

    for (const event of events) {
      ensurePdfSpace(doc, 52);
      const rowY = doc.y;
      const label = formatTimelineEventLabel(event.event_type);
      const actor = [event.actor_type, event.source === 'tracking' ? 'lifecycle' : null]
        .filter(Boolean)
        .join(' / ');
      const message = String(event.message || '').trim();
      const timeText = formatDateTime(event.created_at);

      doc.font('Helvetica').fontSize(8.5).fillColor('#4B5563').text(timeText, margin, rowY, { width: timeW });
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(label, margin + timeW + 6, rowY, { width: eventW });
      let messageY = doc.y;
      if (message) {
        doc.font('Helvetica').fontSize(8.5).fillColor('#6B7280').text(message, margin + timeW + 6, messageY + 1, {
          width: eventW,
        });
        messageY = doc.y;
      }
      doc.font('Helvetica').fontSize(8.5).fillColor('#4B5563').text(actor || '—', margin + timeW + eventW + 12, rowY, {
        width: actorW,
      });
      doc.y = Math.max(messageY, rowY + 14);
      doc.moveDown(0.35);
      doc.moveTo(margin, doc.y).lineTo(margin + contentW, doc.y).strokeColor('#F3F4F6').stroke();
      doc.moveDown(0.25);
    }
  }

  doc.fillColor('#111827');
  doc.moveDown(0.8);
  ensurePdfSpace(doc, 90);
  const footerY = doc.y;
  doc.roundedRect(margin, footerY, contentW, 78, 8).strokeColor('#E5E7EB').stroke();
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor('#6B7280')
    .text(
      'This booking service record was generated from Car Comfort admin. It includes booking details and the full ' +
        'service lifecycle timeline for insurance, claims, and support purposes. Timestamps reflect the application timezone.',
      margin + 12,
      footerY + 12,
      { width: contentW - 24, lineGap: 2 }
    );

  doc.end();
  return await done;
}

module.exports = { generateBookingInvoicePdf, generateBookingRecordPdf };
