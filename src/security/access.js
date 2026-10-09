function isInSubtree(node, rootNodeId) {
  return Boolean(
    node &&
      rootNodeId &&
      (String(node._id) === String(rootNodeId) ||
        (Array.isArray(node.ancestors) && node.ancestors.some((id) => String(id) === String(rootNodeId)))),
  );
}

function canReadEntity(actor, entityType) {
  if (!actor || !['employee', 'manager'].includes(actor.role)) return false;
  if (entityType === 'employee') return true;
  return entityType === 'manager' && actor.role === 'manager';
}

function canManageEntity(actor) {
  return actor?.role === 'manager';
}

function canAccessNode(actor, node, entityType, action) {
  if (!canReadEntity(actor, entityType) || !isInSubtree(node, actor.nodeId)) return false;
  return action === 'read' || (action === 'manage' && canManageEntity(actor));
}

module.exports = { canAccessNode, canManageEntity, canReadEntity, isInSubtree };
