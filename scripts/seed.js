// Load environment variables for the database URI and optional seed passwords.
require('dotenv').config();
// Load MongoDB connection and model operations.
const mongoose = require('mongoose');
// Load password hashing for demo accounts.
const bcrypt = require('bcryptjs');
// Load the organization node model populated by this script.
const OrganizationNode = require('../src/models/OrganizationNode');
// Load the role models used to insert or update demo people.
const { Employee, Manager } = require('../src/models/person');

// Define the complete sample hierarchy in parent-before-child order.
const nodeDefinitions = [
  { id: 'serbia', name: 'Srbija', parentId: null }, // Root node has no parent.
  { id: 'vojvodina', name: 'Vojvodina', parentId: 'serbia' }, // Add the Vojvodina region under Serbia.
  { id: 'severnobacki-okrug', name: 'Severnobacki okrug', parentId: 'vojvodina' }, // Add the northern Backa district.
  { id: 'subotica', name: 'Subotica', parentId: 'severnobacki-okrug' }, // Add Subotica under its district.
  { id: 'radnja-1', name: 'Radnja 1', parentId: 'subotica' }, // Place store 1 in Subotica.
  { id: 'juznobacki-okrug', name: 'Juznobacki okrug', parentId: 'vojvodina' }, // Add the southern Backa district.
  { id: 'novi-sad', name: 'Novi Sad', parentId: 'juznobacki-okrug' }, // Add Novi Sad under its district.
  { id: 'detelinara', name: 'Detelinara', parentId: 'novi-sad' }, // Add the Detelinara office under Novi Sad.
  { id: 'radnja-2', name: 'Radnja 2', parentId: 'detelinara' }, // Place store 2 in Detelinara.
  { id: 'radnja-3', name: 'Radnja 3', parentId: 'detelinara' }, // Place store 3 in Detelinara.
  { id: 'liman', name: 'Liman', parentId: 'novi-sad' }, // Add the Liman office under Novi Sad.
  { id: 'radnja-4', name: 'Radnja 4', parentId: 'liman' }, // Place store 4 in Liman.
  { id: 'radnja-5', name: 'Radnja 5', parentId: 'liman' }, // Place store 5 in Liman.
  { id: 'grad-beograd', name: 'Grad Beograd', parentId: 'serbia' }, // Add Belgrade under the national root.
  { id: 'novi-beograd', name: 'Novi Beograd', parentId: 'grad-beograd' }, // Add Novi Beograd under Belgrade.
  { id: 'bezanija', name: 'Bezanija', parentId: 'novi-beograd' }, // Add Bezanija under Novi Beograd.
  { id: 'radnja-6', name: 'Radnja 6', parentId: 'bezanija' }, // Place store 6 under Bezanija for the access example.
  { id: 'vracar', name: 'Vracar', parentId: 'grad-beograd' }, // Add Vracar under Belgrade.
  { id: 'neimar', name: 'Neimar', parentId: 'vracar' }, // Add Neimar under Vracar.
  { id: 'radnja-7', name: 'Radnja 7', parentId: 'neimar' }, // Place store 7 in Neimar.
  { id: 'crveni-krst', name: 'Crveni krst', parentId: 'vracar' }, // Add Crveni krst under Vracar.
  { id: 'radnja-8', name: 'Radnja 8', parentId: 'crveni-krst' }, // Place store 8 in Crveni krst.
  { id: 'radnja-9', name: 'Radnja 9', parentId: 'crveni-krst' }, // Place store 9 in Crveni krst.
];

/** Upsert the organization hierarchy and repeatable development demo accounts. */
async function seed() {
  // Use an explicitly configured MongoDB URI or the local development database.
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/grocery_store';
  // Read the manager's demo password, with a documented local-only fallback.
  const managerPassword = process.env.SEED_MANAGER_PASSWORD || 'ChangeMe123!';
  // Read the employee's demo password, with a documented local-only fallback.
  const employeePassword = process.env.SEED_EMPLOYEE_PASSWORD || 'ChangeMe123!';
  // Establish MongoDB access before writing hierarchy and accounts.
  await mongoose.connect(uri);

  // Accumulate each node's ancestry while processing definitions in parent-first order.
  const ancestorsById = new Map();
  // Upsert nodes individually so rerunning seed refreshes rather than duplicates them.
  for (const definition of nodeDefinitions) {
    // Extend the parent's ancestry with the parent ID; roots have no ancestors.
    const ancestors = definition.parentId ? [...ancestorsById.get(definition.parentId), definition.parentId] : [];
    // Cache this ancestry so subsequent child definitions can extend it.
    ancestorsById.set(definition.id, ancestors);
    // Create or refresh this node's hierarchy fields without deleting other nodes.
    await OrganizationNode.updateOne(
      { _id: definition.id },
      { $set: { name: definition.name, parentId: definition.parentId, ancestors } },
      { upsert: true, runValidators: true },
    );
  }

  // Upsert the Novi Beograd demo manager used by the brief's access example.
  await Manager.updateOne(
    { email: 'manager@grocery.local' },
    {
      $set: {
        name: 'Demo Manager', // Provide the manager's display name.
        email: 'manager@grocery.local', // Use a predictable local demo login.
        passwordHash: await bcrypt.hash(managerPassword, 12), // Store only a cost-12 bcrypt hash.
        nodeId: 'novi-beograd', // Scope this manager to the example branch.
      },
    },
    { upsert: true, runValidators: true },
  );
  // Upsert a Vojvodina manager for testing a separate hierarchy branch.
  await Manager.updateOne(
    { email: 'vojvodina.manager@grocery.local' },
    {
      $set: {
        name: 'Vojvodina Manager', // Name the second sample manager.
        email: 'vojvodina.manager@grocery.local', // Give the account a distinct demo login.
        passwordHash: await bcrypt.hash(managerPassword, 12), // Hash the configured manager password.
        nodeId: 'vojvodina', // Assign this manager to the Vojvodina branch.
      },
    },
    { upsert: true, runValidators: true },
  );
  // Upsert an employee in Bezanija for the manager-scope example.
  await Employee.updateOne(
    { email: 'employee@grocery.local' },
    {
      $set: {
        name: 'Demo Employee', // Provide the employee's display name.
        email: 'employee@grocery.local', // Use a predictable local demo login.
        passwordHash: await bcrypt.hash(employeePassword, 12), // Store only a cost-12 bcrypt hash.
        nodeId: 'bezanija', // Place the account inside the example Novi Beograd subtree.
      },
    },
    { upsert: true, runValidators: true },
  );
  // Upsert an employee in the Vojvodina branch for branch-isolation checks.
  await Employee.updateOne(
    { email: 'vojvodina.employee@grocery.local' },
    {
      $set: {
        name: 'Vojvodina Employee', // Identify the separate-branch employee.
        email: 'vojvodina.employee@grocery.local', // Give the account a distinct demo login.
        passwordHash: await bcrypt.hash(employeePassword, 12), // Hash the configured employee password.
        nodeId: 'radnja-1', // Place the employee in Radnja 1 under Vojvodina.
      },
    },
    { upsert: true, runValidators: true },
  );

  // Report the number of hierarchy nodes and demo accounts seeded.
  console.log(`Seeded ${nodeDefinitions.length} organization nodes and 4 demo accounts.`);
}

// Run initialization when this script is invoked directly through npm run seed.
seed()
  // Report initialization errors and ensure the database connection is closed.
  .catch((error) => {
    // Log the root failure so an operator can diagnose initialization problems.
    console.error('Database initialization failed:', error);
    // Keep the process exit status nonzero when seeding fails.
    process.exitCode = 1;
  })
  // Close MongoDB after either a successful seed or a reported failure.
  .finally(async () => {
    // Release the MongoDB connection whether seeding succeeded or failed.
    await mongoose.disconnect();
  });
