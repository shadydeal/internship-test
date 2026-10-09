const jwt = require('jsonwebtoken');
const { Employee, Manager } = require('../models/person');
const { HttpError } = require('../errors/HttpError');

/** Create middleware that verifies a JWT and reloads its active account from MongoDB. */
function authenticate({ jwtSecret }) {
  /** Attach the authenticated account to the request or forward an HTTP error. */
  return async (req, _res, next) => {
    try {
      const authorization = req.get('authorization') || '';
      const match = /^Bearer\s+(\S+)$/i.exec(authorization);
      if (!match) {
        throw new HttpError(401, 'A bearer token is required.');
      }
      const [, token] = match;

      const claims = jwt.verify(token, jwtSecret);
      const Model = claims.role === 'manager' ? Manager : claims.role === 'employee' ? Employee : null;
      if (!Model || typeof claims.sub !== 'string') {
        throw new HttpError(401, 'The authentication token is invalid.');
      }

      const person = await Model.findById(claims.sub).select('_id nodeId');
      if (!person) {
        throw new HttpError(401, 'The account associated with this token no longer exists.');
      }

      req.user = { id: String(person._id), nodeId: person.nodeId, role: claims.role };
      next();
    } catch (error) {
      if (error instanceof HttpError) return next(error);
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return next(new HttpError(401, 'The authentication token is invalid or expired.'));
      }
      next(error);
    }
  };
}

module.exports = { authenticate };
