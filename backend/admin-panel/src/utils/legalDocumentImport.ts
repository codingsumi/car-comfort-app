/** Accepted extensions for legal page document import. */
export const LEGAL_IMPORT_ACCEPT =
  '.docx,.html,.htm,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,text/plain';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripScripts(html: string): string {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

function wrapAsLegalArticle(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return '';
  if (/<article[\s>]/i.test(trimmed)) return trimmed;
  return `<article class="legal-page">\n${trimmed}\n</article>`;
}

function textToHtml(text: string): string {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (!blocks.length) return '';

  const body = blocks
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`)
    .join('\n');
  return wrapAsLegalArticle(body);
}

function extensionOf(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (fromName) return fromName;

  const mime = file.type.toLowerCase();
  if (mime.includes('wordprocessingml')) return 'docx';
  if (mime === 'text/html') return 'html';
  if (mime === 'text/plain') return 'txt';
  return '';
}

async function importDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const warnings = result.messages?.filter((m) => m.type === 'warning') ?? [];
  if (warnings.length > 0) {
    console.warn('DOCX import warnings:', warnings);
  }
  return wrapAsLegalArticle(result.value);
}

async function importHtml(file: File): Promise<string> {
  const raw = await file.text();
  return wrapAsLegalArticle(stripScripts(raw));
}

async function importTxt(file: File): Promise<string> {
  const raw = await file.text();
  return textToHtml(raw);
}

export type LegalImportMode = 'replace' | 'append';

export function mergeImportedHtml(
  existing: string,
  imported: string,
  mode: LegalImportMode
): string {
  const next = imported.trim();
  if (!next) return existing;
  if (mode === 'replace' || !existing.trim()) return next;
  return `${existing.trim()}\n\n${next}`;
}

/**
 * Converts an uploaded document into HTML suitable for legal page `description_json.html`.
 */
export async function importLegalDocument(file: File): Promise<string> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error('File is too large. Maximum size is 5 MB.');
  }

  const ext = extensionOf(file);

  let html = '';
  switch (ext) {
    case 'docx':
      html = await importDocx(file);
      break;
    case 'html':
    case 'htm':
      html = await importHtml(file);
      break;
    case 'txt':
      html = await importTxt(file);
      break;
    default:
      throw new Error('Unsupported file type. Please upload .docx, .html, or .txt');
  }

  if (!html.trim()) {
    throw new Error('The document appears to be empty.');
  }

  return html;
}

export function formatImportFileLabel(file: File): string {
  const kb = Math.max(1, Math.round(file.size / 1024));
  return `${file.name} (${kb} KB)`;
}
