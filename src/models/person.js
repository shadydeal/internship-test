// Load Mongoose to define the shared people collection and role discriminators.
const mongoose = require('mongoose');

/** Define the shared employee/manager account schema and safe JSON serialization. */
const personSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 }, // Validate and normalize each person's display name.
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 }, // Normalize email for case-insensitive account matching.
    passwordHash: { type: String, required: true, select: false }, // Persist only a hash and omit it from queries by default.
    nodeId: { type: String, required: true, ref: 'OrganizationNode' }, // Assign every account to an organization node.
  },
  { timestamps: true, versionKey: false, discriminatorKey: 'role' }, // Store both roles together while exposing a role discriminator.
);

// Enforce unique emails across employees and managers in the shared collection.
personSchema.index({ email: 1 }, { unique: true });
// Speed up account lookups scoped to one organization node.
personSchema.index({ nodeId: 1 });
// Sanitize account documents whenever they are converted to JSON.
personSchema.set('toJSON', {
  /** Remove stored password hashes whenever an account is serialized. */
  transform(_document, result) {
    // Ensure even explicitly selected hashes never appear in API responses.
    delete result.passwordHash;
    // Keep the remaining document fields in the response.
    return result;
  },
});

// Reuse the base model if it was already registered in this process.
const Person = mongoose.models.Person || mongoose.model('Person', personSchema, 'people');

/** Return an existing role discriminator or register it on the people collection. */
function getRoleModel(name, value) {
  // Reuse a previously registered role model or add its discriminator to Person.
  return (
    Person.discriminators?.[name] ||
    Person.discriminator(name, new mongoose.Schema({}), value)
  );
}

// Bind each account role to its discriminator value in MongoDB.
const Employee = getRoleModel('Employee', 'employee');
const Manager = getRoleModel('Manager', 'manager');

// Export role-specific models for authentication, CRUD routes, and seeding.
module.exports = { Employee, Manager };
