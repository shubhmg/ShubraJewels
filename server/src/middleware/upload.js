import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, resolve, extname } from 'path';
import { randomBytes } from 'crypto';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = resolve(__dirname, '../../uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
    cb(null, name);
  },
});

// SVG intentionally excluded: it can carry inline <script> and /uploads is
// served same-origin as the admin, so an opened SVG would be stored XSS.
const ALLOWED = /^(image\/(jpe?g|png|webp|gif|avif)|video\/(mp4|webm|quicktime))$/;

export const upload = multer({
  storage,
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB (short videos)
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.test(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported file type. Use images or mp4/webm video.'));
  },
});
