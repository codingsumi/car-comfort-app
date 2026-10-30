const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'email', 'baseTemplate.html');
const LOGO_FILE_PATH = path.join(__dirname, '..', 'assets', 'images', 'logo.svg');

/**
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert plain text with newlines to simple HTML paragraphs (for message body).
 * @param {string} str
 * @param {boolean} escape
 * @returns {string}
 */
function textToEmailHtml(str, escape = true) {
  if (str == null) return '';
  const s = escape ? escapeHtml(str) : String(str);
  const parts = s.split(/\r?\n\r?\n/);
  return parts
    .map((block) => {
      const lines = block.split(/\r?\n/);
      const inner = lines.join('<br />');
      return `<span style="display:block;margin:0 0 12px 0;text-align:center;">${inner}</span>`;
    })
    .join('');
}

/**
 * Public logo URL for &lt;img src&gt; (emails need absolute http(s) URLs for most clients when not using CID).
 * @returns {string}
 */
function resolveLogoUrl() {
  if (process.env.EMAIL_LOGO_URL) {
    return String(process.env.EMAIL_LOGO_URL).trim();
  }
  const base = process.env.PUBLIC_BASE_URL;
  if (base && String(base).trim()) {
    const root = String(base).replace(/\/$/, '');
    return `${root}/assets/images/logo.svg`;
  }
  const svg = fs.readFileSync(LOGO_FILE_PATH, 'utf8');
  const base64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.code]
 * @param {string} [params.buttonText]
 * @param {string} [params.buttonLink]
 * @param {string} [params.footer]
 * @param {string} [params.preheader] Inbox preview line (plain text, optional)
 * @returns {string} Complete HTML email body
 */
function generateEmailTemplate({ title, message, code, buttonText, buttonLink, footer, preheader }) {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const year = new Date().getFullYear();
  const hasCode = code != null && String(code).trim() !== '';
  const codeStr = hasCode ? String(code).trim() : '';
  const hasButton = buttonText != null && buttonLink != null && String(buttonText).trim() !== '' && String(buttonLink).trim() !== '';
  const footerText =
    footer != null && footer !== ''
      ? footer
      : 'If you did not expect this email, you can safely disregard it.';

  const pre =
    preheader != null && preheader !== ''
      ? escapeHtml(String(preheader))
      : escapeHtml(String(message).replace(/\s+/g, ' ').trim().slice(0, 120));

  const codeBlock = hasCode
    ? [
        '<tr>',
        '  <td align="center" style="padding:0 0 28px 0;">',
        '    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">',
        '      <tr>',
        '        <td style="background-color:#F3F4F6;border-radius:8px;padding:24px 20px;" align="center">',
        '          <p style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:700;letter-spacing:0.2em;color:#111827;line-height:1.2;text-align:center;">',
        `            ${escapeHtml(codeStr)}`,
        '          </p>',
        '        </td>',
        '      </tr>',
        '    </table>',
        '  </td>',
        '</tr>'
      ].join('\n')
    : '';

  const buttonBlock = hasButton
    ? [
        '<tr>',
        '  <td align="center" style="padding:0 0 28px 0;">',
        '    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">',
        '      <tr>',
        '        <td align="center" style="border-radius:6px;background-color:#2563EB;">',
        `          <a href="${escapeHtml(String(buttonLink).trim())}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:6px;">`,
        `            ${escapeHtml(String(buttonText).trim())}`,
        '          </a>',
        '        </td>',
        '      </tr>',
        '    </table>',
        '  </td>',
        '</tr>'
      ].join('\n')
    : '';

  return template
    .replace(/\{\{title\}\}/g, escapeHtml(title))
    .replace(/\{\{message\}\}/g, textToEmailHtml(message, true))
    .replace(/__CODE_BLOCK__/g, codeBlock + buttonBlock)
    .replace(/\{\{footer\}\}/g, textToEmailHtml(footerText, true))
    .replace(/__LOGO_URL__/g, resolveLogoUrl())
    .replace(/__PREHEADER__/g, pre)
    .replace(/__YEAR__/g, String(year));
}

module.exports = {
  generateEmailTemplate,
  escapeHtml,
  resolveLogoUrl
};
