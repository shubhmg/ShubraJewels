import Joi from 'joi';
import Collection from './collection.model.js';
import crudFactory from '../../utils/crudFactory.js';
import slugify from '../../utils/slugify.js';

const base = {
  name: Joi.string().max(80),
  hindiName: Joi.string().allow('').max(80),
  slug: Joi.string().allow('').max(100),
  tagline: Joi.string().allow('').max(200),
  description: Joi.string().allow('').max(1000),
  image: Joi.string().allow('').max(500),
  accentColor: Joi.string().allow('').max(30),
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

export default crudFactory({ Model: Collection, createSchema, updateSchema, beforeSave });
