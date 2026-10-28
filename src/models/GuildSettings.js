const mongoose = require('mongoose');
const config = require('../config');

const RankRoleSchema = new mongoose.Schema({
  rank: { type: Number, required: true },
  roleId: { type: String, default: null },
  name: { type: String, required: true }
}, { _id: false });

const LevelRoleSchema = new mongoose.Schema({
  level: { type: Number, required: true }, // 10, 20, 30, 40, 50
  roleId: { type: String, default: null },
  name: { type: String, required: true },
  perk: { type: String, default: '' },
  color: { type: String, default: '#9b59b6' }
}, { _id: false });

const GuildSettingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  prefix: { type: String, default: config.defaultPrefix },
  
  // Registration & Roles
  autoRoleId: { type: String, default: null }, // Role given immediately on join (e.g. Unverified)
  unverifiedRoleId: { type: String, default: null },
  registeredRoleId: { type: String, default: null }, // Member role given after /kayit
  staffRoleIds: { type: [String], default: [] }, // Moderation / Staff role IDs
  jailRoleId: { type: String, default: null },

  // Channels
  welcomeChannelId: { type: String, default: null },
  modLogChannelId: { type: String, default: null },
  jailLogChannelId: { type: String, default: null },
  approvalChannelId: { type: String, default: null }, // Developer approval channel
  rankLogChannelId: { type: String, default: null },
  levelLogChannelId: { type: String, default: null }, // Dedicated Level Log Channel
  leaderboardChannelId: { type: String, default: null }, // 5 dakikada bir güncellenen sıralama tablosu kanalı
  leaderboardMessageId: { type: String, default: null }, // Güncellenen sıralama mesajı ID'si

  // Join to create voice system
  joinToCreateChannelId: { type: String, default: null },
  tempVoiceCategoryId: { type: String, default: null },

  // Developer security & Whitelist (Güvenli Liste - Elle rol verebilecek kişiler)
  developerUserIds: { type: [String], default: [] },
  safeUserIds: { type: [String], default: [] }, // Sadece bu ID'ler Discord'da elle rol verebilir

  // Seviye 10, 20, 30, 40, 50 Rolleri
  levelRoles: { type: [LevelRoleSchema], default: [] },

  // Backward compatibility
  ranks: { type: [RankRoleSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('GuildSettings', GuildSettingsSchema);
