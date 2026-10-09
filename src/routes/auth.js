const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Employee, Manager } = require('../models/person');
const { HttpError } = require('../errors/HttpError');

function createAuthRouter({ jwtSecret, jwtExpiresIn }) {
  const router = express.Router();

  router.post('/login', async (req, res, next) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = req.body?.password;
      if (!email || typeof password !== 'string' || password.length === 0) {
        throw new HttpError(400, 'Email and password are required.');
      }

      let person;
      let role;
      for (const [Model, modelRole] of [
        [Manager, 'manager'],
        [Employee, 'employee'],
      ]) {
        person = await Model.findOne({ email }).select('+passwordHash');
        if (person) {
          role = modelRole;
          break;
        }
      }
      if (!person || !(await bcrypt.compare(password, person.passwordHash))) {
        throw new HttpError(401, 'Email or password is incorrect.');
      }

      const token = jwt.sign({ role }, jwtSecret, {
        subject: String(person._id),
        expiresIn: jwtExpiresIn,
      });
      res.json({
        token,
        user: { id: String(person._id), name: person.name, email: person.email, nodeId: person.nodeId, role },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createAuthRouter };
