import express from 'express';
import Joi from 'joi';
import Visit from './visit.model.js';
import Order from '../order/order.model.js';
import Product from '../product/product.model.js';
import PaymentIntent from '../payment/paymentIntent.model.js';
import { releaseProducts } from '../order/orderStock.js';
import validate from '../../middleware/validate.js';
import requireAdmin from '../../middleware/auth.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = express.Router();

// Group by IST calendar day so "today" and the daily series align to the
// store's local midnight (not UTC, which rolls over at 5:30am IST).
const IST_MS = 5.5 * 60 * 60 * 1000;
const dayStr = (d) => new Date(new Date(d).getTime() + IST_MS).toISOString().slice(0, 10);

// Bots/crawlers/monitors that shouldn't count as real visitors.
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|bingpreview|whatsapp|telegram|preview|monitor|uptime|pingdom|curl|wget|python-requests|axios|node-fetch|headless|lighthouse|phantom|puppeteer/i;

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
    const ua = (req.headers['user-agent'] || '').slice(0, 300);
    // Skip bots/crawlers/monitors so they don't inflate views & visitors.
    if (BOT_RE.test(ua)) return res.json({ success: true, data: { skipped: true } });
    await Visit.create({
      path: req.body.path || '/',
      sessionId: req.body.sessionId || '',
      referrer: req.body.referrer || '',
      device: req.body.device || '',
      ua,
      day: dayStr(Date.now()),
    });
    res.json({ success: true });
  })
);

// ADMIN — GO LIVE: wipe all test data (visits, orders, payment intents) for a
// clean launch. Keeps everything configured (products, settings, content,
// categories, collections, coupons, customers). Restores product stock that
// test orders had reserved so inventory returns to what was configured.
router.post(
  '/go-live',
  requireAdmin,
  validate({ body: Joi.object({ confirm: Joi.string().valid('GO_LIVE').required() }) }),
  asyncHandler(async (_req, res) => {
    // Give back stock held by any live order before deleting.
    const held = await Order.find({ stockApplied: true });
    for (const o of held) await releaseProducts(o.items);

    const [v, o, pi] = await Promise.all([
      Visit.deleteMany({}),
      Order.deleteMany({}),
      PaymentIntent.deleteMany({}),
    ]);
    res.json({ success: true, data: { visits: v.deletedCount, orders: o.deletedCount, intents: pi.deletedCount, stockRestored: held.length } });
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

// ADMIN — sales report. Filters by date range (IST days), order status, and
// payment method. Returns KPI summary, a daily revenue/orders trend (gap-filled
// so the chart is continuous), top products, and payment/status breakdowns.
const REPORT_STATUSES = ['confirmed', 'shipped', 'delivered', 'cancelled'];
const REPORT_PAYMENTS = ['cod', 'razorpay', 'upi', 'cash', 'bank'];
const TZ = 'Asia/Kolkata';

router.get(
  '/sales',
  requireAdmin,
  validate({
    query: Joi.object({
      from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('').default(''),
      to: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('').default(''),
      status: Joi.string().valid(...REPORT_STATUSES, '').default(''),
      paymentMethod: Joi.string().valid(...REPORT_PAYMENTS, '').default(''),
    }),
  }),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const toStr = req.query.to || dayStr(now);
    const fromStr = req.query.from || dayStr(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
    // IST day boundaries → precise UTC instants (+05:30 offset baked into the ISO).
    const start = new Date(`${fromStr}T00:00:00.000+05:30`);
    const end = new Date(`${toStr}T23:59:59.999+05:30`);

    const match = { createdAt: { $gte: start, $lte: end } };
    // "Sales" excludes cancelled orders unless a specific status is requested.
    if (req.query.status) match.status = req.query.status;
    else match.status = { $ne: 'cancelled' };
    if (req.query.paymentMethod) match.paymentMethod = req.query.paymentMethod;

    const [agg = {}] = await Order.aggregate([
      { $match: match },
      {
        $facet: {
          summary: [{ $group: { _id: null, revenue: { $sum: '$total' }, subtotal: { $sum: '$subtotal' }, discount: { $sum: '$discount' }, shipping: { $sum: '$shipping' }, orders: { $sum: 1 } } }],
          units: [{ $unwind: '$items' }, { $group: { _id: null, units: { $sum: '$items.qty' } } }],
          series: [
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          byPayment: [{ $group: { _id: '$paymentMethod', revenue: { $sum: '$total' }, orders: { $sum: 1 } } }, { $sort: { revenue: -1 } }],
          byStatus: [{ $group: { _id: '$status', revenue: { $sum: '$total' }, orders: { $sum: 1 } } }],
          top: [
            { $unwind: '$items' },
            { $group: { _id: '$items.productId', name: { $first: '$items.name' }, image: { $first: '$items.image' }, units: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } } } },
            { $sort: { revenue: -1 } },
            { $limit: 12 },
          ],
        },
      },
    ]);

    const s = agg.summary?.[0] || {};
    const orders = s.orders || 0;
    const revenue = s.revenue || 0;

    // Gap-fill the daily series so the trend line is continuous. Cap at ~13
    // months to keep the payload small for very wide ranges.
    const seriesMap = new Map((agg.series || []).map((d) => [d._id, d]));
    let series = [];
    let capped = false;
    for (let t = new Date(`${fromStr}T12:00:00+05:30`); dayStr(t) <= toStr; t = new Date(t.getTime() + 24 * 60 * 60 * 1000)) {
      if (series.length > 400) { capped = true; break; }
      const key = dayStr(t);
      const found = seriesMap.get(key);
      series.push({ day: key, revenue: found?.revenue || 0, orders: found?.orders || 0 });
    }
    if (capped) series = (agg.series || []).map((d) => ({ day: d._id, revenue: d.revenue, orders: d.orders }));

    res.json({
      success: true,
      data: {
        range: { from: fromStr, to: toStr },
        summary: {
          revenue,
          subtotal: s.subtotal || 0,
          discount: s.discount || 0,
          shipping: s.shipping || 0,
          orders,
          units: agg.units?.[0]?.units || 0,
          avgOrderValue: orders ? Math.round(revenue / orders) : 0,
        },
        series,
        topProducts: (agg.top || []).map((t) => ({ productId: t._id, name: t.name || 'Deleted product', image: t.image || '', units: t.units, revenue: t.revenue })),
        byPayment: (agg.byPayment || []).map((p) => ({ method: p._id || 'none', orders: p.orders, revenue: p.revenue })),
        byStatus: (agg.byStatus || []).map((p) => ({ status: p._id, orders: p.orders, revenue: p.revenue })),
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
      // Leaderboard: only products that still exist (exclude deleted), most-viewed first.
      const viewedIds = [...viewMap.keys()];
      const existing = await Product.find({ _id: { $in: viewedIds } }).select('_id').lean();
      const existingSet = new Set(existing.map((p) => String(p._id).toLowerCase()));
      const sorted = viewedIds
        .filter((id) => existingSet.has(id))
        .map((id) => [id, viewMap.get(id)])
        .sort((a, b) => b[1] - a[1]);
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
