const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },

  // Stats & XP
  totalXp: { type: Number, default: 0 },
  level: { type: Number, default: 1 }, // 1 to 50
  messageCount: { type: Number, default: 0 },
  voiceMinutes: { type: Number, default: 0 },

  // Current Level Milestone (10, 20, 30, 40, 50)
  currentRank: { type: Number, default: 1 },

  // Weekly Stats (resets periodically or rolling)
  weekly: {
    messages: { type: Number, default: 0 },
    voiceMinutes: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    weekStartDate: { type: Date, default: Date.now }
  },

  // Active voice session tracking
  voiceJoinedAt: { type: Date, default: null },

  // Moderation state
  isJailed: { type: Boolean, default: false },
  jailedRoles: { type: [String], default: [] },

  // Offline / Invisible staff role suspension
  offlineStaffSuspendedRoles: { type: [String], default: [] }
}, { timestamps: true });

// Compound unique index for guild + user
UserProfileSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('UserProfile', UserProfileSchema);
