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

  // Dedicated Staff / Yetkili Career & Promotion Stats (Level'den tamamen bağımsız!)
  staff: {
    isStaff: { type: Boolean, default: false },
    rank: { type: Number, default: 1 }, // 1 to 10 (Thrall -> Odin's Champion)
    points: { type: Number, default: 0 }, // Yetkili İcraat Puanı
    registrations: { type: Number, default: 0 }, // Yaptığı kayıt sayısı (!kayit)
    punishments: { type: Number, default: 0 }, // Uyguladığı ceza sayısı (!jail, !timeout)
    voiceMinutes: { type: Number, default: 0 }, // Yetkili ses mesaisi (dakika)
    messages: { type: Number, default: 0 }, // Yetkili sohbet denetim mesajı
    bonusPoints: { type: Number, default: 0 } // Üst yönetim tarafından verilen ödül/ceza puanı
  },

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
