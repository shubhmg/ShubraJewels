import fs from 'fs/promises';
import { join } from 'path';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { UPLOAD_DIR } from '../middleware/upload.js';
import { isOptimizableImage, optimizeImageFile } from '../utils/imageOptimizer.js';

import Setting from '../modules/setting/setting.model.js';
import Category from '../modules/category/category.model.js';
import Collection from '../modules/collection/collection.model.js';
import Product from '../modules/product/product.model.js';
import Banner from '../modules/banner/banner.model.js';
import Video from '../modules/video/video.model.js';
import Review from '../modules/review/review.model.js';
import GalleryItem from '../modules/gallery/gallery.model.js';

const MODELS = [Setting, Category, Collection, Product, Banner, Video, Review, GalleryItem];
const SKIP_KEYS = new Set(['_id', '__v', 'createdAt', 'updatedAt']);

function replaceUrls(value, replacements) {
  if (typeof value === 'string') return replacements.get(value) || value;
  if (Array.isArray(value)) return value.map((item) => replaceUrls(item, replacements));
  // Only recurse into PLAIN objects. ObjectId, Date, Buffer, etc. must pass
  // through untouched — rebuilding them corrupts the value (e.g. ObjectId → {buffer}).
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceUrls(item, replacements)])
    );
  }
  return value;
}

async function rewriteModel(Model, replacements) {
  let changed = 0;
  const docs = await Model.find();
  for (const doc of docs) {
    const before = doc.toObject({ depopulate: true });
    const after = replaceUrls(before, replacements);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;

    for (const [key, value] of Object.entries(after)) {
      if (SKIP_KEYS.has(key)) continue;
      doc.set(key, value);
      if (value && typeof value === 'object') doc.markModified(key);
    }
    await doc.save();
    changed += 1;
  }
  return changed;
}

async function main() {
  await connectDB();

  const files = await fs.readdir(UPLOAD_DIR);
  const replacements = new Map();
  let optimized = 0;
  let savedBytes = 0;

  for (const filename of files) {
    if (!isOptimizableImage(filename)) continue;
    if (filename.includes('-optimized')) continue; // already optimized in a prior pass

    const input = join(UPLOAD_DIR, filename);
    let result;
    try {
      result = await optimizeImageFile(input, { removeOriginal: false, skipIfLarger: true });
    } catch (err) {
      console.warn(`skipped ${filename}: ${err.message}`);
      continue;
    }
    if (!result.optimized) continue;

    replacements.set(`/uploads/${filename}`, `/uploads/${result.filename}`);
    optimized += 1;
    savedBytes += Math.max(0, result.originalSize - result.size);
    console.log(`optimized ${filename} -> ${result.filename} (${result.originalSize} -> ${result.size})`);
  }

  let docsChanged = 0;
  if (replacements.size) {
    for (const Model of MODELS) {
      const count = await rewriteModel(Model, replacements);
      if (count) console.log(`rewrote ${count} ${Model.modelName} document(s)`);
      docsChanged += count;
    }
  }

  console.log(`Done. Optimized ${optimized} image(s), rewrote ${docsChanged} document(s), saved ~${Math.round(savedBytes / 1024)} KB.`);
  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});

