// Load Express to compose the HTTP application and its routers.
const express = require('express');
// Load standard security headers for every API response.
const helmet = require('helmet');
// Load request-rate limiting to slow repeated login attempts.
const { rateLimit } = require('express-rate-limit');
// Load validated configuration for production app construction.
const { getConfig } = require('./config');
// Load bearer-token middleware for protected API requests.
const { authenticate } = require('./middleware/authenticate');
// Load the shared not-found and error-response handlers.
const { errorHandler, notFound } = require('./middleware/errors');
// Load account CRUD and node-listing route factories.
const { createPeopleRouter } = require('./routes/people');
// Load the public login route factory.
const { createAuthRouter } = require('./routes/auth');

/** Build the Express application, mounting public, authenticated, and error routes. */
function createApp({
  jwtSecret = getConfig().jwtSecret, // Allow tests to inject a secret; otherwise require validated configuration.
  jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h', // Use the configured token lifetime or a one-hour default.
} = {}) {
  // Create a fresh application so callers can configure its listener separately.
  const app = express();

  // Hide Express's identifying response header.
  app.disable('x-powered-by');
  // Apply baseline HTTP security headers.
  app.use(helmet());
  // Parse JSON request bodies and cap their size to limit oversized payloads.
  app.use(express.json({ limit: '32kb' }));

  // Expose a lightweight liveness check without requiring a token.
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  // Apply a login-specific request limit before mounting the public auth router.
  app.use(
    '/api/auth',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }),
    createAuthRouter({ jwtSecret, jwtExpiresIn }),
  );

  // Require a valid bearer token for every account API route.
  app.use('/api', authenticate({ jwtSecret }));
  // Expose employee account operations under their dedicated resource path.
  app.use('/api/employees', createPeopleRouter({ entityType: 'employee' }));
  // Expose manager account operations under their dedicated resource path.
  app.use('/api/managers', createPeopleRouter({ entityType: 'manager' }));

  // Convert unmatched paths to the shared 404 response.
  app.use(notFound);
  // Convert thrown and forwarded errors to safe JSON responses.
  app.use(errorHandler);
  // Return the configured app for the server or an integration test.
  return app;
}

// Export the factory without starting a network listener on import.
module.exports = { createApp };
