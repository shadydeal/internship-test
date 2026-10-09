const { HttpError } = require('../errors/HttpError');

/** Forward a consistent 404 error for requests that match no route. */
function notFound(_req, _res, next) {
  next(new HttpError(404, 'Route not found.'));
}

/** Translate known failures to safe HTTP responses and log unexpected errors. */
function errorHandler(error, _req, res, _next) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError' || error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request is invalid.' });
  }
  if (error.code === 11000) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  console.error('Unhandled request error:', error);
  return res.status(500).json({ error: 'An unexpected server error occurred.' });
}

module.exports = { errorHandler, notFound };
