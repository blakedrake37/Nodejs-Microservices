const Joi = require('joi');

const validateCreatePost = (data) => {
  const schema = Joi.object({
    content: Joi.string().min(1).max(5000).required(),
    mediaIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
  });
  return schema.validate(data);
}


module.exports = { validateCreatePost };