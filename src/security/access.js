/** Check each condition that makes a node the actor's root or a descendant. */
function isInSubtree(node, rootNodeId) {
  // Convert the individual checks to one explicit boolean result.
  return Boolean(
    node && // A missing node cannot belong to a subtree.
      rootNodeId && // A missing root cannot define a meaningful subtree.
      (String(node._id) === String(rootNodeId) || // The root itself is always in its subtree.
        (Array.isArray(node.ancestors) &&
          // Match the root against the node's stored ancestor path.
          node.ancestors.some(
            // Normalize IDs so string-like database references compare consistently.
            (id) => String(id) === String(rootNodeId),
          ))),
  );
}

/** Apply the employee and manager rules for reading each account type. */
function canReadEntity(actor, entityType) {
  // Unknown, missing, or unsupported actor roles never receive read access.
  if (!actor || !['employee', 'manager'].includes(actor.role)) return false;
  // Both valid roles may read employees, subject to the node-scope check.
  if (entityType === 'employee') return true;
  // Only managers may read manager accounts.
  return entityType === 'manager' && actor.role === 'manager';
}

/** Determine whether the actor's role permits account mutations. */
function canManageEntity(actor) {
  // The task grants account management exclusively to managers.
  return actor?.role === 'manager';
}

/** Combine account-type, subtree, and requested-operation authorization checks. */
function canAccessNode(actor, node, entityType, action) {
  // First deny unsupported account types/roles and nodes outside the actor's subtree.
  if (!canReadEntity(actor, entityType) || !isInSubtree(node, actor.nodeId)) return false;
  // Reads are allowed after the preceding checks; mutations additionally require a manager.
  return action === 'read' || (action === 'manage' && canManageEntity(actor));
}

// Export shared authorization predicates for routes and unit tests.
module.exports = { canAccessNode, canManageEntity, canReadEntity, isInSubtree };
