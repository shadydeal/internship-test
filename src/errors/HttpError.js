// Extend Error so route handlers can carry an HTTP response status.
class HttpError extends Error {
  /** Store an HTTP status and safe message on a standard JavaScript error. */
  constructor(status, message) {
    // Preserve standard Error behavior and its message.
    super(message);
    // Set a stable class name for readable logs and instanceof-based handling.
    this.name = 'HttpError';
    // Allow error middleware to choose the intended HTTP response status.
    this.status = status;
  }
}

// Make the typed HTTP error available to middleware and route handlers.
module.exports = { HttpError };
