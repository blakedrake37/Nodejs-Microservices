require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const logger = require('./utils/logger');
const proxy = require('express-http-proxy');
const { error } = require('winston');
const errorHandler = require('./middleware/errorHandler');
const { validateToken } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

const redis = new Redis(process.env.REDIS_URL);

app.use(helmet());
app.use(cors());
app.use(express.json());

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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
    sendCommand: (...args) => redis.call(...args),
  })
})

app.use(rateLimiter);

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request for ${req.url}`);
  logger.info(`Request body, ${req.body}`);
  next();
})

const proxyOptions = {
  proxyReqPathResolver: (req) => {
    return req.originalUrl.replace(/^\/v1/, "/api");
  },
  proxyErrorHandler: (err, res, next) => {
    logger.error(`Proxy error: ${err.message}`);
    res.status(500).json({
      message: 'Internal server error in API Gateway.',
      error: err.message,
    });
  }
}

app.use('/v1/auth', proxy(process.env.IDENTITY_SERVICE_URL, {
  ...proxyOptions,
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers['Content-Type'] = 'application/json';
    return proxyReqOpts;
  },
  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    logger.info(`Response from Identity Service for ${userReq.originalUrl}: ${proxyRes.statusCode}`);
    return proxyResData;
  }

}));

app.use('/v1/posts', validateToken, proxy(process.env.POST_SERVICE_URL, {
  ...proxyOptions,
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers['Content-Type'] = 'application/json';
    proxyReqOpts.headers['x-user-id'] = srcReq.user.userId;
    return proxyReqOpts;
  },
  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    logger.info(`Response from Post Service for ${userReq.originalUrl}: ${proxyRes.statusCode}`);
    return proxyResData;
  }
}))

app.use('/v1/media', validateToken, proxy(process.env.MEDIA_SERVICE_URL, {
  ...proxyOptions,
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers['x-user-id'] = srcReq.user.userId;
    if (!srcReq.headers['content-type'].startsWith('multipart/form-data')) {
      proxyReqOpts.headers['Content-Type'] = 'application/json';
    }
    return proxyReqOpts;
  },
  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    logger.info(`Response from Media Service for ${userReq.originalUrl}: ${proxyRes.statusCode}`);
    return proxyResData;
  }
}))

app.use('/v1/search', validateToken, proxy(process.env.SEARCH_SERVICE_URL, {
  ...proxyOptions,
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers['Content-Type'] = 'application/json';
    proxyReqOpts.headers['x-user-id'] = srcReq.user.userId;
    return proxyReqOpts;
  },
  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    logger.info(`Response from Search Service for ${userReq.originalUrl}: ${proxyRes.statusCode}`);
    return proxyResData;
  }
}))

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Identity Service running on port ${process.env.IDENTITY_SERVICE_URL}`);
  logger.info(`Post Service running on port ${process.env.POST_SERVICE_URL}`);
  logger.info(`Media Service running on port ${process.env.MEDIA_SERVICE_URL}`);
  logger.info(`Search Service running on port ${process.env.SEARCH_SERVICE_URL}`);
  logger.info(`Redis URL running on ${process.env.REDIS_URL}`);
})



