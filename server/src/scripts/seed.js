/**
 * Seeds the `shubra` database with starter content so the storefront isn't empty.
 * Content logic lives in modules/admin/seed.service.js (shared with the admin API).
 *
 *   npm run seed                 # safe: fills only empty collections + upserts admin
 *   FORCE=1 npm run seed         # wipes & reseeds content (keeps orders/visits)
 *   SKIP_ADMIN=1 npm run seed    # content only, don't reset the admin password
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import { connectDB } from '../config/db.js';
import AdminUser from '../modules/auth/adminUser.model.js';
import { seedContent } from '../modules/admin/seed.service.js';

async function upsertAdmin() {
  const email = env.admin.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(env.admin.password, 10);
  const admin = await AdminUser.findOne({ email });
  if (!admin) {
    await AdminUser.create({ email, passwordHash, name: 'Shubra Admin' });
    console.log(`  ✓ admin created: ${email}`);
  } else {
    admin.passwordHash = passwordHash;
    await admin.save();
    console.log(`  ✓ admin password reset: ${email}`);
  }
}

async function run() {
  await connectDB();
  console.log('Seeding shubra…');

  if (process.env.SKIP_ADMIN === '1') console.log('  · skipping admin (SKIP_ADMIN=1)');
  else await upsertAdmin();

  const summary = await seedContent({ force: process.env.FORCE === '1' });
  const parts = Object.entries(summary).map(([k, v]) => `${v} ${k}`);
  console.log(parts.length ? `  ✓ seeded: ${parts.join(', ')}` : '  · nothing to add (already populated)');

  console.log('Done ✔');
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
