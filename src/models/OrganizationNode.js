// Load Mongoose to define and register the MongoDB organization-node model.
const mongoose = require('mongoose');

/** Define node identity, parentage, and ancestry for organization queries. */
const organizationNodeSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // Use stable readable IDs for node references.
    name: { type: String, required: true, trim: true }, // Store the display name without surrounding whitespace.
    parentId: { type: String, default: null }, // Link each non-root node to its immediate parent.
    ancestors: { type: [String], default: [] }, // Materialize ancestor IDs for efficient descendant checks.
  },
  { timestamps: true, versionKey: false }, // Track edits without exposing Mongoose's internal version field.
);

// Index ancestry so MongoDB can efficiently locate descendant nodes.
organizationNodeSchema.index({ ancestors: 1 });

// Reuse a registered model during reloads, otherwise bind it to its collection.
module.exports =
  mongoose.models.OrganizationNode ||
  mongoose.model('OrganizationNode', organizationNodeSchema, 'organization_nodes');
