const mongoose = require('mongoose');

const organizationNodeSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    parentId: { type: String, default: null },
    ancestors: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false },
);

organizationNodeSchema.index({ ancestors: 1 });

module.exports =
  mongoose.models.OrganizationNode ||
  mongoose.model('OrganizationNode', organizationNodeSchema, 'organization_nodes');
