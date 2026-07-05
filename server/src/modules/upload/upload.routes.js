import express from 'express';
import requireAdmin from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';
import { isOptimizableImage, optimizeImageFile } from '../../utils/imageOptimizer.js';

const router = express.Router();

// Always root-relative — /uploads is served on the same origin, so this works
// behind any domain/proxy and can't be broken by a misconfigured PUBLIC_URL.
const toUrl = (filename) => `/uploads/${filename}`;

async function compressUpload(file) {
  if (!isOptimizableImage(file)) return file;
  const optimized = await optimizeImageFile(file.path);
  return {
    ...file,
    filename: optimized.filename,
    path: optimized.path,
    mimetype: 'image/webp',
    size: optimized.size,
    originalSize: optimized.originalSize,
  };
}

const payload = (file) => ({
  url: toUrl(file.filename),
  type: file.mimetype,
  size: file.size,
  originalSize: file.originalSize,
});

// ADMIN — single file
router.post(
  '/',
  requireAdmin,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No file uploaded');
    const file = await compressUpload(req.file);
    res.status(201).json({
      success: true,
      data: payload(file),
    });
  })
);

// ADMIN — multiple files (product galleries)
router.post(
  '/multiple',
  requireAdmin,
  upload.array('files', 10),
  asyncHandler(async (req, res) => {
    if (!req.files?.length) throw ApiError.badRequest('No files uploaded');
    const files = await Promise.all(req.files.map(compressUpload));
    res.status(201).json({
      success: true,
      data: files.map(payload),
    });
  })
);

export default router;
