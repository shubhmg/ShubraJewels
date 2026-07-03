import express from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import asyncHandler from './asyncHandler.js';
import validate from '../middleware/validate.js';
import requireAdmin from '../middleware/auth.js';
import optionalAuth from '../middleware/optionalAuth.js';
import ApiError from './ApiError.js';

const objectId = Joi.string().hex().length(24);

/**
 * Builds a REST router for a simple content model.
 *
 *   GET    /            public — active items only (admins with ?all=1 get everything)
 *   GET    /:id         public
 *   POST   /            admin
 *   PATCH  /:id         admin
 *   DELETE /:id         admin
 *   PATCH  /reorder     admin — bulk order update [{ id, order }]
 *
 * @param {object}  opts
 * @param {import('mongoose').Model} opts.Model
 * @param {Joi.ObjectSchema} opts.createSchema
 * @param {Joi.ObjectSchema} opts.updateSchema
 * @param {object} [opts.sort]           default { order: 1, createdAt: -1 }
 * @param {function} [opts.beforeSave]   (payload, req) => payload  (create + update)
 */
export default function crudFactory({ Model, createSchema, updateSchema, sort, beforeSave, publicFilter }) {
  const router = express.Router();
  const defaultSort = sort || { order: 1, createdAt: -1 };
  const prep = beforeSave || ((p) => p);
  const pubFilter = publicFilter || { isActive: true };

  router.get(
    '/',
    optionalAuth,
    asyncHandler(async (req, res) => {
      const showAll = req.admin && (req.query.all === '1' || req.query.all === 'true');
      const filter = showAll ? {} : pubFilter;
      const items = await Model.find(filter).sort(defaultSort).lean();
      res.json({ success: true, data: items });
    })
  );

  router.get(
    '/:id',
    validate({ params: Joi.object({ id: objectId.required() }) }),
    asyncHandler(async (req, res) => {
      const item = await Model.findById(req.params.id).lean();
      if (!item) throw ApiError.notFound(`${Model.modelName} not found`);
      res.json({ success: true, data: item });
    })
  );

  router.post(
    '/',
    requireAdmin,
    validate({ body: createSchema }),
    asyncHandler(async (req, res) => {
      const item = await Model.create(await prep(req.body, req));
      res.status(201).json({ success: true, data: item });
    })
  );

  router.patch(
    '/reorder',
    requireAdmin,
    validate({
      body: Joi.object({
        items: Joi.array()
          .items(Joi.object({ id: objectId.required(), order: Joi.number().required() }))
          .required(),
      }),
    }),
    asyncHandler(async (req, res) => {
      await Promise.all(
        req.body.items.map((it) => Model.findByIdAndUpdate(it.id, { order: it.order }))
      );
      res.json({ success: true });
    })
  );

  router.patch(
    '/:id',
    requireAdmin,
    validate({ params: Joi.object({ id: objectId.required() }), body: updateSchema }),
    asyncHandler(async (req, res) => {
      const item = await Model.findByIdAndUpdate(
        req.params.id,
        await prep(req.body, req),
        { new: true, runValidators: true }
      );
      if (!item) throw ApiError.notFound(`${Model.modelName} not found`);
      res.json({ success: true, data: item });
    })
  );

  router.delete(
    '/:id',
    requireAdmin,
    validate({ params: Joi.object({ id: objectId.required() }) }),
    asyncHandler(async (req, res) => {
      const item = await Model.findByIdAndDelete(req.params.id);
      if (!item) throw ApiError.notFound(`${Model.modelName} not found`);
      res.json({ success: true });
    })
  );

  return router;
}
