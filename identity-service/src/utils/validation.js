const Joi = require('joi');

const validateRegistration = (data) => {
  const schema = Joi.object({
    username: Joi.string().min(3).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    firstName: Joi.string().min(1).max(50).required(),
    lastName: Joi.string().min(1).max(50).required(),
  });
  return schema.validate(data);
}

const validateLogin = (data) => {
  const schema = Joi.object({
    identifier: Joi.string().min(3).max(100).required(),
    password: Joi.string().min(6).required(),
  });
  return schema.validate(data);
}

module.exports = { validateRegistration, validateLogin };