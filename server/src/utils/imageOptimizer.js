import fs from 'fs/promises';
import { basename, dirname, extname, join } from 'path';
import sharp from 'sharp';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

export const imageConfig = {
  maxWidth: 1800,
  maxHeight: 1800,
  quality: 78,
};

export function isOptimizableImage(file) {
  if (file?.mimetype) return IMAGE_TYPES.has(file.mimetype);
  return IMAGE_EXTS.has(extname(file || '').toLowerCase());
}

export function optimizedName(filename) {
  const ext = extname(filename);
  const base = basename(filename, ext);
  return ext.toLowerCase() === '.webp' ? `${base}-optimized.webp` : `${base}.webp`;
}

export async function optimizeImageFile(filePath, { removeOriginal = true, skipIfLarger = false } = {}) {
  const dir = dirname(filePath);
  const nextName = optimizedName(filePath);
  const nextPath = join(dir, nextName);

  await sharp(filePath, { animated: false })
    .rotate()
    .resize({
      width: imageConfig.maxWidth,
      height: imageConfig.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: imageConfig.quality, effort: 5 })
    .toFile(nextPath);

  const [before, after] = await Promise.all([fs.stat(filePath), fs.stat(nextPath)]);

  if (skipIfLarger && after.size >= before.size) {
    await fs.unlink(nextPath).catch(() => {});
    return { path: filePath, filename: basename(filePath), size: before.size, optimized: false, originalSize: before.size };
  }

  if (removeOriginal && nextPath !== filePath) await fs.unlink(filePath).catch(() => {});

  return {
    path: nextPath,
    filename: nextName,
    size: after.size,
    optimized: true,
    originalSize: before.size,
  };
}
