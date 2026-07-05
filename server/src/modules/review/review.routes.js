import Joi from 'joi';
import Review from './review.model.js';
import crudFactory from '../../utils/crudFactory.js';

const objectId = Joi.string().hex().length(24);

const base = {
  name: Joi.string().max(80),
  location: Joi.string().allow('').max(80),
  rating: Joi.number().min(1).max(5),
  text: Joi.string().allow('').max(1000),
  image: Joi.string().allow('').max(500),
  productId: objectId.allow(null, ''),
  verifiedPurchase: Joi.boolean(),
  isApproved: Joi.boolean(),
  isFeatured: Joi.boolean(),
  order: Joi.number(),
};

export default crudFactory({
  Model: Review,
  createSchema: Joi.object({ ...base, name: base.name.required() }),
  updateSchema: Joi.object(base).min(1),
  // Homepage testimonial wall = admin-curated reviews only. Customer
  // post-purchase reviews (customerId set) feed product ratings, not this list.
  publicFilter: { isApproved: true, customerId: null },
  sort: { isFeatured: -1, order: 1, createdAt: -1 },
});
