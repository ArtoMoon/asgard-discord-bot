/**
 * Seviye 1-50 Sistemi ve Seviye Rolleri (5, 10, 20, 30, 40, 50 MAX)
 */
const LEVEL_MILESTONES = [
  {
    level: 5,
    name: 'Seviye 5',
    roleName: 'Seviye 5 [Başlangıç / Emoji]',
    color: '#1abc9c',
    requiredXp: 2400,
    perk: 'Harici Emoji & Tepki Kullanabilme'
  },
  {
    level: 10,
    name: 'Seviye 10',
    roleName: 'Seviye 10 [GIF/Sticker]',
    color: '#3498db',
    requiredXp: 12150,
    perk: 'GIF & Harici Sticker Kullanabilme'
  },
  {
    level: 20,
    name: 'Seviye 20',
    roleName: 'Seviye 20 [Görsel]',
    color: '#2ecc71',
    requiredXp: 54150,
    perk: 'Görsel & Resim Paylaşma Yetkisi'
  },
  {
    level: 30,
    name: 'Seviye 30',
    roleName: 'Seviye 30 [Link]',
    color: '#9b59b6',
    requiredXp: 126150,
    perk: 'Bağlantı (Link) Paylaşma Yetkisi'
  },
  {
    level: 40,
    name: 'Seviye 40',
    roleName: 'Seviye 40 [Yayın]',
    color: '#e67e22',
    requiredXp: 228150,
    perk: '1080p/60FPS Canlı Yayın Açma & Ses Yetkisi'
  },
  {
    level: 50,
    name: 'Seviye 50 [MAX]',
    roleName: 'Seviye 50 [Şampiyon / VIP]',
    color: '#f1c40f',
    requiredXp: 360150,
    perk: 'Asgard Şampiyonu, Öncelikli Konuşmacı & VIP Ayrıcalıklar'
  }
];

const ASGARD_RANKS = [
  {
    rank: 1,
    name: 'Thrall (Stajyer Yetkili)',
    roleName: 'Asgard - Thrall [Stajyer]',
    color: '#95a5a6',
    requiredPoints: 0,
    requiredRegistrations: 0,
    requiredPunishments: 0,
    requiredVoiceMinutes: 0,
    requiredWeeklyXp: 0,
    requiredMessages: 0,
    perks: ['Yeni Üye Kayıt Yetkisi (!kayit)', 'Temel Sohbet Rehberliği']
  },
  {
    rank: 2,
    name: 'Karl (Asistan Yetkili)',
    roleName: 'Asgard - Karl [Asistan]',
    color: '#3498db',
    requiredPoints: 100,
    requiredRegistrations: 3,
    requiredPunishments: 0,
    requiredVoiceMinutes: 30,
    requiredWeeklyXp: 100,
    requiredMessages: 25,
    perks: ['Sohbet Düzeni & Uyarı', 'Yetkili Sohbetine Erişim']
  },
  {
    rank: 3,
    name: 'Berserker (Deneme Moderatör)',
    roleName: 'Asgard - Berserker [Mod]',
    color: '#e67e22',
    requiredPoints: 250,
    requiredRegistrations: 8,
    requiredPunishments: 2,
    requiredVoiceMinutes: 60,
    requiredWeeklyXp: 250,
    requiredMessages: 60,
    perks: ['Kullanıcı Susturma (!timeout)', 'Sohbet Mesajı Temizleme']
  },
  {
    rank: 4,
    name: 'Hersir (Sohbet Moderatörü)',
    roleName: 'Asgard - Hersir [Chat Mod]',
    color: '#2ecc71',
    requiredPoints: 500,
    requiredRegistrations: 15,
    requiredPunishments: 5,
    requiredVoiceMinutes: 120,
    requiredWeeklyXp: 500,
    requiredMessages: 120,
    perks: ['Cezalıya Atma (!jail)', 'Metin Kanalları Moderasyonu']
  },
  {
    rank: 5,
    name: 'Thegn (Ses Moderatörü)',
    roleName: 'Asgard - Thegn [Ses Mod]',
    color: '#1abc9c',
    requiredPoints: 850,
    requiredRegistrations: 25,
    requiredPunishments: 10,
    requiredVoiceMinutes: 240,
    requiredWeeklyXp: 850,
    requiredMessages: 200,
    perks: ['Ses Odalarında Üye Taşıma & Susturma', 'Geçici Ses Odası Yönetimi']
  },
  {
    rank: 6,
    name: 'Jarl (Kıdemli Moderatör)',
    roleName: 'Asgard - Jarl [Kıdemli Mod]',
    color: '#9b59b6',
    requiredPoints: 1300,
    requiredRegistrations: 40,
    requiredPunishments: 18,
    requiredVoiceMinutes: 400,
    requiredWeeklyXp: 1300,
    requiredMessages: 350,
    perks: ['Üye Atma (Kick Yetkisi)', 'Yetki Verme Talep Açma (/yetki-ver)']
  },
  {
    rank: 7,
    name: 'Einherjar (Şef Moderatör)',
    roleName: 'Asgard - Einherjar [Şef Mod]',
    color: '#e74c3c',
    requiredPoints: 1900,
    requiredRegistrations: 60,
    requiredPunishments: 30,
    requiredVoiceMinutes: 600,
    requiredWeeklyXp: 1900,
    requiredMessages: 500,
    perks: ['Moderatör Ekibini Denetleme', 'Denetim Kaydı (Audit Log) Takibi']
  },
  {
    rank: 8,
    name: 'Valkyrie (Asistan Yönetici)',
    roleName: 'Asgard - Valkyrie [Yönetici]',
    color: '#fd79a8',
    requiredPoints: 2700,
    requiredRegistrations: 85,
    requiredPunishments: 45,
    requiredVoiceMinutes: 900,
    requiredWeeklyXp: 2700,
    requiredMessages: 750,
    perks: ['Sunucudan Yasaklama (Ban Yetkisi)', 'Kanal Düzeni & İzin Kontrolü']
  },
  {
    rank: 9,
    name: 'Aesir (Konsey Yöneticisi)',
    roleName: 'Asgard - Aesir [Konsey]',
    color: '#f39c12',
    requiredPoints: 3800,
    requiredRegistrations: 120,
    requiredPunishments: 65,
    requiredVoiceMinutes: 1300,
    requiredWeeklyXp: 3800,
    requiredMessages: 1000,
    perks: ['Tüm Moderasyon Komutları', 'Etkinlik Yönetimi & Ceza İptalleri']
  },
  {
    rank: 10,
    name: 'Odin\'s Champion (Baş Yönetici)',
    roleName: 'Asgard - Odin\'s Champion [Baş Yönetici]',
    color: '#f1c40f',
    requiredPoints: 5500,
    requiredRegistrations: 175,
    requiredPunishments: 100,
    requiredVoiceMinutes: 2000,
    requiredWeeklyXp: 5500,
    requiredMessages: 1500,
    perks: ['Tüm Sunucu Yönetimi', 'Güvenli Liste (Guard Muafiyeti)', 'Developer Onay Yetkisi']
  }
];

class RankManager {
  static getLevelMilestones() {
    return LEVEL_MILESTONES;
  }

  static calculateLevel(totalXp) {
    if (!totalXp || totalXp <= 0) return 1;
    // Seviye 2 = 150 XP, Seviye 5 = 2400 XP, Seviye 10 = 12150 XP
    const level = Math.floor(Math.sqrt(totalXp / 150)) + 1;
    return Math.max(1, Math.min(50, level));
  }

  static xpForLevel(level) {
    if (level <= 1) return 0;
    return Math.pow(level - 1, 2) * 150;
  }

  static getMilestoneForLevel(level) {
    return LEVEL_MILESTONES.find(m => m.level === level) || null;
  }

  static getHighestMilestoneReached(level) {
    let highest = null;
    for (const m of LEVEL_MILESTONES) {
      if (level >= m.level) highest = m;
    }
    return highest;
  }

  /**
   * Üye Seviye 5, 10, 20, 30, 40 veya 50'ye ulaştığında ilgili Seviye Rolünü verir
   */
  static async syncMemberLevelRole(guild, member, newLevel, settings) {
    const milestone = this.getHighestMilestoneReached(newLevel);
    if (!milestone || !guild || !member) {
      return { milestone: null, roleUpdated: false, assignedRoleId: null };
    }

    const levelRoles = settings?.levelRoles || [];
    let roleCfg = levelRoles.find(r => r.level === milestone.level && r.roleId);

    // Eğer Seviye 5 için henüz özel ID girilmemişse ilk tanımlı seviye rolüne veya sunucudaki isme bak
    if (!roleCfg && milestone.level === 5) {
      roleCfg = levelRoles.find(r => r.level === 10 && r.roleId);
    }

    let roleToGive = roleCfg?.roleId ? guild.roles.cache.get(roleCfg.roleId) : null;

    // Sunucuda isimle ara (Örn: "Seviye 5 [Başlangıç / Emoji]" veya "Seviye 5")
    if (!roleToGive) {
      roleToGive = guild.roles.cache.find(r =>
        r.name.toLowerCase() === milestone.roleName.toLowerCase() ||
        r.name.toLowerCase() === milestone.name.toLowerCase() ||
        r.name.toLowerCase().startsWith(`seviye ${milestone.level}`)
      );
    }

    // Eğer sunucuda hiç yoksa otomatik oluştur ve ayarlara kaydet!
    if (!roleToGive) {
      try {
        roleToGive = await guild.roles.create({
          name: milestone.roleName,
          color: milestone.color,
          hoist: true,
          mentionable: false,
          reason: `Asgard Seviye ${milestone.level} Rolü Otomatik Oluşturuldu`
        });
        if (settings) {
          const existingIdx = settings.levelRoles.findIndex(r => r.level === milestone.level);
          if (existingIdx >= 0) {
            settings.levelRoles[existingIdx].roleId = roleToGive.id;
          } else {
            settings.levelRoles.push({
              level: milestone.level,
              roleId: roleToGive.id,
              name: milestone.name,
              perk: milestone.perk,
              color: milestone.color
            });
          }
          await settings.save().catch(() => null);
        }
      } catch (err) {
        // Botun rol oluşturma yetkisi yoksa geç
      }
    }

    if (roleToGive) {
      const alreadyHas = member.roles.cache.has(roleToGive.id);
      if (!alreadyHas) {
        await member.roles.add(roleToGive, `Seviye ${newLevel} (${milestone.name}) ödülü`).catch(() => null);
      }
      return {
        milestone,
        roleUpdated: !alreadyHas,
        assignedRoleId: roleToGive.id
      };
    }

    return { milestone, roleUpdated: false, assignedRoleId: null };
  }

  static getRanks() {
    return ASGARD_RANKS;
  }

  static getRankByLevel(level) {
    const validLevel = Math.max(1, Math.min(10, level || 1));
    return ASGARD_RANKS.find(r => r.rank === validLevel) || ASGARD_RANKS[0];
  }

  /**
   * Kullanıcının yetkili kadrosunda olup olmadığını kontrol eder
   */
  static isMemberStaff(member, settings, profile) {
    if (!member) return false;
    if (profile?.staff?.isStaff) return true;

    const staffRoleIds = settings?.staffRoleIds || [];
    const asgardRoleIds = (settings?.ranks || []).map(r => r.roleId).filter(Boolean);
    const allStaffRoleIds = [...staffRoleIds, ...asgardRoleIds];

    return member.roles.cache.some(r => allStaffRoleIds.includes(r.id));
  }

  /**
   * Üyenin üzerindeki mevcut Asgard Yetkili Rolüne göre kademesini (1-10) bulur
   */
  static detectMemberStaffRank(member, settings, profile) {
    let highestDetected = profile?.staff?.rank || 1;
    if (member && settings && Array.isArray(settings.ranks)) {
      for (const r of settings.ranks) {
        if (r.roleId && member.roles.cache.has(r.roleId)) {
          if (r.rank > highestDetected) highestDetected = r.rank;
        }
      }
    }
    return Math.max(1, Math.min(10, highestDetected));
  }

  /**
   * Yetkili Terfi & Görev İlerlemesini Hesaplar (Level'den tamamen farklı: İcraat Puanı, Kayıt, Ceza, Ses Mesaisi)
   */
  static getStaffPromotionProgress(currentStaffRank, staffStats = {}) {
    const validRank = Math.max(1, Math.min(10, currentStaffRank || 1));
    const current = this.getRankByLevel(validRank);

    if (validRank >= 10) {
      return {
        currentRank: current,
        nextRank: null,
        isMax: true,
        progressPercent: 100,
        pointsPercent: 100,
        regPercent: 100,
        punishPercent: 100,
        voicePercent: 100,
        neededPoints: 0,
        neededRegistrations: 0,
        neededPunishments: 0,
        neededVoiceMinutes: 0
      };
    }

    const next = this.getRankByLevel(validRank + 1);
    const {
      points = 0,
      registrations = 0,
      punishments = 0,
      voiceMinutes = 0
    } = staffStats;

    const pointsPercent = next.requiredPoints > 0
      ? Math.min(100, Math.floor((points / next.requiredPoints) * 100))
      : 100;
    const regPercent = next.requiredRegistrations > 0
      ? Math.min(100, Math.floor((registrations / next.requiredRegistrations) * 100))
      : 100;
    const punishPercent = next.requiredPunishments > 0
      ? Math.min(100, Math.floor((punishments / next.requiredPunishments) * 100))
      : 100;
    const voicePercent = next.requiredVoiceMinutes > 0
      ? Math.min(100, Math.floor((voiceMinutes / next.requiredVoiceMinutes) * 100))
      : 100;

    // Yetkili Puanı ana ağırlığa (%50), görevler (%50) ağırlığa sahiptir
    const taskAvg = Math.floor((regPercent + punishPercent + voicePercent) / 3);
    const totalPercent = Math.min(100, Math.floor(pointsPercent * 0.6 + taskAvg * 0.4));

    return {
      currentRank: current,
      nextRank: next,
      isMax: false,
      progressPercent: totalPercent,
      pointsPercent,
      regPercent,
      punishPercent,
      voicePercent,
      neededPoints: Math.max(0, next.requiredPoints - points),
      neededRegistrations: Math.max(0, next.requiredRegistrations - registrations),
      neededPunishments: Math.max(0, next.requiredPunishments - punishments),
      neededVoiceMinutes: Math.max(0, next.requiredVoiceMinutes - voiceMinutes)
    };
  }

  /**
   * Yetkiliye yaptığı icraat için puan ekler ve terfi şartları sağlandıysa otomatik kademe atlatır
   * @param {'REGISTER'|'PUNISH'|'VOICE'|'MESSAGE'|'BONUS'} actionType
   */
  static async addStaffAction(guild, member, profile, settings, actionType, customPoints = 0) {
    if (!profile.staff) {
      profile.staff = {
        isStaff: false,
        rank: 1,
        points: 0,
        registrations: 0,
        punishments: 0,
        voiceMinutes: 0,
        messages: 0,
        bonusPoints: 0
      };
    }

    const isStaff = this.isMemberStaff(member, settings, profile);
    if (!isStaff && actionType !== 'BONUS') {
      return { promoted: false };
    }

    profile.staff.isStaff = true;
    profile.staff.rank = this.detectMemberStaffRank(member, settings, profile);

    let addedPoints = 0;
    if (actionType === 'REGISTER') {
      addedPoints = 15;
      profile.staff.registrations = (profile.staff.registrations || 0) + 1;
    } else if (actionType === 'PUNISH') {
      addedPoints = 20;
      profile.staff.punishments = (profile.staff.punishments || 0) + 1;
    } else if (actionType === 'VOICE') {
      addedPoints = 10;
      profile.staff.voiceMinutes = (profile.staff.voiceMinutes || 0) + 5;
    } else if (actionType === 'MESSAGE') {
      addedPoints = 3;
      profile.staff.messages = (profile.staff.messages || 0) + 1;
    } else if (actionType === 'BONUS') {
      addedPoints = customPoints;
      profile.staff.bonusPoints = (profile.staff.bonusPoints || 0) + customPoints;
    }

    profile.staff.points = Math.max(0, (profile.staff.points || 0) + addedPoints);

    // Terfi kontrolü: Mevcut kademeden yukarıda hak ettiği kademe var mı?
    const oldRankNum = profile.staff.rank || 1;
    let newRankNum = oldRankNum;

    for (const r of ASGARD_RANKS) {
      if (r.rank > oldRankNum && profile.staff.points >= r.requiredPoints) {
        newRankNum = r.rank;
      }
    }

    if (newRankNum > oldRankNum) {
      profile.staff.rank = newRankNum;
      profile.currentRank = newRankNum;

      const oldRankObj = this.getRankByLevel(oldRankNum);
      const newRankObj = this.getRankByLevel(newRankNum);

      // Discord üzerinde eski yetkili kademe rolünü çıkar, yeni kademe rolünü ver
      let assignedRoleId = null;
      if (member && settings && Array.isArray(settings.ranks)) {
        const oldRoleConfig = settings.ranks.find(r => r.rank === oldRankNum);
        const newRoleConfig = settings.ranks.find(r => r.rank === newRankNum);

        if (oldRoleConfig?.roleId && member.roles.cache.has(oldRoleConfig.roleId)) {
          await member.roles.remove(oldRoleConfig.roleId, 'Asgard Yetkili Terfi Sistemi: Üst kademeye terfi etti.').catch(() => null);
        }
        if (newRoleConfig?.roleId) {
          const roleToGive = guild.roles.cache.get(newRoleConfig.roleId);
          if (roleToGive) {
            await member.roles.add(roleToGive, `Asgard Yetkili Terfi Sistemi: ${newRankObj.name} kademesine yükseldi.`).catch(() => null);
            assignedRoleId = newRoleConfig.roleId;
          }
        }
      }

      await profile.save();

      // Rütbe Log kanalına tebrik bildirimi gönder
      const logChannelId = settings?.rankLogChannelId || settings?.modLogChannelId;
      if (logChannelId && guild) {
        const Logger = require('./logger');
        const promoteEmbed = {
          color: parseInt((newRankObj.color || '#9b59b6').replace('#', ''), 16),
          title: '🎖️ [YETKİLİ TERFİ] YENİ YÖNETİM KADEMESİNE YÜKSELDİ!',
          description:
            `Tebrikler ${member}! Sunucudaki başarılı yetkili icraatların ve görev performansın sayesinde terfi aldın!\n\n` +
            `📉 **Eski Kademe:** ${oldRankObj.name}\n` +
            `👑 **Yeni Kademe:** **${newRankObj.name}** *(Kademe ${newRankNum}/10)*\n` +
            (assignedRoleId ? `🛡️ **Verilen Yetki Rolü:** <@&${assignedRoleId}>\n\n` : '\n') +
            `📊 **Yetkili İcraat Özeti:**\n` +
            `• ⭐ **Yetkili Puanı:** \`${profile.staff.points} Puan\`\n` +
            `• 📝 **Kayıt Sayısı:** \`${profile.staff.registrations} Üye\`\n` +
            `• 🔨 **Moderasyon İşlemi:** \`${profile.staff.punishments} İşlem\`\n` +
            `• 🎙️ **Ses Mesaisi:** \`${profile.staff.voiceMinutes} Dakika\`\n\n` +
            `🎁 **Açılan Yeni Yönetim Yetkileri:**\n${newRankObj.perks.map(p => `✅ ${p}`).join('\n')}`,
          timestamp: new Date().toISOString()
        };
        await Logger.sendGuildLog(guild, logChannelId, promoteEmbed).catch(() => null);
      }

      return { promoted: true, oldRank: oldRankObj, newRank: newRankObj, assignedRoleId };
    }

    await profile.save();
    return { promoted: false, addedPoints };
  }

  /**
   * Backward compatible helper
   */
  static getNextRankProgress(currentRankLevel, weeklyStats, staffStats) {
    if (staffStats) {
      return this.getStaffPromotionProgress(currentRankLevel, staffStats);
    }
    const validRank = Math.max(1, Math.min(10, currentRankLevel || 1));
    const current = this.getRankByLevel(validRank);
    if (validRank >= 10) {
      return {
        currentRank: current,
        nextRank: null,
        isMax: true,
        progressPercent: 100
      };
    }
    const next = this.getRankByLevel(validRank + 1);
    const { messages = 0, voiceMinutes = 0, xp = 0 } = weeklyStats || {};
    const xpPercent = Math.min(100, Math.floor((xp / (next.requiredPoints || 100)) * 100)) || 0;
    return {
      currentRank: current,
      nextRank: next,
      isMax: false,
      progressPercent: xpPercent,
      neededXp: Math.max(0, (next.requiredPoints || 100) - xp),
      neededMessages: Math.max(0, (next.requiredMessages || 25) - messages),
      neededVoiceMinutes: Math.max(0, (next.requiredVoiceMinutes || 30) - voiceMinutes)
    };
  }

  /**
   * Generates a clean text progress bar [████░░░░░░] 40%
   */
  static createProgressBar(percent, length = 10) {
    const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * length);
    const empty = length - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`;
  }
}

module.exports = {
  LEVEL_MILESTONES,
  ASGARD_RANKS,
  RankManager
};
