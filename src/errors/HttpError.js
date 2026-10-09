class HttpError extends Error {
  /** Create an HTTP-aware error with the response status and client message. */
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

module.exports = { HttpError };
