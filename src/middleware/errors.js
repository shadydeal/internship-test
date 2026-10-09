// Load the application-specific error class recognized by the handlers.
const { HttpError } = require('../errors/HttpError');

/** Forward a consistent 404 error for requests that match no route. */
function notFound(_req, _res, next) {
  // Forward route absence through Express's centralized error pipeline.
  next(new HttpError(404, 'Route not found.'));
}

/** Translate known failures to safe HTTP responses and log unexpected errors. */
function errorHandler(error, _req, res, _next) {
  // Preserve the intended status and safe message for known application errors.
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  // Treat malformed IDs, schema failures, and invalid JSON as client input errors.
  if (error.name === 'ValidationError' || error.name === 'CastError' || error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request is invalid.' });
  }
  // Report unique-email conflicts without exposing database error details.
  if (error.code === 11000) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  // Log unexpected failures for operators while avoiding internal details in responses.
  console.error('Unhandled request error:', error);
  // Return a generic server error for failures that have no safe client message.
  return res.status(500).json({ error: 'An unexpected server error occurred.' });
}

// Export both handlers for the Express app's terminal middleware chain.
module.exports = { errorHandler, notFound };
