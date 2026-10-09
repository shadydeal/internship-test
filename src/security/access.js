/** Check whether a node is the actor's root node or one of its descendants. */
function isInSubtree(node, rootNodeId) {
  return Boolean(
    node &&
      rootNodeId &&
      (String(node._id) === String(rootNodeId) ||
        (Array.isArray(node.ancestors) &&
          node.ancestors.some(
            // Compare normalized IDs so populated and string node references behave consistently.
            (id) => String(id) === String(rootNodeId),
          ))),
  );
}

/** Apply role rules for reading a given account type. */
function canReadEntity(actor, entityType) {
  if (!actor || !['employee', 'manager'].includes(actor.role)) return false;
  if (entityType === 'employee') return true;
  return entityType === 'manager' && actor.role === 'manager';
}

/** Determine whether the actor's role permits account mutations. */
function canManageEntity(actor) {
  return actor?.role === 'manager';
}

/** Check both the actor's read scope and, for mutations, their manager role. */
function canAccessNode(actor, node, entityType, action) {
  if (!canReadEntity(actor, entityType) || !isInSubtree(node, actor.nodeId)) return false;
  return action === 'read' || (action === 'manage' && canManageEntity(actor));
}

module.exports = { canAccessNode, canManageEntity, canReadEntity, isInSubtree };
