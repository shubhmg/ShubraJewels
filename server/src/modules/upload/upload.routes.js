import express from 'express';
import requireAdmin from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';
import env from '../../config/env.js';

const router = express.Router();

const toUrl = (filename) => `${env.publicUrl || ''}/uploads/${filename}`;

// ADMIN — single file
router.post(
  '/',
  requireAdmin,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No file uploaded');
    res.status(201).json({
      success: true,
      data: { url: toUrl(req.file.filename), type: req.file.mimetype, size: req.file.size },
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
    res.status(201).json({
      success: true,
      data: req.files.map((f) => ({ url: toUrl(f.filename), type: f.mimetype, size: f.size })),
    });
  })
);

export default router;
