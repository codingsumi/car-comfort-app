const { HttpError } = require('../../utils/httpError');
const {
  getTutorialContent,
  upsertTutorialContent,
  normalizeInstructionList,
  normalizeAudience,
  defaultInstructionsFor,
  AUDIENCE
} = require('../../services/tutorialContent.service');
const {
  listTutorialVideoItems,
  createTutorialVideoItem,
  updateTutorialVideoItem,
  deleteTutorialVideoItem,
  getTutorialVideoItemById
} = require('../../services/tutorialVideoItem.service');
const fs = require('fs');

function resolveAudience(req) {
  const fromParams = req.params?.audience;
  if (fromParams) return normalizeAudience(fromParams);
  const path = String(req.path || req.originalUrl || '').toLowerCase();
  if (path.includes('/driver')) return AUDIENCE.DRIVER;
  const queryAudience = req.query?.audience;
  if (queryAudience) return normalizeAudience(queryAudience);
  return AUDIENCE.CUSTOMER;
}

async function getTutorial(req, res, next) {
  try {
    const audience = resolveAudience(req);
    const tutorial = await getTutorialContent(audience);
    return res.success('Tutorial fetched', tutorial);
  } catch (err) {
    return next(err);
  }
}

async function upsertTutorial(req, res, next) {
  try {
    const audience = resolveAudience(req);
    const videoUrl = typeof req.body.video_url === 'string' ? req.body.video_url.trim() : '';
    const instructions = normalizeInstructionList(req.body.instructions);
    if (!instructions.length) throw new HttpError(400, 'instructions must have at least one item');

    await upsertTutorialContent({
      audience,
      videoUrl: videoUrl || null,
      instructions
    });

    const tutorial = await getTutorialContent(audience);
    return res.success('Tutorial updated', tutorial);
  } catch (err) {
    return next(err);
  }
}

async function uploadTutorialVideo(req, res, next) {
  try {
    if (!req.file) throw new HttpError(400, 'No video file uploaded');

    const audience = resolveAudience(req);
    const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4001}`;
    const uploadBase = process.env.UPLOAD_PUBLIC_BASE || '/uploads';
    const videoUrl = `${baseUrl}${uploadBase}/tutorials/${req.file.filename}`;

    const tutorial = await getTutorialContent(audience);
    const instructions =
      tutorial.instructions && tutorial.instructions.length
        ? tutorial.instructions
        : defaultInstructionsFor(audience);

    if (tutorial.video_url) {
      const oldMount = (process.env.UPLOAD_PUBLIC_BASE || '/uploads').replace(/\/+$/, '');
      const oldBase = (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4001}`).replace(/\/+$/, '');
      const oldUrl = tutorial.video_url;
      const relative = oldUrl.replace(oldBase, '').replace(oldMount, '');
      const oldPath = require('path').join(
        process.env.UPLOAD_DIR || 'uploads',
        'tutorials',
        require('path').basename(relative)
      );
      fs.unlink(oldPath, () => {});
    }

    await upsertTutorialContent({ audience, videoUrl, instructions });

    return res.success('Video uploaded successfully', { video_url: videoUrl });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return next(err);
  }
}

async function listTutorialVideos(req, res, next) {
  try {
    const audience = resolveAudience(req);
    const data = await listTutorialVideoItems({ audience, publishedOnly: false });
    return res.success('Tutorial videos fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function createTutorialVideo(req, res, next) {
  try {
    const item = await createTutorialVideoItem({
      audience: resolveAudience(req),
      category: req.body.category,
      title: req.body.title,
      description: req.body.description,
      instructions: req.body.instructions,
      videoUrl: req.body.video_url,
      sortOrder: req.body.sort_order,
      isPublished: req.body.is_published
    });
    return res.success('Tutorial video created', item);
  } catch (err) {
    return next(err);
  }
}

async function updateTutorialVideo(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) throw new HttpError(400, 'Invalid tutorial video id');
    const item = await updateTutorialVideoItem(id, {
      audience: req.body.audience,
      category: req.body.category,
      title: req.body.title,
      description: req.body.description,
      instructions: req.body.instructions,
      videoUrl: req.body.video_url,
      sortOrder: req.body.sort_order,
      isPublished: req.body.is_published
    });
    return res.success('Tutorial video updated', item);
  } catch (err) {
    return next(err);
  }
}

async function deleteTutorialVideo(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) throw new HttpError(400, 'Invalid tutorial video id');
    await deleteTutorialVideoItem(id);
    return res.success('Tutorial video deleted');
  } catch (err) {
    return next(err);
  }
}

async function uploadTutorialLibraryVideo(req, res, next) {
  try {
    if (!req.file) throw new HttpError(400, 'No video file uploaded');
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) throw new HttpError(400, 'Invalid tutorial video id');

    const row = await getTutorialVideoItemById(id);
    const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4001}`;
    const uploadBase = process.env.UPLOAD_PUBLIC_BASE || '/uploads';
    const videoUrl = `${baseUrl}${uploadBase}/tutorials/${req.file.filename}`;

    if (row.video_url) {
      const oldMount = (process.env.UPLOAD_PUBLIC_BASE || '/uploads').replace(/\/+$/, '');
      const oldBase = (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4001}`).replace(/\/+$/, '');
      const oldUrl = row.video_url;
      const relative = oldUrl.replace(oldBase, '').replace(oldMount, '');
      const oldPath = require('path').join(
        process.env.UPLOAD_DIR || 'uploads',
        'tutorials',
        require('path').basename(relative)
      );
      fs.unlink(oldPath, () => {});
    }

    const item = await updateTutorialVideoItem(id, { videoUrl });
    return res.success('Video uploaded successfully', item);
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return next(err);
  }
}

module.exports = {
  getTutorial,
  upsertTutorial,
  uploadTutorialVideo,
  listTutorialVideos,
  createTutorialVideo,
  updateTutorialVideo,
  deleteTutorialVideo,
  uploadTutorialLibraryVideo
};
