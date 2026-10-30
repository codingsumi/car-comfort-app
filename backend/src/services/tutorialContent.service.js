const db = require('../models');

const AUDIENCE = {
  CUSTOMER: 'customer',
  DRIVER: 'driver'
};

const DEFAULT_INSTRUCTIONS_BY_AUDIENCE = {
  [AUDIENCE.CUSTOMER]: [
    'How to request a service',
    'Tracking your service provider in real-time',
    'Payment and safety features'
  ],
  [AUDIENCE.DRIVER]: [
    'How to view and accept jobs on your home map',
    'Taking before and after photos and verifying the customer PIN',
    'Using navigation to reach pickup and drop-off locations',
    'Completing services and tracking your earnings',
    'Staying available to receive new job requests'
  ]
};

function normalizeAudience(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === AUDIENCE.DRIVER || raw === 'provider') return AUDIENCE.DRIVER;
  return AUDIENCE.CUSTOMER;
}

function normalizeInstructionList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function parseInstructionsJson(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return normalizeInstructionList(parsed);
  } catch (_e) {
    return [];
  }
}

function parseInstructionsFromEnv(audience) {
  const envKey =
    audience === AUDIENCE.DRIVER
      ? 'DRIVER_TUTORIAL_INSTRUCTIONS'
      : 'TUTORIAL_INSTRUCTIONS';
  const fallback = DEFAULT_INSTRUCTIONS_BY_AUDIENCE[audience];
  const raw = process.env[envKey];
  if (!raw || typeof raw !== 'string') return fallback;
  const rows = raw
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
  return rows.length ? rows : fallback;
}

function defaultInstructionsFor(audience) {
  return [...DEFAULT_INSTRUCTIONS_BY_AUDIENCE[normalizeAudience(audience)]];
}

async function getTutorialContent(audience = AUDIENCE.CUSTOMER) {
  const normalizedAudience = normalizeAudience(audience);
  const row = await db.TutorialContent.findOne({
    where: { audience: normalizedAudience },
    order: [['id', 'DESC']]
  });

  if (row) {
    const videoUrl = typeof row.video_url === 'string' ? row.video_url.trim() : '';
    const instructions = parseInstructionsJson(row.instructions_json);
    const fallback = defaultInstructionsFor(normalizedAudience);
    return {
      audience: normalizedAudience,
      video_url: videoUrl || null,
      instructions: instructions.length ? instructions : fallback
    };
  }

  const envVideoKey =
    normalizedAudience === AUDIENCE.DRIVER
      ? 'DRIVER_TUTORIAL_VIDEO_URL'
      : 'TUTORIAL_VIDEO_URL';
  const envVideoUrl = String(process.env[envVideoKey] || '').trim();
  return {
    audience: normalizedAudience,
    video_url: envVideoUrl || null,
    instructions: parseInstructionsFromEnv(normalizedAudience)
  };
}

async function upsertTutorialContent({
  audience = AUDIENCE.CUSTOMER,
  videoUrl,
  instructions
}) {
  const normalizedAudience = normalizeAudience(audience);
  const row = await db.TutorialContent.findOne({
    where: { audience: normalizedAudience },
    order: [['id', 'DESC']]
  });
  const payload = {
    audience: normalizedAudience,
    video_url: videoUrl || null,
    instructions_json: JSON.stringify(normalizeInstructionList(instructions))
  };

  if (!row) {
    return db.TutorialContent.create(payload);
  }
  await row.update(payload);
  return row;
}

module.exports = {
  AUDIENCE,
  DEFAULT_INSTRUCTIONS: DEFAULT_INSTRUCTIONS_BY_AUDIENCE[AUDIENCE.CUSTOMER],
  DEFAULT_INSTRUCTIONS_BY_AUDIENCE,
  getTutorialContent,
  upsertTutorialContent,
  normalizeInstructionList,
  normalizeAudience,
  defaultInstructionsFor
};
