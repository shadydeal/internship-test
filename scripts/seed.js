require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const OrganizationNode = require('../src/models/OrganizationNode');
const { Employee, Manager } = require('../src/models/person');

const nodeDefinitions = [
  { id: 'serbia', name: 'Srbija', parentId: null },
  { id: 'vojvodina', name: 'Vojvodina', parentId: 'serbia' },
  { id: 'severnobacki-okrug', name: 'Severnobacki okrug', parentId: 'vojvodina' },
  { id: 'subotica', name: 'Subotica', parentId: 'severnobacki-okrug' },
  { id: 'radnja-1', name: 'Radnja 1', parentId: 'subotica' },
  { id: 'juznobacki-okrug', name: 'Juznobacki okrug', parentId: 'vojvodina' },
  { id: 'novi-sad', name: 'Novi Sad', parentId: 'juznobacki-okrug' },
  { id: 'detelinara', name: 'Detelinara', parentId: 'novi-sad' },
  { id: 'radnja-2', name: 'Radnja 2', parentId: 'detelinara' },
  { id: 'radnja-3', name: 'Radnja 3', parentId: 'detelinara' },
  { id: 'liman', name: 'Liman', parentId: 'novi-sad' },
  { id: 'radnja-4', name: 'Radnja 4', parentId: 'liman' },
  { id: 'radnja-5', name: 'Radnja 5', parentId: 'liman' },
  { id: 'grad-beograd', name: 'Grad Beograd', parentId: 'serbia' },
  { id: 'novi-beograd', name: 'Novi Beograd', parentId: 'grad-beograd' },
  { id: 'bezanija', name: 'Bezanija', parentId: 'novi-beograd' },
  { id: 'radnja-6', name: 'Radnja 6', parentId: 'bezanija' },
  { id: 'vracar', name: 'Vracar', parentId: 'grad-beograd' },
  { id: 'neimar', name: 'Neimar', parentId: 'vracar' },
  { id: 'radnja-7', name: 'Radnja 7', parentId: 'neimar' },
  { id: 'crveni-krst', name: 'Crveni krst', parentId: 'vracar' },
  { id: 'radnja-8', name: 'Radnja 8', parentId: 'crveni-krst' },
  { id: 'radnja-9', name: 'Radnja 9', parentId: 'crveni-krst' },
];

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/grocery_store';
  const managerPassword = process.env.SEED_MANAGER_PASSWORD || 'ChangeMe123!';
  const employeePassword = process.env.SEED_EMPLOYEE_PASSWORD || 'ChangeMe123!';
  await mongoose.connect(uri);

  const ancestorsById = new Map();
  for (const definition of nodeDefinitions) {
    const ancestors = definition.parentId ? [...ancestorsById.get(definition.parentId), definition.parentId] : [];
    ancestorsById.set(definition.id, ancestors);
    await OrganizationNode.updateOne(
      { _id: definition.id },
      { $set: { name: definition.name, parentId: definition.parentId, ancestors } },
      { upsert: true, runValidators: true },
    );
  }

  await Manager.updateOne(
    { email: 'manager@grocery.local' },
    {
      $set: {
        name: 'Demo Manager',
        email: 'manager@grocery.local',
        passwordHash: await bcrypt.hash(managerPassword, 12),
        nodeId: 'novi-beograd',
      },
    },
    { upsert: true, runValidators: true },
  );
  await Manager.updateOne(
    { email: 'vojvodina.manager@grocery.local' },
    {
      $set: {
        name: 'Vojvodina Manager',
        email: 'vojvodina.manager@grocery.local',
        passwordHash: await bcrypt.hash(managerPassword, 12),
        nodeId: 'vojvodina',
      },
    },
    { upsert: true, runValidators: true },
  );
  await Employee.updateOne(
    { email: 'employee@grocery.local' },
    {
      $set: {
        name: 'Demo Employee',
        email: 'employee@grocery.local',
        passwordHash: await bcrypt.hash(employeePassword, 12),
        nodeId: 'bezanija',
      },
    },
    { upsert: true, runValidators: true },
  );
  await Employee.updateOne(
    { email: 'vojvodina.employee@grocery.local' },
    {
      $set: {
        name: 'Vojvodina Employee',
        email: 'vojvodina.employee@grocery.local',
        passwordHash: await bcrypt.hash(employeePassword, 12),
        nodeId: 'radnja-1',
      },
    },
    { upsert: true, runValidators: true },
  );

  console.log(`Seeded ${nodeDefinitions.length} organization nodes and 4 demo accounts.`);
}

seed()
  .catch((error) => {
    console.error('Database initialization failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
