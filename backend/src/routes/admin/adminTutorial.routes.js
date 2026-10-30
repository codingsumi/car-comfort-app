const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const router = express.Router();
const controller = require('../../controllers/admin/adminTutorial.controller');
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const { validateRequest } = require('../../middlewares/validateRequest');
const { upsertTutorialValidator } = require('../../validators/tutorial.validators');

const uploadDir = path.join(process.env.UPLOAD_DIR || 'uploads', 'tutorials');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `tutorial-video-${uniqueSuffix}${ext}`);
  },
});

const videoFilter = (_req, file, cb) => {
  // Only allow formats that Android ExoPlayer (video_player plugin) supports.
  // MOV / QuickTime is iOS-only and will not play on Android — block it.
  const allowed = [
    'video/mp4',
    'video/x-msvideo',   // AVI
    'video/x-matroska',  // MKV
    'video/webm',
    'video/mpeg',
  ];
  const isMovByName = /\.(mov|MOV)$/.test(file.originalname || '');
  if (!allowed.includes(file.mimetype) || isMovByName) {
    cb(new Error(
      'MOV files are not supported on Android. Please convert to MP4 before uploading.'
    ), false);
  } else {
    cb(null, true);
  }
};

const TUTORIAL_VIDEO_MAX_BYTES = 400 * 1024 * 1024;

const upload = multer({
  storage,
  fileFilter: videoFilter,
  limits: { fileSize: TUTORIAL_VIDEO_MAX_BYTES },
});

router.get('/tutorial', adminAuth, controller.getTutorial);
router.put('/tutorial', adminAuth, upsertTutorialValidator, validateRequest, controller.upsertTutorial);
router.post('/tutorial/upload-video', adminAuth, upload.single('video'), controller.uploadTutorialVideo);

router.get('/tutorial/driver', adminAuth, controller.getTutorial);
router.put('/tutorial/driver', adminAuth, upsertTutorialValidator, validateRequest, controller.upsertTutorial);
router.post('/tutorial/driver/upload-video', adminAuth, upload.single('video'), controller.uploadTutorialVideo);

router.get('/tutorial/videos', adminAuth, controller.listTutorialVideos);
router.post('/tutorial/videos', adminAuth, controller.createTutorialVideo);
router.put('/tutorial/videos/:id', adminAuth, controller.updateTutorialVideo);
router.delete('/tutorial/videos/:id', adminAuth, controller.deleteTutorialVideo);
router.post(
  '/tutorial/videos/:id/upload-video',
  adminAuth,
  upload.single('video'),
  controller.uploadTutorialLibraryVideo
);

module.exports = router;
