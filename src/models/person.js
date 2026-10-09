const mongoose = require('mongoose');

const personSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    nodeId: { type: String, required: true, ref: 'OrganizationNode' },
  },
  { timestamps: true, versionKey: false, discriminatorKey: 'role' },
);

personSchema.index({ email: 1 }, { unique: true });
personSchema.index({ nodeId: 1 });
personSchema.set('toJSON', {
  transform(_document, result) {
    delete result.passwordHash;
    return result;
  },
});

const Person = mongoose.models.Person || mongoose.model('Person', personSchema, 'people');

function getRoleModel(name, value) {
  return (
    Person.discriminators?.[name] ||
    Person.discriminator(name, new mongoose.Schema({}), value)
  );
}

const Employee = getRoleModel('Employee', 'employee');
const Manager = getRoleModel('Manager', 'manager');

module.exports = { Employee, Manager };
