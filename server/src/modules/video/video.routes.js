import Joi from 'joi';
import Video from './video.model.js';
import crudFactory from '../../utils/crudFactory.js';

const base = {
  title: Joi.string().allow('').max(160),
  caption: Joi.string().allow('').max(300),
  src: Joi.string().allow('').max(500),
  poster: Joi.string().allow('').max(500),
  isHero: Joi.boolean(),
  order: Joi.number(),
  isActive: Joi.boolean(),
};

export default crudFactory({
  Model: Video,
  createSchema: Joi.object(base),
  updateSchema: Joi.object(base).min(1),
});
