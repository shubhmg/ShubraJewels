/**
 * One-off repair: earlier a misconfigured PUBLIC_URL produced malformed upload
 * URLs like "shubrajewels.shop/uploads/x.png" (no scheme, no leading slash).
 * This rewrites any stored value containing "/uploads/" to start at "/uploads/".
 *
 *   node src/scripts/fix-upload-urls.js
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Product from '../modules/product/product.model.js';
import Banner from '../modules/banner/banner.model.js';
import Video from '../modules/video/video.model.js';
import Review from '../modules/review/review.model.js';
import GalleryItem from '../modules/gallery/gallery.model.js';
import Category from '../modules/category/category.model.js';
import Collection from '../modules/collection/collection.model.js';
import { getSettings } from '../modules/setting/setting.model.js';

const fix = (s) => (typeof s === 'string' && s.includes('/uploads/') ? s.replace(/^.*?(\/uploads\/)/, '$1') : s);
let changed = 0;
const bump = (before, after) => { if (before !== after) changed++; return after; };

async function run() {
  await connectDB();

  for (const p of await Product.find()) {
    p.images = (p.images || []).map((u) => bump(u, fix(u)));
    p.video = bump(p.video, fix(p.video));
    if (p.isModified()) await p.save();
  }
  for (const [M, fields] of [[Banner, ['image']], [Video, ['src', 'poster']], [Review, ['image']], [GalleryItem, ['image']], [Category, ['image']], [Collection, ['image']]]) {
    for (const doc of await M.find()) {
      fields.forEach((f) => { doc[f] = bump(doc[f], fix(doc[f])); });
      if (doc.isModified()) await doc.save();
    }
  }

  const s = await getSettings();
  s.logo = bump(s.logo, fix(s.logo));
  if (s.homepage?.hero) s.homepage.hero.mediaUrl = bump(s.homepage.hero.mediaUrl, fix(s.homepage.hero.mediaUrl));
  (s.homepage?.blocks || []).forEach((b) => { if (b.config?.url) b.config.url = bump(b.config.url, fix(b.config.url)); });
  s.markModified('homepage');
  await s.save();

  console.log(`Done — repaired ${changed} URL(s).`);
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
