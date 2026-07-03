import ApiError from '../utils/ApiError.js';
import pick from '../utils/pick.js';

/**
 * Validates request against a Joi schema with keys 'body', 'params', 'query'.
 * Strips unknown keys so extra client fields don't error.
 */
export default function validate(schema) {
  return (req, _res, next) => {
    const validSchema = pick(schema, ['body', 'params', 'query']);
    const obj = pick(req, Object.keys(validSchema));

    const errors = [];
    for (const [key, joiSchema] of Object.entries(validSchema)) {
      const { error, value } = joiSchema.validate(obj[key], {
        abortEarly: false,
        stripUnknown: true,
      });
      if (error) errors.push(...error.details.map((d) => d.message));
      else req[key] = value;
    }

    if (errors.length > 0) return next(ApiError.badRequest('Validation failed', errors));
    next();
  };
}
