import Joi from 'joi';
import GalleryItem from './gallery.model.js';
import crudFactory from '../../utils/crudFactory.js';

const objectId = Joi.string().hex().length(24);

const base = {
  image: Joi.string().max(500),
  caption: Joi.string().allow('').max(200),
  customerName: Joi.string().allow('').max(80),
  link: Joi.string().allow('').max(500),
  productId: objectId.allow('', null),
  order: Joi.number(),
  isActive: Joi.boolean(),
};

const clean = (payload) => {
  if (!Object.prototype.hasOwnProperty.call(payload, 'productId')) return payload;
  return { ...payload, productId: payload.productId || null };
};

export default crudFactory({
  Model: GalleryItem,
  createSchema: Joi.object({ ...base, image: base.image.required() }),
  updateSchema: Joi.object(base).min(1),
  beforeSave: clean,
});
