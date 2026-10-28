const mongoose = require('mongoose');

const RoleRequestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  staffUserId: { type: String, required: true },
  targetUserId: { type: String, required: true },
  roleId: { type: String, required: true },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  approvalMessageId: { type: String, default: null },
  approvedByUserId: { type: String, default: null },
  reviewedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('RoleRequest', RoleRequestSchema);
