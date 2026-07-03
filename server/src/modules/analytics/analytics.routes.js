import express from 'express';
import Joi from 'joi';
import Visit from './visit.model.js';
import Order from '../order/order.model.js';
import validate from '../../middleware/validate.js';
import requireAdmin from '../../middleware/auth.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = express.Router();

const dayStr = (d) => new Date(d).toISOString().slice(0, 10);

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
        topPages,
        deviceSplit: deviceSplit.map((d) => ({ device: d._id || 'unknown', count: d.count })),
        orders: orderStats[0]?.orders || 0,
        revenue: orderStats[0]?.revenue || 0,
      },
    });
  })
);

export default router;
