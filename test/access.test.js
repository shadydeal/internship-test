// Load Node's built-in test runner without adding a separate test dependency.
const test = require('node:test');
// Load strict assertions so boolean outcomes are compared without coercion.
const assert = require('node:assert/strict');
// Import the access predicates whose role and subtree behavior is under test.
const { canAccessNode, canManageEntity, canReadEntity, isInSubtree } = require('../src/security/access');

// Model fixture nodes with the same ancestor-path shape stored in MongoDB.
const nodes = {
  serbia: { _id: 'serbia', ancestors: [] }, // The root has no ancestors.
  noviBeograd: { _id: 'novi-beograd', ancestors: ['serbia'] }, // Novi Beograd is directly under Serbia in this fixture.
  bezanija: { _id: 'bezanija', ancestors: ['serbia', 'novi-beograd'] }, // Bezanija descends from Novi Beograd.
  radnja6: { _id: 'radnja-6', ancestors: ['serbia', 'novi-beograd', 'bezanija'] }, // Radnja 6 descends through Bezanija.
  vojvodina: { _id: 'vojvodina', ancestors: ['serbia'] }, // Vojvodina is a separate child branch.
};

/** Verify self-node, descendant, and unrelated-branch subtree membership. */
test('a node is in its own subtree and the subtree of each ancestor', () => {
  // A node is included in the subtree rooted at itself.
  assert.equal(isInSubtree(nodes.bezanija, 'bezanija'), true);
  // A deeper descendant is included in an ancestor's subtree.
  assert.equal(isInSubtree(nodes.radnja6, 'novi-beograd'), true);
  // A sibling branch is excluded from the Novi Beograd subtree.
  assert.equal(isInSubtree(nodes.vojvodina, 'novi-beograd'), false);
});

/** Verify managers can manage both account types only inside their subtree. */
test('managers can read and manage employees and managers in their subtree', () => {
  // Create an actor scoped to the Novi Beograd root.
  const manager = { role: 'manager', nodeId: 'novi-beograd' };
  // Managers can read descendant employee accounts.
  assert.equal(canAccessNode(manager, nodes.radnja6, 'employee', 'read'), true);
  // Managers can manage descendant manager accounts.
  assert.equal(canAccessNode(manager, nodes.bezanija, 'manager', 'manage'), true);
  // Even managers cannot mutate an account in an unrelated branch.
  assert.equal(canAccessNode(manager, nodes.vojvodina, 'employee', 'manage'), false);
});

/** Verify employees can read descendant employees but cannot read or manage managers. */
test('employees can read employees in their subtree but cannot manage accounts', () => {
  // Create an employee actor whose node scope is the same example branch.
  const employee = { role: 'employee', nodeId: 'novi-beograd' };
  // Employees can read employee accounts at descendant nodes.
  assert.equal(canAccessNode(employee, nodes.radnja6, 'employee', 'read'), true);
  // Employees cannot mutate employee accounts.
  assert.equal(canAccessNode(employee, nodes.bezanija, 'employee', 'manage'), false);
  // Employees cannot read manager accounts even in their subtree.
  assert.equal(canAccessNode(employee, nodes.bezanija, 'manager', 'read'), false);
  // The role-level mutation predicate independently denies employee actors.
  assert.equal(canManageEntity(employee), false);
});

/** Verify manager records are readable only by manager-role actors. */
test('only managers may read manager accounts', () => {
  // Manager actors may read manager entities.
  assert.equal(canReadEntity({ role: 'manager' }, 'manager'), true);
  // Employee actors may not read manager entities.
  assert.equal(canReadEntity({ role: 'employee' }, 'manager'), false);
  // Unknown roles may not read employee entities either.
  assert.equal(canReadEntity({ role: 'other' }, 'employee'), false);
});
