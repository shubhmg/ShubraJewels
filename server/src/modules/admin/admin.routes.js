import express from 'express';
import requireAdmin from '../../middleware/auth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { seedContent, clearContent } from './seed.service.js';
import { sendOrderConfirmation } from '../../utils/mailer.js';

const router = express.Router();

// Fill empty collections with sample content (safe). ?force=1 wipes + reseeds.
router.post(
  '/seed',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const force = req.query.force === '1' || req.body?.force === true;
    const summary = await seedContent({ force });
    res.json({ success: true, data: { seeded: summary } });
  })
);

// Delete ALL content (products, categories, collections, banners, videos,
// reviews, gallery). Keeps orders, settings, and your admin login.
router.post(
  '/clear',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const removed = await clearContent();
    res.json({ success: true, data: { cleared: removed } });
  })
);

// Send a test order-confirmation email to verify SMTP config.
router.post(
  '/test-email',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const to = req.body?.to;
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ success: false, error: 'Provide a valid "to" email address.' });
    }
    const mockOrder = {
      orderNo: 'SJ-TEST-00001',
      customer: { name: 'Test Customer', phone: '9999999999', email: to },
      address: { line1: '123 Test Lane', city: 'Jaipur', state: 'Rajasthan', pincode: '302001' },
      items: [
        { name: 'Golden Jhumka', image: '', price: 599, qty: 2 },
        { name: 'Pearl Drop Earring', image: '', price: 899, qty: 1 },
      ],
      subtotal: 2097,
      shipping: 0,
      codFee: 0,
      discount: 0,
      couponCode: '',
      total: 2097,
      paymentMethod: 'cod',
      notes: '',
    };
    const result = await sendOrderConfirmation(mockOrder, {});
    res.json({ success: result.ok, data: result });
  })
);

export default router;
