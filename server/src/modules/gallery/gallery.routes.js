import Joi from 'joi';
import GalleryItem from './gallery.model.js';
import crudFactory from '../../utils/crudFactory.js';

const base = {
  image: Joi.string().max(500),
  caption: Joi.string().allow('').max(200),
  customerName: Joi.string().allow('').max(80),
  order: Joi.number(),
  isActive: Joi.boolean(),
};

export default crudFactory({
  Model: GalleryItem,
  createSchema: Joi.object({ ...base, image: base.image.required() }),
  updateSchema: Joi.object(base).min(1),
});
