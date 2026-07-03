/**
 * Seeds the `shubra` database with starter content so the storefront isn't empty.
 * - Always upserts the admin user (from .env ADMIN_EMAIL / ADMIN_PASSWORD).
 * - Seeds content only when empty, unless run with FORCE=1 (wipes content first).
 *
 *   npm run seed            # safe: fills only empty collections
 *   FORCE=1 npm run seed    # wipes & reseeds content (keeps orders/visits)
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import { connectDB } from '../config/db.js';
import slugify from '../utils/slugify.js';

import AdminUser from '../modules/auth/adminUser.model.js';
import Setting, { getSettings } from '../modules/setting/setting.model.js';
import Category from '../modules/category/category.model.js';
import Collection from '../modules/collection/collection.model.js';
import Product from '../modules/product/product.model.js';
import Banner from '../modules/banner/banner.model.js';
import Video from '../modules/video/video.model.js';
import Review from '../modules/review/review.model.js';
import GalleryItem from '../modules/gallery/gallery.model.js';

const IMG = {
  a: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80',
  b: 'https://images.unsplash.com/photo-1573408301185-9519f94815b8?w=800&q=80',
  c: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80',
  d: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=800&q=80',
};

const CATEGORIES = [
  { name: 'Oxidised Jhumka', hindiName: 'ऑक्सीडाइज़्ड झुमका', image: IMG.a },
  { name: 'Meenakari Jhumka', hindiName: 'मीनाकारी झुमका', image: IMG.b },
  { name: 'Bridal Collection', hindiName: 'ब्राइडल कलेक्शन', image: IMG.c },
  { name: 'Festival Collection', hindiName: 'त्योहार कलेक्शन', image: IMG.d },
  { name: 'Premium', hindiName: 'प्रीमियम', image: IMG.a },
  { name: 'Kashmiri Collection', hindiName: 'कश्मीरी कलेक्शन', image: IMG.b },
  { name: 'Jaipur Collection', hindiName: 'जयपुर कलेक्शन', image: IMG.c },
  { name: 'Under 599', hindiName: '₹599 से कम', image: IMG.d },
];

const COLLECTIONS = [
  { name: 'Maharani', hindiName: 'महारानी', tagline: 'Fit for a queen', accentColor: '#7B1E2B', image: IMG.a,
    description: 'Grand, regal jhumkas that carry the weight of royalty — for the woman who rules every room.' },
  { name: 'Rajputana', hindiName: 'राजपूताना', tagline: 'Warrior heritage, feminine grace', accentColor: '#9B2226', image: IMG.b,
    description: 'Bold silhouettes inspired by the forts and valour of Rajputana.' },
  { name: 'Banjara', hindiName: 'बंजारा', tagline: 'Free spirit of the desert', accentColor: '#B5651D', image: IMG.c,
    description: 'Tribal, colourful, and untamed — jhumkas for the wandering soul.' },
  { name: 'Meenakari', hindiName: 'मीनाकारी', tagline: 'Painted in enamel', accentColor: '#1E7B5A', image: IMG.d,
    description: 'Hand-painted meenakari enamel from the artisans of Jaipur.' },
  { name: 'Chandni', hindiName: 'चाँदनी', tagline: 'Moonlit silver elegance', accentColor: '#5A6B7B', image: IMG.a,
    description: 'Silver-toned, delicate jhumkas that shimmer like moonlight.' },
  { name: 'Noor', hindiName: 'नूर', tagline: 'The light of luxury', accentColor: '#C9A84C', image: IMG.b,
    description: 'Our most luminous premium pieces — pure radiance.' },
];

// name, hindiName, price, mrp, category, collections, story, images, flags
const PRODUCTS = [
  { name: 'Rani Jhumka', hindiName: 'रानी झुमका', price: 1299, mrp: 1799, category: 'Bridal Collection', collections: ['Maharani'],
    story: 'Named after the queens of Mewar, the Rani Jhumka was born for grand entrances. Each bell is tuned so it sings softly as you walk — the sound of a woman who owns the room.',
    material: 'Gold-plated brass', weight: '18g', images: [IMG.a, IMG.b], isBestseller: true, tags: ['bridal', 'heavy'] },
  { name: 'Meenakari Chandbali', hindiName: 'मीनाकारी चाँदबाली', price: 899, mrp: 1199, category: 'Meenakari Jhumka', collections: ['Meenakari'],
    story: 'A crescent moon hand-painted in Jaipur enamel. The artisan who made yours has painted meenakari for thirty years — every green is mixed by his own hand.',
    material: 'Gold-plated, enamel', weight: '14g', images: [IMG.b, IMG.a], isBestseller: true, tags: ['meenakari'] },
  { name: 'Kashmiri Noor', hindiName: 'कश्मीरी नूर', price: 2499, mrp: 2999, category: 'Kashmiri Collection', collections: ['Noor'],
    story: 'Inspired by the shikaras of Dal Lake at dusk. Noor means light — and these catch it from every angle.',
    material: 'Silver-plated', weight: '22g', images: [IMG.c, IMG.d], isNew: true, tags: ['premium', 'kashmiri'] },
  { name: 'Banjara Bells', hindiName: 'बंजारा घुँघरू', price: 549, mrp: 799, category: 'Under 599', collections: ['Banjara'],
    story: 'From the caravans of the Thar. Loud, proud, and impossible to ignore — the jhumka that dances even when you stand still.',
    material: 'Oxidised silver', weight: '12g', images: [IMG.d, IMG.c], tags: ['oxidised', 'under599'] },
  { name: 'Oxidised Mor', hindiName: 'ऑक्सीडाइज़्ड मोर', price: 499, mrp: 699, category: 'Oxidised Jhumka', collections: ['Banjara'],
    story: 'The peacock (mor) is the soul of Rajasthani art. This pair spreads its feathers across your shoulders.',
    material: 'Oxidised silver', weight: '10g', images: [IMG.a, IMG.c], tags: ['oxidised', 'under599'] },
  { name: 'Jaipur Gulaab', hindiName: 'जयपुर गुलाब', price: 1099, mrp: 1499, category: 'Jaipur Collection', collections: ['Meenakari', 'Rajputana'],
    story: 'The pink city in a pair of earrings. Rose-enamel petals set against gold, just like the sandstone of Jaipur at sunrise.',
    material: 'Gold-plated, enamel', weight: '15g', images: [IMG.b, IMG.d], isNew: true, tags: ['jaipur', 'meenakari'] },
  { name: 'Maharani Polki', hindiName: 'महारानी पोल्की', price: 4999, mrp: 6499, category: 'Premium', collections: ['Maharani', 'Noor'],
    story: 'Our crown jewel. Uncut polki-style stones set in the kundan tradition — the piece brides pass to their daughters.',
    material: 'Gold-plated, kundan', weight: '38g', images: [IMG.c, IMG.a], isBestseller: true, tags: ['premium', 'bridal'] },
  { name: 'Festive Chandni', hindiName: 'त्योहार चाँदनी', price: 799, mrp: 1099, category: 'Festival Collection', collections: ['Chandni'],
    story: 'Made for the lamp-lit nights of Diwali. Silver drops that throw light like a hundred tiny diyas.',
    material: 'Silver-plated', weight: '13g', images: [IMG.d, IMG.b], tags: ['festival'] },
  { name: 'Rajputana Kalira', hindiName: 'राजपूताना कलीरा', price: 1799, mrp: 2299, category: 'Bridal Collection', collections: ['Rajputana', 'Maharani'],
    story: 'Layered like the armour of a Rajput princess — strong, ornate, unmistakably royal.',
    material: 'Gold-plated brass', weight: '26g', images: [IMG.a, IMG.d], tags: ['bridal', 'heavy'] },
  { name: 'Chandni Chaandi', hindiName: 'चाँदनी चाँदी', price: 399, mrp: 599, category: 'Under 599', collections: ['Chandni'],
    story: 'Everyday moonlight. Feather-light silver jhumkas you can wear from morning chai to midnight.',
    material: 'Silver-plated', weight: '6g', images: [IMG.b, IMG.c], tags: ['everyday', 'under599'] },
];

const REVIEWS = [
  { name: 'Priya Sharma', location: 'Delhi', rating: 5, isFeatured: true,
    text: 'The Rani Jhumka is even more beautiful in person. Wore it to my sister\'s wedding and got compliments all night!' },
  { name: 'Anjali Mehta', location: 'Jaipur', rating: 5, isFeatured: true,
    text: 'Meenakari work is so detailed. You can tell it\'s handmade. Delivery to Jaipur was quick too.' },
  { name: 'Sneha Reddy', location: 'Hyderabad', rating: 4, isFeatured: false,
    text: 'Lightweight and comfortable for all-day wear. The Chandni pair is my new favourite.' },
  { name: 'Ritu Agarwal', location: 'Mumbai', rating: 5, isFeatured: true,
    text: 'Ordered on WhatsApp, the team was so helpful. Beautiful packaging, felt premium.' },
];

async function upsertAdmin() {
  const email = env.admin.email.toLowerCase().trim();
  let admin = await AdminUser.findOne({ email });
  const passwordHash = await bcrypt.hash(env.admin.password, 10);
  if (!admin) {
    admin = await AdminUser.create({ email, passwordHash, name: 'Shubra Admin' });
    console.log(`  ✓ admin created: ${email}`);
  } else {
    admin.passwordHash = passwordHash;
    await admin.save();
    console.log(`  ✓ admin password reset: ${email}`);
  }
}

async function run() {
  await connectDB();
  const force = process.env.FORCE === '1';

  console.log('Seeding shubra…');
  await upsertAdmin();

  // Settings singleton
  const settings = await getSettings();
  if (force || !settings.whatsappNumber) {
    settings.whatsappNumber = settings.whatsappNumber || '919812345678';
    await settings.save();
  }
  console.log('  ✓ settings ready');

  if (force) {
    await Promise.all([
      Category.deleteMany({}), Collection.deleteMany({}), Product.deleteMany({}),
      Banner.deleteMany({}), Video.deleteMany({}), Review.deleteMany({}), GalleryItem.deleteMany({}),
    ]);
    console.log('  ⚠ FORCE: cleared content collections');
  }

  // Categories
  let catMap = {};
  if (force || (await Category.countDocuments()) === 0) {
    const docs = await Category.insertMany(
      CATEGORIES.map((c, i) => ({ ...c, slug: slugify(c.name), order: i, isActive: true }))
    );
    catMap = Object.fromEntries(docs.map((d) => [d.name, d._id]));
    console.log(`  ✓ ${docs.length} categories`);
  } else {
    (await Category.find().lean()).forEach((d) => { catMap[d.name] = d._id; });
  }

  // Collections
  let colMap = {};
  if (force || (await Collection.countDocuments()) === 0) {
    const docs = await Collection.insertMany(
      COLLECTIONS.map((c, i) => ({ ...c, slug: slugify(c.name), order: i, isActive: true }))
    );
    colMap = Object.fromEntries(docs.map((d) => [d.name, d._id]));
    console.log(`  ✓ ${docs.length} collections`);
  } else {
    (await Collection.find().lean()).forEach((d) => { colMap[d.name] = d._id; });
  }

  // Products
  if (force || (await Product.countDocuments()) === 0) {
    const docs = PRODUCTS.map((p, i) => ({
      name: p.name,
      hindiName: p.hindiName,
      slug: slugify(p.name),
      sku: `SJ-${String(i + 1).padStart(3, '0')}`,
      story: p.story,
      description: p.story,
      price: p.price,
      mrp: p.mrp || 0,
      isOnSale: (p.mrp || 0) > p.price,
      categoryId: catMap[p.category] || null,
      collectionIds: (p.collections || []).map((n) => colMap[n]).filter(Boolean),
      images: p.images,
      material: p.material || '',
      weight: p.weight || '',
      tags: p.tags || [],
      stockQty: 25,
      inStock: true,
      isNewArrival: !!p.isNew,
      isBestseller: !!p.isBestseller,
      ratingAvg: 4.6 + Math.random() * 0.4,
      ratingCount: 40 + Math.floor(Math.random() * 400),
      order: i,
      isActive: true,
    }));
    await Product.insertMany(docs);
    console.log(`  ✓ ${docs.length} products`);
  }

  // Banners
  if (force || (await Banner.countDocuments()) === 0) {
    await Banner.insertMany([
      { placement: 'topStrip', text: 'Free shipping across Delhi 🚚  •  Korean earrings FREE on orders above ₹1499',
        hindiText: 'दिल्ली में फ्री शिपिंग', order: 0, isActive: true },
      { placement: 'offer', text: 'Korean Earrings FREE', hindiText: 'कोरियन इयररिंग्स मुफ़्त',
        subtext: 'On every order above ₹1499', ctaLabel: 'Shop Now', ctaLink: '/products',
        bgColor: '#7B1E2B', image: IMG.b, order: 1, isActive: true },
      { placement: 'offer', text: 'Delhi? Ships FREE', hindiText: 'दिल्ली में फ्री डिलीवरी',
        subtext: 'Same-week delivery inside Delhi NCR', ctaLabel: 'Explore', ctaLink: '/products',
        bgColor: '#C9A84C', image: IMG.c, order: 2, isActive: true },
    ]);
    console.log('  ✓ banners');
  }

  // Hero video (placeholder — admin replaces with an upload)
  if (force || (await Video.countDocuments()) === 0) {
    await Video.insertMany([
      { title: 'हर झुमका एक कहानी', caption: 'The making of a Shubra jhumka',
        src: 'https://cdn.coverr.co/videos/coverr-golden-jewellery-1573/1080p.mp4',
        poster: IMG.a, isHero: true, order: 0, isActive: true },
    ]);
    console.log('  ✓ hero video');
  }

  // Reviews
  if (force || (await Review.countDocuments()) === 0) {
    await Review.insertMany(REVIEWS.map((r, i) => ({ ...r, isApproved: true, order: i })));
    console.log('  ✓ reviews');
  }

  // Gallery
  if (force || (await GalleryItem.countDocuments()) === 0) {
    await GalleryItem.insertMany([
      { image: IMG.a, customerName: 'Priya', caption: 'Rani Jhumka on her big day', order: 0 },
      { image: IMG.b, customerName: 'Anjali', caption: 'Meenakari magic', order: 1 },
      { image: IMG.c, customerName: 'Sneha', caption: 'Everyday Chandni', order: 2 },
      { image: IMG.d, customerName: 'Ritu', caption: 'Festive glow', order: 3 },
    ]);
    console.log('  ✓ gallery');
  }

  console.log('Done ✔');
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
