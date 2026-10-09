const express = require('express');
const bcrypt = require('bcryptjs');
const { Employee, Manager } = require('../models/person');
const OrganizationNode = require('../models/OrganizationNode');
const { canAccessNode, canManageEntity } = require('../security/access');
const { HttpError } = require('../errors/HttpError');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

function createPeopleRouter({ entityType }) {
  const router = express.Router();
  const Model = entityType === 'manager' ? Manager : Employee;
  const label = entityType === 'manager' ? 'manager' : 'employee';

  async function requireNodeAccess(actor, nodeId, action) {
    if (typeof nodeId !== 'string' || nodeId.length === 0) {
      throw new HttpError(400, 'nodeId is required.');
    }
    const node = await OrganizationNode.findById(nodeId).select('_id ancestors');
    if (!node) throw new HttpError(404, 'Organization node not found.');
    if (!canAccessNode(actor, node, entityType, action)) {
      throw new HttpError(403, 'You are not allowed to access this organization node.');
    }
    return node;
  }

  async function requireRecordAccess(actor, person, action) {
    if (!person) throw new HttpError(404, `${label} not found.`);
    const node = await OrganizationNode.findById(person.nodeId).select('_id ancestors');
    if (!canAccessNode(actor, node, entityType, action)) {
      throw new HttpError(404, `${label} not found.`);
    }
    return person;
  }

  function ensureCanManage(actor) {
    if (!canManageEntity(actor)) throw new HttpError(403, 'Only managers can manage accounts.');
  }

  function validatePersonInput(body, { partial = false } = {}) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new HttpError(400, 'A JSON object is required.');
    }
    const allowed = new Set(['name', 'email', 'password', 'nodeId']);
    if (Object.keys(body).some((key) => !allowed.has(key))) {
      throw new HttpError(400, 'The request contains unsupported fields.');
    }

    const result = {};
    if (!partial || Object.hasOwn(body, 'name')) {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120) {
        throw new HttpError(400, 'Name must contain between 1 and 120 characters.');
      }
      result.name = body.name.trim();
    }
    if (!partial || Object.hasOwn(body, 'email')) {
      if (typeof body.email !== 'string' || !EMAIL_PATTERN.test(body.email.trim())) {
        throw new HttpError(400, 'A valid email address is required.');
      }
      result.email = body.email.trim().toLowerCase();
    }
    if (!partial || Object.hasOwn(body, 'password')) {
      if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD_LENGTH) {
        throw new HttpError(400, `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`);
      }
      result.password = body.password;
    }
    if (!partial || Object.hasOwn(body, 'nodeId')) {
      if (typeof body.nodeId !== 'string' || !body.nodeId.trim()) {
        throw new HttpError(400, 'nodeId is required.');
      }
      result.nodeId = body.nodeId.trim();
    }
    return result;
  }

  router.get('/', async (req, res, next) => {
    try {
      const node = await requireNodeAccess(req.user, req.query.nodeId, 'read');
      const includeDescendants = req.query.includeDescendants === 'true';
      const nodes = includeDescendants
        ? await OrganizationNode.find({ $or: [{ _id: node._id }, { ancestors: node._id }] }).distinct('_id')
        : [node._id];
      const people = await Model.find({ nodeId: { $in: nodes } }).sort({ name: 1 });
      res.json(people);
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      ensureCanManage(req.user);
      const input = validatePersonInput(req.body);
      await requireNodeAccess(req.user, input.nodeId, 'manage');
      const person = await Model.create({
        name: input.name,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
        nodeId: input.nodeId,
      });
      res.status(201).json(person);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const person = await Model.findById(req.params.id);
      await requireRecordAccess(req.user, person, 'read');
      res.json(person);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      ensureCanManage(req.user);
      const person = await Model.findById(req.params.id);
      await requireRecordAccess(req.user, person, 'manage');
      const input = validatePersonInput(req.body, { partial: true });
      if (Object.keys(input).length === 0) throw new HttpError(400, 'At least one supported field is required.');
      if (input.nodeId) await requireNodeAccess(req.user, input.nodeId, 'manage');

      if (input.name !== undefined) person.name = input.name;
      if (input.email !== undefined) person.email = input.email;
      if (input.nodeId !== undefined) person.nodeId = input.nodeId;
      if (input.password !== undefined) person.passwordHash = await bcrypt.hash(input.password, 12);
      await person.save();
      res.json(person);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      ensureCanManage(req.user);
      const person = await Model.findById(req.params.id);
      await requireRecordAccess(req.user, person, 'manage');
      await person.deleteOne();
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createPeopleRouter };
