import Joi from 'joi';
import Banner from './banner.model.js';
import crudFactory from '../../utils/crudFactory.js';

const base = {
  placement: Joi.string().valid('topStrip', 'hero', 'offer'),
  text: Joi.string().allow('').max(200),
  hindiText: Joi.string().allow('').max(200),
  subtext: Joi.string().allow('').max(300),
  image: Joi.string().allow('').max(500),
  bgColor: Joi.string().allow('').max(30),
  ctaLabel: Joi.string().allow('').max(60),
  ctaLink: Joi.string().allow('').max(500),
  order: Joi.number(),
  isActive: Joi.boolean(),
};

export default crudFactory({
  Model: Banner,
  createSchema: Joi.object(base),
  updateSchema: Joi.object(base).min(1),
});
