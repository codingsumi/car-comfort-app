const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const controller = require('../../controllers/admin/adminLegalPage.controller');
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const { validateRequest } = require('../../middlewares/validateRequest');
const {
  createLegalPageValidator,
  updateLegalPageValidator,
  listLegalPagesQueryValidator,
  legalPageIdParamValidator,
  reorderLegalPagesValidator
} = require('../../validators/legalPage.validators');

const router = express.Router();

const uploadDir = path.join(process.env.UPLOAD_DIR || 'uploads', 'legal');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.pdf';
    const safeExt = ext === '.pdf' ? ext : '.pdf';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `legal-${unique}${safeExt}`);
  }
});

const pdfUpload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' ||
      String(file.originalname || '')
        .toLowerCase()
        .endsWith('.pdf');
    cb(ok ? null : new Error('Only PDF files are allowed'), ok);
  }
});

router.get('/legal-pages', adminAuth, listLegalPagesQueryValidator, validateRequest, controller.listLegalPages);
router.patch(
  '/legal-pages/reorder',
  adminAuth,
  reorderLegalPagesValidator,
  validateRequest,
  controller.reorderLegalPagesHandler
);
router.post(
  '/legal-pages/upload-pdf',
  adminAuth,
  pdfUpload.single('pdf'),
  controller.uploadLegalPagePdf
);
router.get(
  '/legal-pages/:id',
  adminAuth,
  legalPageIdParamValidator,
  validateRequest,
  controller.getLegalPage
);
router.post(
  '/legal-pages',
  adminAuth,
  createLegalPageValidator,
  validateRequest,
  controller.createLegalPageHandler
);
router.patch(
  '/legal-pages/:id',
  adminAuth,
  updateLegalPageValidator,
  validateRequest,
  controller.updateLegalPageHandler
);
router.delete(
  '/legal-pages/:id',
  adminAuth,
  legalPageIdParamValidator,
  validateRequest,
  controller.deleteLegalPageHandler
);

module.exports = router;
