// Load Express to define the login endpoint.
const express = require('express');
// Load JWT utilities to issue signed bearer tokens.
const jwt = require('jsonwebtoken');
// Load bcrypt to compare submitted passwords with stored hashes.
const bcrypt = require('bcryptjs');
// Load both roles because either role may authenticate.
const { Employee, Manager } = require('../models/person');
// Load a safe HTTP error for invalid login requests.
const { HttpError } = require('../errors/HttpError');

/** Create the public authentication router and its credential login endpoint. */
function createAuthRouter({ jwtSecret, jwtExpiresIn }) {
  // Create an isolated router to mount under the public auth path.
  const router = express.Router();

  /** Verify credentials and return a signed token plus non-sensitive account data. */
  router.post('/login', async (req, res, next) => {
    try {
      // Normalize email addresses to match the model's lowercase storage format.
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      // Preserve the submitted password exactly for bcrypt comparison.
      const password = req.body?.password;
      // Reject missing credentials before querying account collections.
      if (!email || typeof password !== 'string' || password.length === 0) {
        throw new HttpError(400, 'Email and password are required.');
      }

      // Hold the first matching role account and its trusted discriminator role.
      let person;
      let role;
      // Look for the email in each role model, selecting its hidden hash for verification.
      for (const [Model, modelRole] of [
        [Manager, 'manager'],
        [Employee, 'employee'],
      ]) {
        // Retrieve the candidate account and explicitly include its password hash.
        person = await Model.findOne({ email }).select('+passwordHash');
        // Stop after the first matching account and record the role used for the token.
        if (person) {
          role = modelRole;
          break;
        }
      }
      // Use one generic response for unknown emails and incorrect passwords.
      if (!person || !(await bcrypt.compare(password, person.passwordHash))) {
        throw new HttpError(401, 'Email or password is incorrect.');
      }

      // Sign the account role and ID with the configured key and token lifetime.
      const token = jwt.sign({ role }, jwtSecret, {
        subject: String(person._id),
        expiresIn: jwtExpiresIn,
      });
      // Return the token alongside profile fields that are safe for clients.
      res.json({
        token,
        user: { id: String(person._id), name: person.name, email: person.email, nodeId: person.nodeId, role },
      });
    } catch (error) {
      // Pass authentication, database, and unexpected errors to shared middleware.
      next(error);
    }
  });

  // Return the configured public login router.
  return router;
}

// Export the router factory so the app controls where it is mounted.
module.exports = { createAuthRouter };
