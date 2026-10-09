// Load JWT verification and signing support.
const jwt = require('jsonwebtoken');
// Load the account models used to resolve token roles.
const { Employee, Manager } = require('../models/person');
// Load the error type used for expected authentication failures.
const { HttpError } = require('../errors/HttpError');

/** Create middleware that verifies a JWT and reloads its active account from MongoDB. */
function authenticate({ jwtSecret }) {
  /** Attach the authenticated account to the request or forward an HTTP error. */
  return async (req, _res, next) => {
    try {
      // Read the bearer credentials from the standard Authorization header.
      const authorization = req.get('authorization') || '';
      // Accept exactly a bearer scheme followed by one non-empty token.
      const match = /^Bearer\s+(\S+)$/i.exec(authorization);
      // Reject absent or malformed authorization headers before token verification.
      if (!match) {
        throw new HttpError(401, 'A bearer token is required.');
      }
      // Extract the token captured by the bearer-header expression.
      const [, token] = match;

      // Verify signature and expiry before trusting any token claim.
      const claims = jwt.verify(token, jwtSecret);
      // Select the account model based on the role embedded in the signed token.
      const Model = claims.role === 'manager' ? Manager : claims.role === 'employee' ? Employee : null;
      // Reject unknown roles and tokens without a subject account ID.
      if (!Model || typeof claims.sub !== 'string') {
        throw new HttpError(401, 'The authentication token is invalid.');
      }

      // Reload the account so deleted users cannot continue using old tokens.
      const person = await Model.findById(claims.sub).select('_id nodeId');
      // Reject validly signed tokens whose account no longer exists.
      if (!person) {
        throw new HttpError(401, 'The account associated with this token no longer exists.');
      }

      // Attach only the identity and authorization data required by route handlers.
      req.user = { id: String(person._id), nodeId: person.nodeId, role: claims.role };
      // Continue to the requested route after successful authentication.
      next();
    } catch (error) {
      // Preserve already-classified authentication and authorization errors.
      if (error instanceof HttpError) return next(error);
      // Convert malformed and expired JWT exceptions to a safe 401 response.
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return next(new HttpError(401, 'The authentication token is invalid or expired.'));
      }
      // Forward database and other unexpected failures to shared error handling.
      next(error);
    }
  };
}

module.exports = { authenticate };
