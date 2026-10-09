const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { getConfig } = require('./config');
const { authenticate } = require('./middleware/authenticate');
const { errorHandler, notFound } = require('./middleware/errors');
const { createPeopleRouter } = require('./routes/people');
const { createAuthRouter } = require('./routes/auth');

function createApp({
  jwtSecret = getConfig().jwtSecret,
  jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h',
} = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(
    '/api/auth',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }),
    createAuthRouter({ jwtSecret, jwtExpiresIn }),
  );

  app.use('/api', authenticate({ jwtSecret }));
  app.use('/api/employees', createPeopleRouter({ entityType: 'employee' }));
  app.use('/api/managers', createPeopleRouter({ entityType: 'manager' }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
