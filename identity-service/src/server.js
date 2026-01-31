require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('./utils/logger');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');
const routes = require('./routes/identity-service');
const errorHandler = require('./middleware/errorHandler');


const app = express();

const PORT = process.env.PORT || 3001;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => { logger.info('Connected to MongoDB'); })
  .catch((err) => {
    logger.error('Failed to connect to MongoDB', err);
    process.exit(1);
  })

const redisClient = new Redis(process.env.REDIS_URL);

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request for ${req.url}`);
  logger.info(`Request body, ${req.body}`);
  next();
})

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'middleware',
  points: 10,
  duration: 1,
})

app.use((req, res, next) => {
  rateLimiter.consume(req.ip).then(() => {
    next();
  }).catch(() => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      succes: false,
      message: 'Too many requests. Please try again later.',
    })
  })

})

const sensitiveEndpointsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests to sensitive endpoint. Please try again later.',
    });
  },
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  })
})

app.use('/api/auth/register', sensitiveEndpointsLimiter);

app.use('/api/auth', routes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Identity Service running on port ${PORT}`);

})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
})