import express from 'express';
import Joi from 'joi';
import Product from './product.model.js';
import Category from '../category/category.model.js';
import Collection from '../collection/collection.model.js';
import validate from '../../middleware/validate.js';
import requireAdmin from '../../middleware/auth.js';
import optionalAuth from '../../middleware/optionalAuth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';
import slugify from '../../utils/slugify.js';

const router = express.Router();
const objectId = Joi.string().hex().length(24);

const base = {
  name: Joi.string().max(160),
  hindiName: Joi.string().allow('').max(160),
  slug: Joi.string().allow('').max(180),
  sku: Joi.string().allow('').max(60),
  story: Joi.string().allow('').max(2000),
  description: Joi.string().allow('').max(2000),
  price: Joi.number().min(0),
  mrp: Joi.number().min(0),
  categoryId: objectId.allow(null, ''),
  collectionIds: Joi.array().items(objectId),
  images: Joi.array().items(Joi.string().max(500)),
  video: Joi.string().allow('').max(500),
  material: Joi.string().allow('').max(120),
  weight: Joi.string().allow('').max(60),
  tags: Joi.array().items(Joi.string().max(40)),
  stockQty: Joi.number(),
  inStock: Joi.boolean(),
  isNewArrival: Joi.boolean(),
  isBestseller: Joi.boolean(),
  isOnSale: Joi.boolean(),
  order: Joi.number(),
  isActive: Joi.boolean(),
};

const createSchema = Joi.object({ ...base, name: base.name.required(), price: base.price.required() });
const updateSchema = Joi.object(base).min(1);

function normalize(payload) {
  if (payload.name && !payload.slug) payload.slug = slugify(payload.name);
  else if (payload.slug) payload.slug = slugify(payload.slug);
  if (payload.categoryId === '') payload.categoryId = null;
  if (payload.stockQty !== undefined) payload.inStock = payload.stockQty > 0;
  if (payload.mrp && payload.price !== undefined) payload.isOnSale = payload.mrp > payload.price;
  return payload;
}

// LIST — public (active only) with filters; admin (?all=1) sees everything.
router.get(
  '/',
  optionalAuth,
  validate({
    query: Joi.object({
      category: Joi.string().allow(''),     // category id or slug
      collection: Joi.string().allow(''),   // collection id or slug
      under599: Joi.any(),
      onSale: Joi.any(),
      search: Joi.string().allow('').max(120),
      all: Joi.any(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { category, collection, under599, onSale, search } = req.query;
    const showAll = req.admin && (req.query.all === '1' || req.query.all === 'true');
    const filter = showAll ? {} : { isActive: true };

    if (category) {
      const cat = objectId.validate(category).error
        ? await Category.findOne({ slug: category }).select('_id').lean()
        : { _id: category };
      if (cat) filter.categoryId = cat._id;
    }
    if (collection) {
      const col = objectId.validate(collection).error
        ? await Collection.findOne({ slug: collection }).select('_id').lean()
        : { _id: collection };
      if (col) filter.collectionIds = col._id;
    }
    if (under599 === '1' || under599 === 'true') filter.price = { $lte: 599 };
    if (onSale === '1' || onSale === 'true') filter.isOnSale = true;
    if (search) filter.$text = { $search: search };

    const products = await Product.find(filter).sort({ order: 1, createdAt: -1 }).lean();
    res.json({ success: true, data: products });
  })
);

// DETAIL — accepts id or slug
router.get(
  '/:idOrSlug',
  asyncHandler(async (req, res) => {
    const { idOrSlug } = req.params;
    const query = objectId.validate(idOrSlug).error ? { slug: idOrSlug } : { _id: idOrSlug };
    const product = await Product.findOne(query).lean();
    if (!product) throw ApiError.notFound('Product not found');
    res.json({ success: true, data: product });
  })
);

router.post(
  '/',
  requireAdmin,
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const product = await Product.create(normalize(req.body));
    res.status(201).json({ success: true, data: product });
  })
);

router.patch(
  '/reorder',
  requireAdmin,
  validate({
    body: Joi.object({
      items: Joi.array().items(Joi.object({ id: objectId.required(), order: Joi.number().required() })).required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    await Promise.all(req.body.items.map((it) => Product.findByIdAndUpdate(it.id, { order: it.order })));
    res.json({ success: true });
  })
);

router.patch(
  '/:id',
  requireAdmin,
  validate({ params: Joi.object({ id: objectId.required() }), body: updateSchema }),
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndUpdate(req.params.id, normalize(req.body), {
      new: true,
      runValidators: true,
    });
    if (!product) throw ApiError.notFound('Product not found');
    res.json({ success: true, data: product });
  })
);

router.delete(
  '/:id',
  requireAdmin,
  validate({ params: Joi.object({ id: objectId.required() }) }),
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');
    res.json({ success: true });
  })
);

export default router;
