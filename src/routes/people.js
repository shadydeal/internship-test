// Load Express to create CRUD and listing routes.
const express = require('express');
// Load bcrypt for hashing newly supplied and updated passwords.
const bcrypt = require('bcryptjs');
// Load role-specific models for account queries and writes.
const { Employee, Manager } = require('../models/person');
// Load the hierarchy model for node validation and descendant lookup.
const OrganizationNode = require('../models/OrganizationNode');
// Load shared role and node authorization predicates.
const { canAccessNode, canManageEntity } = require('../security/access');
// Load the safe HTTP error type used for request failures.
const { HttpError } = require('../errors/HttpError');

// Validate basic email syntax before persisting account addresses.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Require passwords to meet the API's minimum length.
const MIN_PASSWORD_LENGTH = 10;

/** Build CRUD and node-scoped listing routes for one account type. */
function createPeopleRouter({ entityType }) {
  // Create a router for one entity type so route handlers share its model.
  const router = express.Router();
  // Select which discriminator handles this router's database operations.
  const Model = entityType === 'manager' ? Manager : Employee;
  // Choose the entity label used in safe not-found messages.
  const label = entityType === 'manager' ? 'manager' : 'employee';

  /** Load a requested node and enforce the caller's role and subtree access. */
  async function requireNodeAccess(actor, nodeId, action) {
    // Reject omitted or malformed node identifiers before issuing a database query.
    if (typeof nodeId !== 'string' || nodeId.length === 0) {
      throw new HttpError(400, 'nodeId is required.');
    }
    // Load only the node fields needed for subtree authorization.
    const node = await OrganizationNode.findById(nodeId).select('_id ancestors');
    // Distinguish a nonexistent node from an existing but unauthorized node.
    if (!node) throw new HttpError(404, 'Organization node not found.');
    // Enforce both this router's entity rules and the requested read/manage action.
    if (!canAccessNode(actor, node, entityType, action)) {
      throw new HttpError(403, 'You are not allowed to access this organization node.');
    }
    // Return the authorized node so the caller can build its query.
    return node;
  }

  /** Load an account's node and conceal records outside the caller's allowed scope. */
  async function requireRecordAccess(actor, person, action) {
    // Hide missing account IDs behind the same not-found response as inaccessible records.
    if (!person) throw new HttpError(404, `${label} not found.`);
    // Resolve the account's organization node for the caller's subtree check.
    const node = await OrganizationNode.findById(person.nodeId).select('_id ancestors');
    // Conceal records whose node is missing or falls outside the caller's scope.
    if (!canAccessNode(actor, node, entityType, action)) {
      throw new HttpError(404, `${label} not found.`);
    }
    // Return the record only after authorization succeeds.
    return person;
  }

  /** Reject account mutations by anyone who is not a manager. */
  function ensureCanManage(actor) {
    // Reject non-manager actors before any account mutation.
    if (!canManageEntity(actor)) throw new HttpError(403, 'Only managers can manage accounts.');
  }

  /** Validate and normalize writable account fields for creation or partial updates. */
  function validatePersonInput(body, { partial = false } = {}) {
    // Require a parsed object and disallow arrays or absent bodies.
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new HttpError(400, 'A JSON object is required.');
    }
    // Whitelist fields so callers cannot set internal model properties.
    const allowed = new Set(['name', 'email', 'password', 'nodeId']);
    // Reject unknown keys instead of silently accepting unsupported data.
    if (
      Object.keys(body).some(
        // Reject extra fields rather than silently accepting or persisting them.
        (key) => !allowed.has(key),
      )
    ) {
      throw new HttpError(400, 'The request contains unsupported fields.');
    }

    // Build a normalized object containing only validated fields.
    const result = {};
    // Require a name during creation and validate it whenever updates provide it.
    if (!partial || Object.hasOwn(body, 'name')) {
      // Reject non-string, blank, or excessively long names.
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120) {
        throw new HttpError(400, 'Name must contain between 1 and 120 characters.');
      }
      // Trim surrounding whitespace before storing the name.
      result.name = body.name.trim();
    }
    // Require email during creation and validate it whenever updates provide it.
    if (!partial || Object.hasOwn(body, 'email')) {
      // Reject non-string values and addresses that fail basic email syntax checks.
      if (typeof body.email !== 'string' || !EMAIL_PATTERN.test(body.email.trim())) {
        throw new HttpError(400, 'A valid email address is required.');
      }
      // Store email in lowercase so lookup and uniqueness behavior is consistent.
      result.email = body.email.trim().toLowerCase();
    }
    // Require password during creation and validate each replacement password.
    if (!partial || Object.hasOwn(body, 'password')) {
      // Enforce a string password of the configured minimum length.
      if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD_LENGTH) {
        throw new HttpError(400, `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`);
      }
      // Keep the plaintext transiently for the caller to hash before persistence.
      result.password = body.password;
    }
    // Require node membership during creation and validate supplied node changes.
    if (!partial || Object.hasOwn(body, 'nodeId')) {
      // Reject missing, non-string, and whitespace-only node IDs.
      if (typeof body.nodeId !== 'string' || !body.nodeId.trim()) {
        throw new HttpError(400, 'nodeId is required.');
      }
      // Trim the node key before checking and storing it.
      result.nodeId = body.nodeId.trim();
    }
    // Return only the validated fields for subsequent authorization and persistence.
    return result;
  }

  /** List accounts at an accessible node, optionally including every descendant. */
  router.get('/', async (req, res, next) => {
    try {
      // Validate that the requested root node is readable by this caller.
      const node = await requireNodeAccess(req.user, req.query.nodeId, 'read');
      // Include descendants only when the caller explicitly requests them.
      const includeDescendants = req.query.includeDescendants === 'true';
      // Query the root alone or collect its own ID plus every descendant ID.
      const nodes = includeDescendants
        ? await OrganizationNode.find({ $or: [{ _id: node._id }, { ancestors: node._id }] }).distinct('_id')
        : [node._id];
      // Retrieve matching accounts in stable alphabetical order.
      const people = await Model.find({ nodeId: { $in: nodes } }).sort({ name: 1 });
      // Serialize the matching account list as JSON.
      res.json(people);
    } catch (error) {
      // Forward database and authorization failures to shared error middleware.
      next(error);
    }
  });

  /** Create an account after validating the payload and target-node permissions. */
  router.post('/', async (req, res, next) => {
    try {
      // Prevent employees from creating either type of account.
      ensureCanManage(req.user);
      // Validate and normalize all required creation fields.
      const input = validatePersonInput(req.body);
      // Ensure the new account belongs to a node this manager can administer.
      await requireNodeAccess(req.user, input.nodeId, 'manage');
      // Hash the password and persist only its derived credential.
      const person = await Model.create({
        name: input.name,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
        nodeId: input.nodeId,
      });
      // Return the safe account representation with the standard created status.
      res.status(201).json(person);
    } catch (error) {
      // Forward duplicate-email, validation, and other failures to error handling.
      next(error);
    }
  });

  /** Return one account only when it is visible to the authenticated caller. */
  router.get('/:id', async (req, res, next) => {
    try {
      // Find the requested account in the current entity-type collection.
      const person = await Model.findById(req.params.id);
      // Enforce account-type permissions and the account's subtree visibility.
      await requireRecordAccess(req.user, person, 'read');
      // Return the authorized account without its hidden password hash.
      res.json(person);
    } catch (error) {
      // Convert lookup and authorization failures through centralized handling.
      next(error);
    }
  });

  /** Update an in-scope account, hashing replacement passwords before saving. */
  router.patch('/:id', async (req, res, next) => {
    try {
      // Restrict all updates to managers.
      ensureCanManage(req.user);
      // Load the record and check its current node before permitting a move or edit.
      const person = await Model.findById(req.params.id);
      await requireRecordAccess(req.user, person, 'manage');
      // Validate only the supplied fields because PATCH is a partial update.
      const input = validatePersonInput(req.body, { partial: true });
      // Do not accept empty PATCH objects.
      if (Object.keys(input).length === 0) throw new HttpError(400, 'At least one supported field is required.');
      // Check authorization for a new node as well as the record's current node.
      if (input.nodeId) await requireNodeAccess(req.user, input.nodeId, 'manage');

      // Apply a supplied name while preserving omitted fields.
      if (input.name !== undefined) person.name = input.name;
      // Apply a supplied normalized email while preserving omitted fields.
      if (input.email !== undefined) person.email = input.email;
      // Move the record only after authorizing its destination node.
      if (input.nodeId !== undefined) person.nodeId = input.nodeId;
      // Hash any replacement password before assigning it to the model.
      if (input.password !== undefined) person.passwordHash = await bcrypt.hash(input.password, 12);
      // Validate and persist all supplied account changes.
      await person.save();
      // Return the sanitized updated account.
      res.json(person);
    } catch (error) {
      // Forward validation, authorization, and persistence failures.
      next(error);
    }
  });

  /** Delete an in-scope account after verifying the caller is a manager. */
  router.delete('/:id', async (req, res, next) => {
    try {
      // Restrict account removal to managers.
      ensureCanManage(req.user);
      // Load the target account from this router's role-specific model.
      const person = await Model.findById(req.params.id);
      // Confirm the record belongs to a node the manager can administer.
      await requireRecordAccess(req.user, person, 'manage');
      // Permanently remove the authorized account.
      await person.deleteOne();
      // Return the no-content status for a successful deletion.
      res.status(204).end();
    } catch (error) {
      // Forward errors to the shared response handler.
      next(error);
    }
  });

  // Return the finished router for mounting under the matching API path.
  return router;
}

// Export the route factory so the app can create one router per account role.
module.exports = { createPeopleRouter };
