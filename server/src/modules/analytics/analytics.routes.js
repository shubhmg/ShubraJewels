import express from 'express';
import Joi from 'joi';
import Visit from './visit.model.js';
import Order from '../order/order.model.js';
import Product from '../product/product.model.js';
import validate from '../../middleware/validate.js';
import requireAdmin from '../../middleware/auth.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = express.Router();

const dayStr = (d) => new Date(d).toISOString().slice(0, 10);

const PAGE_LABELS = {
  '/': 'Home',
  '/products': 'All Jhumkas',
  '/collections': 'Collections',
  '/checkout': 'Checkout',
  '/about': 'Our Story',
  '/contact': 'Contact',
  '/wishlist': 'Wishlist',
  '/cart': 'Cart',
  '/account': 'Account',
};

// Turn raw paths into human labels — product detail pages become product names.
async function labelPages(pages) {
  const ids = pages
    .map((p) => (p.path.match(/^\/products\/([a-f0-9]{24})$/i) || [])[1])
    .filter(Boolean);
  const products = ids.length
    ? await Product.find({ _id: { $in: ids } }).select('name').lean()
    : [];
  const nameById = new Map(products.map((p) => [String(p._id), p.name]));
  return pages.map((p) => {
    const m = p.path.match(/^\/products\/([a-f0-9]{24})$/i);
    const label = m ? (nameById.get(m[1]) || 'Product (deleted)') : (PAGE_LABELS[p.path] || p.path);
    return { ...p, label };
  });
}

// PUBLIC — record a page view (fire-and-forget beacon from the storefront).
router.post(
  '/track',
  validate({
    body: Joi.object({
      path: Joi.string().allow('').max(300).default('/'),
      sessionId: Joi.string().allow('').max(80).default(''),
      referrer: Joi.string().allow('').max(500).default(''),
      device: Joi.string().allow('').max(20).default(''),
    }),
  }),
  asyncHandler(async (req, res) => {
    await Visit.create({
      path: req.body.path || '/',
      sessionId: req.body.sessionId || '',
      referrer: req.body.referrer || '',
      device: req.body.device || '',
      ua: (req.headers['user-agent'] || '').slice(0, 300),
      day: dayStr(Date.now()),
    });
    res.json({ success: true });
  })
);

// ADMIN — dashboard summary
router.get(
  '/summary',
  requireAdmin,
  validate({ query: Joi.object({ days: Joi.number().min(1).max(365).default(30) }) }),
  asyncHandler(async (req, res) => {
    const days = req.query.days || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalViews, uniqueSessions, todayViews, series, topPages, deviceSplit, orderStats] =
      await Promise.all([
        Visit.countDocuments({ createdAt: { $gte: since } }),
        Visit.distinct('sessionId', { createdAt: { $gte: since }, sessionId: { $ne: '' } }).then(
          (a) => a.length
        ),
        Visit.countDocuments({ day: dayStr(Date.now()) }),
        Visit.aggregate([
          { $match: { createdAt: { $gte: since } } },
          {
            $group: {
              _id: '$day',
              views: { $sum: 1 },
              sessions: { $addToSet: '$sessionId' },
            },
          },
          { $project: { day: '$_id', _id: 0, views: 1, visitors: { $size: '$sessions' } } },
          { $sort: { day: 1 } },
        ]),
        Visit.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: '$path', views: { $sum: 1 } } },
          { $sort: { views: -1 } },
          { $limit: 8 },
          { $project: { path: '$_id', _id: 0, views: 1 } },
        ]),
        Visit.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: '$device', count: { $sum: 1 } } },
        ]),
        Order.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
        ]),
      ]);

    res.json({
      success: true,
      data: {
        days,
        totalViews,
        uniqueSessions,
        todayViews,
        series,
        topPages: await labelPages(topPages),
        deviceSplit: deviceSplit.map((d) => ({ device: d._id || 'unknown', count: d.count })),
        orders: orderStats[0]?.orders || 0,
        revenue: orderStats[0]?.revenue || 0,
      },
    });
  })
);

// ADMIN — per-product view stats (separate from page-view totals). Server-side
// search + pagination so it scales to a large catalog.
router.get(
  '/product-views',
  requireAdmin,
  validate({
    query: Joi.object({
      days: Joi.number().min(1).max(365).default(30),
      page: Joi.number().min(1).default(1),
      limit: Joi.number().min(1).max(100).default(20),
      search: Joi.string().allow('').max(120).default(''),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { days, page, limit, search } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // View counts per product-detail page in the window.
    const agg = await Visit.aggregate([
      { $match: { createdAt: { $gte: since }, path: { $regex: /^\/products\/[a-f0-9]{24}$/i } } },
      { $group: { _id: '$path', views: { $sum: 1 } } },
    ]);
    const viewMap = new Map();
    for (const r of agg) viewMap.set(r._id.split('/').pop().toLowerCase(), r.views);

    const shape = (p, id, views) => ({
      id,
      name: p?.name || 'Product (deleted)',
      image: p?.images?.[0] || '',
      price: p?.price || 0,
      views,
    });

    let items;
    let total;

    if (search) {
      // Product-centric: search by name, attach views (incl. 0), sort by views.
      const matched = await Product.find({ name: { $regex: search, $options: 'i' } })
        .select('name images price')
        .lean();
      const list = matched
        .map((p) => shape(p, String(p._id), viewMap.get(String(p._id).toLowerCase()) || 0))
        .sort((a, b) => b.views - a.views);
      total = list.length;
      items = list.slice((page - 1) * limit, page * limit);
    } else {
      // Leaderboard: only products with views, most-viewed first.
      const sorted = [...viewMap.entries()].sort((a, b) => b[1] - a[1]);
      total = sorted.length;
      const slice = sorted.slice((page - 1) * limit, page * limit);
      const ids = slice.map(([id]) => id);
      const products = await Product.find({ _id: { $in: ids } }).select('name images price').lean();
      const byId = new Map(products.map((p) => [String(p._id).toLowerCase(), p]));
      items = slice.map(([id, views]) => shape(byId.get(id), id, views));
    }

    res.json({ success: true, data: { items, total, page, limit, days } });
  })
);

export default router;
