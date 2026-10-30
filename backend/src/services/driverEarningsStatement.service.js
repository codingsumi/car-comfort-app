'use strict';

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const db = require('../models');
const { HttpError } = require('../utils/httpError');

const INVOICE_COLORS = {
  text: '#111827',
  muted: '#4B5563',
  lightMuted: '#6B7280',
  border: '#E5E7EB',
};

const FOOTER_HEIGHT = 52;
const TABLE_ROW_HEIGHT = 20;
const TABLE_HEADER_HEIGHT = 24;

function formatUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function roundTwo(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function safeDate(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDate(value) {
  const d = safeDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(d);
}

function formatDateTime(value) {
  const d = safeDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function asLines(value) {
  if (!value) return [];
  return String(value)
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function normalizeHttpUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/\/$/, '')}`;
}

function getCompanyDetails() {
  const name = String(process.env.INVOICE_COMPANY_NAME || 'Car Comfort');
  const website =
    normalizeHttpUrl(process.env.PUBLIC_BASE_URL) ||
    normalizeHttpUrl(process.env.INVOICE_WEBSITE) ||
    'https://carcomfort.com';
  const supportEmail =
    String(process.env.SUPPORT_EMAIL || '').trim() ||
    String(process.env.MAIL_FROM_ADDRESS || '').trim() ||
    'support@carcomfort.com';
  const supportPhone = String(process.env.SUPPORT_PHONE || '').trim() || '';
  const addressFromEnv = asLines(process.env.INVOICE_COMPANY_ADDRESS || '');
  const addressLines = addressFromEnv.length
    ? addressFromEnv
    : ['Car Comfort, Inc.', 'United States'];
  const taxId = String(process.env.INVOICE_TAX_ID || '').trim();
  return { name, website, supportEmail, supportPhone, addressLines, taxId };
}

async function loadLogoPngBuffer() {
  const svgPath = path.join(__dirname, '..', '..', 'assets', 'images', 'logo.svg');
  const svg = fs.readFileSync(svgPath);
  return sharp(svg).resize({ width: 240 }).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

async function assertDriverAuth(auth) {
  const userId = auth?.userId ? Number(auth.userId) : null;
  const role = String(auth?.role || '').trim();
  if (!userId) throw new HttpError(401, 'Unauthorized');
  if (role !== 'driver') throw new HttpError(403, 'Forbidden');

  const driverProfile = await db.DriverProfile.findOne({ where: { user_id: userId } });
  if (!driverProfile) throw new HttpError(403, 'Service provider profile required');

  return userId;
}

function parseYear(raw) {
  const y = Number.parseInt(String(raw || ''), 10);
  const current = new Date().getFullYear();
  if (!Number.isFinite(y) || y < 2020 || y > current + 1) return current;
  return y;
}

function formatYmdUtc(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function parseIsoDateOnly(raw) {
  const s = String(raw || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!match) return null;
  const d = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfUtcDay(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endExclusiveAfterUtcDay(date) {
  const start = startOfUtcDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function formatStatementPeriodLabel(fromInclusive, toInclusive) {
  return `${formatDate(fromInclusive)} – ${formatDate(toInclusive)}`;
}

function formatCompactPeriod(fromInclusive, toInclusive) {
  const f = startOfUtcDay(fromInclusive);
  const t = startOfUtcDay(toInclusive);
  if (f.getUTCFullYear() === t.getUTCFullYear() && f.getUTCMonth() === t.getUTCMonth()) {
    const month = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(f);
    return `${month} ${f.getUTCDate()}-${t.getUTCDate()} ${f.getUTCFullYear()}`;
  }
  return formatStatementPeriodLabel(f, t);
}

function buildStatementTitle(fromInclusive, toInclusive) {
  const f = startOfUtcDay(fromInclusive);
  const t = startOfUtcDay(toInclusive);
  const lastDayOfMonth = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  const isFullCalendarMonth =
    f.getUTCDate() === 1 &&
    t.getUTCDate() === lastDayOfMonth &&
    f.getUTCFullYear() === t.getUTCFullYear() &&
    f.getUTCMonth() === t.getUTCMonth();

  if (isFullCalendarMonth) {
    return `${formatMonthLabel(f.getUTCFullYear(), f.getUTCMonth())} Statement`;
  }

  const isFullCalendarYear =
    f.getUTCMonth() === 0 &&
    f.getUTCDate() === 1 &&
    t.getUTCMonth() === 11 &&
    t.getUTCDate() === 31 &&
    f.getUTCFullYear() === t.getUTCFullYear();
  if (isFullCalendarYear) {
    return `${f.getUTCFullYear()} Statement`;
  }

  return 'Earnings Statement';
}

function buildStatementSubtitle(fromInclusive, toInclusive, statementId) {
  const periodStr = formatCompactPeriod(fromInclusive, toInclusive);
  const shortId = String(statementId || '')
    .replace(/^CC-ES-/i, '')
    .slice(-8)
    .toUpperCase();
  return shortId ? `${periodStr} • Statement #${shortId}` : periodStr;
}

function resolveStatementRange(query = {}) {
  const period = String(query.period || '').trim().toLowerCase();
  const fromRaw = query.from;
  const toRaw = query.to;

  if ((fromRaw && !toRaw) || (!fromRaw && toRaw)) {
    throw new HttpError(400, 'from and to must be provided together');
  }

  if (fromRaw && toRaw) {
    const from = parseIsoDateOnly(fromRaw);
    const toInclusive = parseIsoDateOnly(toRaw);
    if (!from || !toInclusive) {
      throw new HttpError(400, 'from and to must be valid dates (YYYY-MM-DD)');
    }
    if (toInclusive < from) {
      throw new HttpError(400, 'to must be on or after from');
    }
    const to = endExclusiveAfterUtcDay(toInclusive);
    const maxSpanMs = 366 * 5 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxSpanMs) {
      throw new HttpError(400, 'Statement period cannot exceed five years');
    }
    return {
      from,
      to,
      toInclusive,
      statementPeriod: formatStatementPeriodLabel(from, toInclusive),
      statementTitle: buildStatementTitle(from, toInclusive),
      fileKey: `${formatYmdUtc(from)}-${formatYmdUtc(toInclusive)}`,
      idKey: `${formatYmdUtc(from)}-${formatYmdUtc(toInclusive)}`,
    };
  }

  if (period === 'week' || period === 'month' || period === 'year') {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const to = endExclusiveAfterUtcDay(new Date());
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const toInclusive = new Date(to.getTime() - 1);
    return {
      from,
      to,
      toInclusive,
      statementPeriod: formatStatementPeriodLabel(from, toInclusive),
      statementTitle: buildStatementTitle(from, toInclusive),
      fileKey: `last-${period}`,
      idKey: `last-${period}-${formatYmdUtc(toInclusive)}`,
    };
  }

  const year = parseYear(query.year);
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const toInclusive = new Date(to.getTime() - 1);
  return {
    from,
    to,
    toInclusive,
    statementPeriod: `January 1 – December 31, ${year}`,
    statementTitle: `${year} Statement`,
    fileKey: String(year),
    idKey: String(year),
  };
}

function buildStatementId(providerId, idKey) {
  return `CC-ES-${idKey}-${String(providerId).padStart(6, '0')}`;
}

function payoutEffectiveDate(payout) {
  return safeDate(payout.processed_at) || safeDate(payout.created_at) || safeDate(payout.updated_at);
}

function payoutGrossAmount(payout) {
  const gross = roundTwo(payout.gross_amount);
  if (gross > 0) return gross;
  return roundTwo(payout.net_amount);
}

function startOfWeekMondayUtc(date) {
  const d = startOfUtcDay(date);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  return new Date(d.getTime() - diff * 24 * 60 * 60 * 1000);
}

function endOfWeekSundayUtc(weekStart) {
  return new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
}

function formatMonthLabel(year, monthIndex) {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

function buildPayoutSummaries(payouts) {
  const weeklyMap = new Map();
  const monthlyMap = new Map();
  let totalGross = 0;

  for (const payout of payouts) {
    const amount = payoutGrossAmount(payout);
    totalGross += amount;
    const paidAt = payoutEffectiveDate(payout);
    if (!paidAt) continue;

    const weekStart = startOfWeekMondayUtc(paidAt);
    const weekEnd = endOfWeekSundayUtc(weekStart);
    const weekKey = formatYmdUtc(weekStart);
    const weekLabel = `${formatDate(weekStart)} – ${formatDate(weekEnd)}`;

    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, { label: weekLabel, start: weekStart, count: 0, gross: 0 });
    }
    const weekRow = weeklyMap.get(weekKey);
    weekRow.count += 1;
    weekRow.gross = roundTwo(weekRow.gross + amount);

    const monthKey = `${paidAt.getUTCFullYear()}-${String(paidAt.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, {
        label: formatMonthLabel(paidAt.getUTCFullYear(), paidAt.getUTCMonth()),
        year: paidAt.getUTCFullYear(),
        month: paidAt.getUTCMonth(),
        count: 0,
        gross: 0,
      });
    }
    const monthRow = monthlyMap.get(monthKey);
    monthRow.count += 1;
    monthRow.gross = roundTwo(monthRow.gross + amount);
  }

  const weekly = [...weeklyMap.values()].sort((a, b) => a.start - b.start);
  const monthly = [...monthlyMap.values()].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  return { weekly, monthly, totalGross: roundTwo(totalGross) };
}

function mapPayoutRows(payouts) {
  return payouts.map((payout) => {
    const paidAt = payoutEffectiveDate(payout);
    return {
      id: payout.id,
      paidAt,
      paidAtLabel: formatDate(paidAt),
      gross: payoutGrossAmount(payout),
      transferId: payout.stripe_transfer_id ? String(payout.stripe_transfer_id) : '—',
      status: 'Paid',
    };
  });
}

function truncateText(doc, text, maxWidth) {
  const value = String(text || '—');
  if (doc.widthOfString(value) <= maxWidth) return value;
  let truncated = value;
  while (truncated.length > 1 && doc.widthOfString(`${truncated}…`) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

function drawInvoiceDivider(doc, margin, contentW, y) {
  doc.moveTo(margin, y).lineTo(margin + contentW, y).strokeColor(INVOICE_COLORS.border).stroke();
}

function drawSectionHeading(doc, margin, contentW, title) {
  doc.font('Helvetica-Bold').fontSize(11).fillColor(INVOICE_COLORS.text).text(title, margin, doc.y, {
    width: contentW,
  });
  doc.moveDown(0.35);
}

function drawSimpleTableHeader(doc, margin, y, contentW, columns) {
  doc.save();
  doc.fillColor('#F3F4F6').rect(margin, y, contentW, TABLE_HEADER_HEIGHT).fill();
  doc.restore();
  doc.font('Helvetica-Bold').fontSize(9).fillColor(INVOICE_COLORS.text);
  let x = margin + 8;
  const textY = y + 7;
  for (const col of columns) {
    doc.text(col.label, x, textY, { width: col.width - 8, align: col.align || 'left' });
    x += col.width;
  }
  return y + TABLE_HEADER_HEIGHT;
}

function drawSimpleTableRow(doc, margin, y, contentW, columns, values, rowIndex) {
  if (rowIndex % 2 === 1) {
    doc.save();
    doc.fillColor('#FAFAFA').rect(margin, y, contentW, TABLE_ROW_HEIGHT).fill();
    doc.restore();
  }
  doc.font('Helvetica').fontSize(9).fillColor(INVOICE_COLORS.text);
  let x = margin + 8;
  const textY = y + 6;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const value = values[i] ?? '—';
    doc.text(String(value), x, textY, { width: col.width - 8, align: col.align || 'left' });
    x += col.width;
  }
  return y + TABLE_ROW_HEIGHT;
}

function drawPageChrome(doc, company, generatedAt, pageIndex, totalPages) {
  const margin = doc.page.margins.left;
  const pageW = doc.page.width;
  const contentW = pageW - margin * 2;
  const footerY = doc.page.height - doc.page.margins.bottom - FOOTER_HEIGHT + 6;

  doc.font('Helvetica').fontSize(8).fillColor(INVOICE_COLORS.lightMuted);
  const pageLabel = totalPages > 1 ? `Page ${pageIndex} of ${totalPages}` : 'Page 1';
  doc.text(pageLabel, margin + contentW * 0.65, margin - 8, { width: contentW * 0.35, align: 'right' });

  drawInvoiceDivider(doc, margin, contentW, footerY - 8);
  doc.text(`${company.name} · ${company.supportEmail}`, margin, footerY, { width: contentW * 0.65 });
  doc.text(`Generated ${generatedAt}`, margin + contentW * 0.65, footerY, {
    width: contentW * 0.35,
    align: 'right',
  });
}

function drawPageFooters(doc, company, generatedAt) {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawPageChrome(doc, company, generatedAt, i - range.start + 1, totalPages);
  }
}

function drawPayoutSummaryPanel(doc, x, y, width, payoutCount, totalGross) {
  const panelH = 148;
  drawInvoiceDivider(doc, x, width, y);
  let rowY = y + 14;

  doc.font('Helvetica-Bold').fontSize(11).fillColor(INVOICE_COLORS.text);
  doc.text(`Payouts (${payoutCount})`, x, rowY, { width });
  rowY += 22;

  const labelW = Math.floor(width * 0.62);
  const valueW = width - labelW;
  const drawRow = (label, value, { bold = false, size = 10 } = {}) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(INVOICE_COLORS.text);
    doc.text(label, x, rowY, { width: labelW });
    doc.text(value, x + labelW, rowY, { width: valueW, align: 'right' });
    rowY += bold ? 22 : 18;
  };

  drawRow('Payout subtotal', formatUsd(totalGross));
  drawRow('Fees', formatUsd(0));
  drawRow('Total payouts', formatUsd(totalGross));
  drawInvoiceDivider(doc, x, width, rowY + 2);
  rowY += 14;
  drawRow('Net total', formatUsd(totalGross), { bold: true, size: 12 });

  return y + panelH;
}

async function renderEarningsStatementPdf({
  user,
  providerId,
  statementTitle,
  statementSubtitle,
  payouts,
  payoutRows,
  weekly,
  monthly,
  totalGross,
}) {
  const company = getCompanyDetails();
  const logoPng = await loadLogoPngBuffer();
  const generatedAt = formatDateTime(new Date());

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    compress: true,
    pdfVersion: '1.5',
    bufferPages: true,
  });

  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const margin = doc.page.margins.left;
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const contentW = pageW - margin * 2;
  const contentBottom = pageH - doc.page.margins.bottom - FOOTER_HEIGHT;

  const ensureSpace = (neededHeight) => {
    if (doc.y + neededHeight <= contentBottom) return;
    doc.addPage();
    doc.y = margin + 12;
  };

  // Header — Car Comfort invoice branding
  doc.image(logoPng, margin, 38, { width: 140 });
  const headerRightX = margin + 160;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(INVOICE_COLORS.text).text(company.name, headerRightX, 40, {
    width: contentW - 160,
  });
  doc.font('Helvetica').fontSize(9).fillColor(INVOICE_COLORS.muted);
  doc.text(company.addressLines.join('\n'), headerRightX, doc.y + 4, { width: contentW - 160 });
  const contactLines = [
    company.website || null,
    company.supportEmail ? `Support: ${company.supportEmail}` : null,
    company.supportPhone ? `Phone: ${company.supportPhone}` : null,
  ].filter(Boolean);
  if (contactLines.length) {
    doc.text(contactLines.join('\n'), headerRightX, doc.y + 6, { width: contentW - 160 });
  }

  doc.moveDown(2.2);
  doc.font('Helvetica-Bold').fontSize(20).fillColor(INVOICE_COLORS.text).text(statementTitle, margin, doc.y, {
    width: contentW,
  });
  doc.moveDown(0.25);
  doc.font('Helvetica').fontSize(10).fillColor(INVOICE_COLORS.muted).text(statementSubtitle, margin, doc.y, {
    width: contentW,
  });
  doc.moveDown(1.1);

  const colGap = 28;
  const leftColW = Math.floor(contentW * 0.46);
  const rightColX = margin + leftColW + colGap;
  const rightColW = contentW - leftColW - colGap;
  const blockTop = doc.y;

  const providerName = String(user.name || '—').trim();
  doc.font('Helvetica-Bold').fontSize(11).fillColor(INVOICE_COLORS.text).text(
    'Independent service provider name',
    margin,
    blockTop,
    { width: leftColW },
  );
  doc.font('Helvetica').fontSize(10).fillColor(INVOICE_COLORS.text);
  doc.text(providerName, margin, doc.y + 6, { width: leftColW });
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(11).text('Provider ID', margin, doc.y, { width: leftColW });
  doc.font('Helvetica').fontSize(10).text(String(providerId), margin, doc.y + 6, { width: leftColW });

  drawPayoutSummaryPanel(doc, rightColX, blockTop, rightColW, payouts.length, totalGross);
  doc.y = Math.max(doc.y, blockTop + 158);
  doc.moveDown(0.6);

  const periodCols = [
    { label: 'Period', width: Math.floor(contentW * 0.52) },
    { label: 'Payouts', width: Math.floor(contentW * 0.16), align: 'right' },
    {
      label: 'Gross earnings',
      width: contentW - Math.floor(contentW * 0.52) - Math.floor(contentW * 0.16),
      align: 'right',
    },
  ];

  if (weekly.length > 0) {
    ensureSpace(TABLE_HEADER_HEIGHT + TABLE_ROW_HEIGHT * 2 + 40);
    drawSectionHeading(doc, margin, contentW, 'Weekly gross earnings');
    let tableY = drawSimpleTableHeader(doc, margin, doc.y, contentW, periodCols);
    weekly.forEach((row, index) => {
      if (tableY + TABLE_ROW_HEIGHT > contentBottom) {
        doc.addPage();
        doc.y = margin + 12;
        tableY = doc.y;
        tableY = drawSimpleTableHeader(doc, margin, tableY, contentW, periodCols);
      }
      tableY = drawSimpleTableRow(
        doc,
        margin,
        tableY,
        contentW,
        periodCols,
        [row.label, String(row.count), formatUsd(row.gross)],
        index,
      );
    });
    doc.y = tableY + 10;
  }

  if (monthly.length > 0) {
    ensureSpace(TABLE_HEADER_HEIGHT + TABLE_ROW_HEIGHT * 2 + 40);
    drawSectionHeading(doc, margin, contentW, 'Monthly gross earnings');
    let tableY = drawSimpleTableHeader(doc, margin, doc.y, contentW, periodCols);
    monthly.forEach((row, index) => {
      if (tableY + TABLE_ROW_HEIGHT > contentBottom) {
        doc.addPage();
        doc.y = margin + 12;
        tableY = doc.y;
        tableY = drawSimpleTableHeader(doc, margin, tableY, contentW, periodCols);
      }
      tableY = drawSimpleTableRow(
        doc,
        margin,
        tableY,
        contentW,
        periodCols,
        [row.label, String(row.count), formatUsd(row.gross)],
        index,
      );
    });
    doc.y = tableY + 10;
  }

  ensureSpace(TABLE_HEADER_HEIGHT + TABLE_ROW_HEIGHT + 40);
  drawSectionHeading(doc, margin, contentW, 'Successful payouts');
  const payoutCols = [
    { label: 'Payout date', width: Math.floor(contentW * 0.22) },
    { label: 'Payout ID', width: Math.floor(contentW * 0.14) },
    { label: 'Transfer reference', width: Math.floor(contentW * 0.34) },
    { label: 'Status', width: Math.floor(contentW * 0.12) },
    {
      label: 'Gross amount',
      width:
        contentW -
        Math.floor(contentW * 0.22) -
        Math.floor(contentW * 0.14) -
        Math.floor(contentW * 0.34) -
        Math.floor(contentW * 0.12),
      align: 'right',
    },
  ];

  if (payoutRows.length === 0) {
    const emptyH = 56;
    doc.roundedRect(margin, doc.y, contentW, emptyH, 8).strokeColor(INVOICE_COLORS.border).stroke();
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(INVOICE_COLORS.muted)
      .text('No successful payouts found during the selected statement period.', margin, doc.y + 20, {
        width: contentW,
        align: 'center',
      });
    doc.y += emptyH + 12;
  } else {
    let tableY = drawSimpleTableHeader(doc, margin, doc.y, contentW, payoutCols);
    payoutRows.forEach((row, index) => {
      if (tableY + TABLE_ROW_HEIGHT > contentBottom) {
        doc.addPage();
        doc.y = margin + 12;
        tableY = doc.y;
        tableY = drawSimpleTableHeader(doc, margin, tableY, contentW, payoutCols);
      }
      tableY = drawSimpleTableRow(
        doc,
        margin,
        tableY,
        contentW,
        payoutCols,
        [
          row.paidAtLabel,
          `#${row.id}`,
          truncateText(doc, row.transferId, payoutCols[2].width - 10),
          row.status,
          formatUsd(row.gross),
        ],
        index,
      );
    });
    doc.y = tableY + 10;
  }

  drawPageFooters(doc, company, generatedAt);
  doc.end();
  return done;
}

async function generateDriverEarningsStatementPdf(auth, query = {}, req = null) {
  void req;
  const providerId = await assertDriverAuth(auth);
  const range = resolveStatementRange(query);
  const { from, to, toInclusive, statementTitle, fileKey, idKey } = range;
  const statementId = buildStatementId(providerId, idKey);

  const user = await db.User.findByPk(providerId, {
    attributes: ['id', 'name', 'email', 'phone'],
  });
  if (!user) throw new HttpError(404, 'User not found');

  const payouts = await db.ProviderPayout.findAll({
    where: {
      provider_id: providerId,
      status: 'paid',
      [Op.or]: [
        { processed_at: { [Op.gte]: from, [Op.lt]: to } },
        {
          processed_at: null,
          created_at: { [Op.gte]: from, [Op.lt]: to },
        },
      ],
    },
    order: [
      ['processed_at', 'ASC'],
      ['created_at', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const payoutRows = mapPayoutRows(payouts);
  const { weekly, monthly, totalGross } = buildPayoutSummaries(payouts);

  const buffer = await renderEarningsStatementPdf({
    user,
    providerId,
    statementTitle,
    statementSubtitle: buildStatementSubtitle(from, toInclusive, statementId),
    payouts,
    payoutRows,
    weekly,
    monthly,
    totalGross,
  });

  return { buffer, filename: `car-comfort-earnings-${fileKey}.pdf` };
}

module.exports = { generateDriverEarningsStatementPdf };
