const mongoose = require('mongoose');
const config = require('../config');

const RankRoleSchema = new mongoose.Schema({
  rank: { type: Number, required: true },
  roleId: { type: String, default: null },
  name: { type: String, required: true }
}, { _id: false });

const GuildSettingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  prefix: { type: String, default: config.defaultPrefix },
  
  // Registration & Roles
  autoRoleId: { type: String, default: null }, // Role given immediately on join (e.g. Unverified)
  unverifiedRoleId: { type: String, default: null },
  registeredRoleId: { type: String, default: null }, // Member role given after /kayit
  staffRoleIds: { type: [String], default: [] }, // Staff role IDs protected by offline guard and approval
  jailRoleId: { type: String, default: null },

  // Channels
  welcomeChannelId: { type: String, default: null },
  modLogChannelId: { type: String, default: null },
  jailLogChannelId: { type: String, default: null },
  approvalChannelId: { type: String, default: null }, // Developer approval channel
  rankLogChannelId: { type: String, default: null },

  // Join to create voice system
  joinToCreateChannelId: { type: String, default: null },
  tempVoiceCategoryId: { type: String, default: null },

  // Developer security
  developerUserIds: { type: [String], default: [] },

  // Asgard 10 Ranks mappings
  ranks: { type: [RankRoleSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('GuildSettings', GuildSettingsSchema);
