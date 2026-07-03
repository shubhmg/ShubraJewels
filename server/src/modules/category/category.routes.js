import Joi from 'joi';
import Category from './category.model.js';
import crudFactory from '../../utils/crudFactory.js';
import slugify from '../../utils/slugify.js';

const base = {
  name: Joi.string().max(80),
  hindiName: Joi.string().allow('').max(80),
  slug: Joi.string().allow('').max(100),
  description: Joi.string().allow('').max(600),
  image: Joi.string().allow('').max(500),
  order: Joi.number(),
  isActive: Joi.boolean(),
};

const createSchema = Joi.object({ ...base, name: base.name.required() });
const updateSchema = Joi.object(base).min(1);

const beforeSave = (payload) => {
  if (payload.name && !payload.slug) payload.slug = slugify(payload.name);
  else if (payload.slug) payload.slug = slugify(payload.slug);
  return payload;
};

export default crudFactory({ Model: Category, createSchema, updateSchema, beforeSave });
