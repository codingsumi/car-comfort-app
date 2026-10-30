const { Op } = require('sequelize');
const db = require('../models');

/**
 * Server-side text safety: strip tags and control chars for persisted user content.
 * @param {string} input
 * @param {{ maxLength?: number }} [opts]
 */
function sanitizePlainText(input, opts = {}) {
  const maxLength = opts.maxLength ?? 20000;
  let s = String(input ?? '');
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  s = s.trim();
  if (s.length > maxLength) {
    s = s.slice(0, maxLength);
  }
  return s;
}

const PROFANITY = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'cunt',
  'dick',
  'piss',
  'cock',
  'pussy',
];

const HATE_TERMS = [
  'kill yourself',
  'kys',
  'nazi',
  'genocide',
  'rape you',
  'lynch',
  'terrorist scum',
];

const SPAM_MARKERS = [
  'click this link',
  'bit.ly/',
  'tinyurl',
  'buy now',
  '100% free',
  'crypto investment',
  'whatsapp +',
  'earn $',
  'work from home $$',
];

function tokenHits(text, terms) {
  const lower = text.toLowerCase();
  const hits = [];
  for (const term of terms) {
    if (lower.includes(term.toLowerCase())) hits.push(term);
  }
  return hits;
}

function excessiveProfanityHits(text) {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const w of PROFANITY) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const m = lower.match(re);
    if (m) hits += m.length;
  }
  return hits;
}

/**
 * Automated moderation signals for review text (and light context).
 * @param {{ message: string | null, rating?: number, reviewerUserId?: number }} params
 */
async function analyzeReviewContent(params) {
  const message = params.message || '';
  const reasons = [];
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return { shouldAutoFlag: false, reasons: [], flagsIncrement: 0, duplicateSuspected: false };
  }

  const profHits = tokenHits(normalized, PROFANITY);
  if (profHits.length) {
    reasons.push({ code: 'profanity', detail: profHits.slice(0, 5) });
  }

  const hateHits = tokenHits(normalized, HATE_TERMS);
  if (hateHits.length) {
    reasons.push({ code: 'hate_speech', detail: hateHits.slice(0, 5) });
  }

  const spamHits = tokenHits(normalized, SPAM_MARKERS);
  if (spamHits.length) {
    reasons.push({ code: 'spam', detail: spamHits.slice(0, 5) });
  }

  const profanityCount = excessiveProfanityHits(message);
  if (profanityCount >= 3) {
    reasons.push({ code: 'excessive_profanity', detail: { count: profanityCount } });
  }

  const trimmedMsg = message.trim();
  const dupCount =
    params.reviewerUserId && trimmedMsg.length >= 10
      ? await db.Review.count({
          where: {
            reviewer_user_id: params.reviewerUserId,
            message: trimmedMsg,
            created_at: { [Op.gte]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
          },
        })
      : 0;

  const duplicateSuspected = dupCount >= 1;
  if (duplicateSuspected) {
    reasons.push({ code: 'duplicate_suspected', detail: { similar_count: dupCount } });
  }

  const oneStarBomb = Number(params.rating) === 1 && normalized.length > 400 && profHits.length > 0;
  if (oneStarBomb) {
    reasons.push({ code: 'abuse_pattern', detail: { pattern: 'low_rating_long_rant' } });
  }

  const shouldAutoFlag = reasons.some((r) =>
    ['hate_speech', 'spam', 'excessive_profanity', 'abuse_pattern'].includes(r.code)
  ) || (reasons.some((r) => r.code === 'profanity') && duplicateSuspected);

  const flagsIncrement = reasons.length ? 1 : 0;

  return { shouldAutoFlag, reasons, flagsIncrement, duplicateSuspected };
}

module.exports = {
  sanitizePlainText,
  analyzeReviewContent,
};
