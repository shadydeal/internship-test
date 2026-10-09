const test = require('node:test');
const assert = require('node:assert/strict');
const { canAccessNode, canManageEntity, canReadEntity, isInSubtree } = require('../src/security/access');

const nodes = {
  serbia: { _id: 'serbia', ancestors: [] },
  noviBeograd: { _id: 'novi-beograd', ancestors: ['serbia'] },
  bezanija: { _id: 'bezanija', ancestors: ['serbia', 'novi-beograd'] },
  radnja6: { _id: 'radnja-6', ancestors: ['serbia', 'novi-beograd', 'bezanija'] },
  vojvodina: { _id: 'vojvodina', ancestors: ['serbia'] },
};

/** Verify self-node, descendant, and unrelated-branch subtree membership. */
test('a node is in its own subtree and the subtree of each ancestor', () => {
  assert.equal(isInSubtree(nodes.bezanija, 'bezanija'), true);
  assert.equal(isInSubtree(nodes.radnja6, 'novi-beograd'), true);
  assert.equal(isInSubtree(nodes.vojvodina, 'novi-beograd'), false);
});

/** Verify managers can manage both account types only inside their subtree. */
test('managers can read and manage employees and managers in their subtree', () => {
  const manager = { role: 'manager', nodeId: 'novi-beograd' };
  assert.equal(canAccessNode(manager, nodes.radnja6, 'employee', 'read'), true);
  assert.equal(canAccessNode(manager, nodes.bezanija, 'manager', 'manage'), true);
  assert.equal(canAccessNode(manager, nodes.vojvodina, 'employee', 'manage'), false);
});

/** Verify employees can read descendant employees but cannot read or manage managers. */
test('employees can read employees in their subtree but cannot manage accounts', () => {
  const employee = { role: 'employee', nodeId: 'novi-beograd' };
  assert.equal(canAccessNode(employee, nodes.radnja6, 'employee', 'read'), true);
  assert.equal(canAccessNode(employee, nodes.bezanija, 'employee', 'manage'), false);
  assert.equal(canAccessNode(employee, nodes.bezanija, 'manager', 'read'), false);
  assert.equal(canManageEntity(employee), false);
});

/** Verify manager records are readable only by manager-role actors. */
test('only managers may read manager accounts', () => {
  assert.equal(canReadEntity({ role: 'manager' }, 'manager'), true);
  assert.equal(canReadEntity({ role: 'employee' }, 'manager'), false);
  assert.equal(canReadEntity({ role: 'other' }, 'employee'), false);
});
