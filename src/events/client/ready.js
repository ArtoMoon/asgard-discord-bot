const { ActivityType } = require('discord.js');
const Logger = require('../../utils/logger');
const { registerSlashCommands } = require('../../handlers/commandHandler');
const { logMemoryUsage } = require('../../utils/memoryManager');
const UserProfile = require('../../models/UserProfile');
const GuildSettings = require('../../models/GuildSettings');
const { RankManager } = require('../../utils/rankManager');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    Logger.system(`==========================================`);
    Logger.system(`👑 Asgard Bot Aktif Edildi!`);
    Logger.system(`Giriş Yapılan Bot: ${client.user.tag} (ID: ${client.user.id})`);
    Logger.system(`Bağlı Sunucular: ${client.guilds.cache.size}`);
    Logger.system(`==========================================`);

    // Set rich presence
    client.user.setPresence({
      activities: [{
        name: '👑 Asgard Diyarı | /yardim',
        type: ActivityType.Watching
      }],
      status: 'online'
    });

    // Register Slash Commands
    await registerSlashCommands(client);

    // Initial memory log
    logMemoryUsage();

    // Memory log every 30 minutes
    setInterval(() => {
      logMemoryUsage();
    }, 30 * 60 * 1000).unref();

    // Periodic Voice XP Interval (Every 5 minutes, award XP for members currently in voice)
    setInterval(async () => {
      try {
        for (const guild of client.guilds.cache.values()) {
          const settings = await GuildSettings.findOne({ guildId: guild.id });
          if (!settings) continue;

          for (const [memberId, member] of guild.members.cache.entries()) {
            if (member.user.bot) continue;
            const vs = member.voice;
            // Member must be in a non-AFK voice channel and not deafened
            if (vs && vs.channelId && !vs.deaf && !vs.selfDeaf && vs.channelId !== guild.afkChannelId) {
              // Ensure there's more than 1 non-bot member in channel to prevent solo AFK farming
              const activeMembers = vs.channel.members.filter(m => !m.user.bot && !m.voice.deaf && !m.voice.selfDeaf);
              if (activeMembers.size >= 1) {
                let profile = await UserProfile.findOne({ guildId: guild.id, userId: memberId });
                if (!profile) {
                  profile = new UserProfile({ guildId: guild.id, userId: memberId });
                }

                const oldLevel = RankManager.calculateLevel(profile.totalXp);
                // Add 5 minutes and 25 Voice XP
                profile.voiceMinutes += 5;
                profile.totalXp += 25;
                profile.weekly.voiceMinutes += 5;
                profile.weekly.xp += 25;

                const newLevel = RankManager.calculateLevel(profile.totalXp);
                profile.level = newLevel;

                // Eğer kullanıcı yetkili kadrosundaysa ses mesaisi için +10 Yetkili Puanı ekle ve terfi kontrolü yap
                if (RankManager.isMemberStaff(member, settings, profile)) {
                  await RankManager.addStaffAction(guild, member, profile, settings, 'VOICE');
                }

                // Check milestone rank up
                if (newLevel > oldLevel) {
                  const oldMilestone = RankManager.getHighestMilestoneReached(oldLevel);
                  const newMilestone = RankManager.getHighestMilestoneReached(newLevel);

                  if (newMilestone && (!oldMilestone || newMilestone.level > oldMilestone.level)) {
                    profile.currentRank = newMilestone.level;
                    const levelRoles = settings.levelRoles || [];
                    const milestoneRoleConfig = levelRoles.find(r => r.level === newMilestone.level)
                      || (settings.ranks && settings.ranks.find(r => r.rank === newMilestone.level / 5 || r.rank === newMilestone.level));

                    if (milestoneRoleConfig && milestoneRoleConfig.roleId) {
                      await member.roles.add(milestoneRoleConfig.roleId).catch(() => null);
                    }
                    Logger.info(`[Seviye Yükseldi] ${member.user.tag} yeni seviye hedefine ulaştı: Seviye ${newMilestone.level} (Ses XP ile)`);
                  }

                  const logChannelId = settings.levelLogChannelId || settings.rankLogChannelId;
                  if (logChannelId) {
                    const embed = {
                      color: 0x5865F2,
                      title: '🔊 SES AKTİFLİĞİ: SEVİYE YÜKSELDİ!',
                      description: `Tebrikler ${member}! Ses kanallarında aktif kalarak seviye atladın!\n\n` +
                        `⭐ **Yeni Seviye:** **Seviye ${newLevel}**\n` +
                        `🎙️ **Toplam Ses Süresi:** ${profile.voiceMinutes} dakika\n` +
                        `✨ **Toplam XP:** ${profile.totalXp} XP`,
                      timestamp: new Date().toISOString()
                    };
                    await Logger.sendGuildLog(guild, logChannelId, embed).catch(() => null);
                  }
                }

                await profile.save();
              }
            }
          }
        }
      } catch (err) {
        Logger.error('Voice XP periyodik kontrolünde hata:', err.message);
      }
    }, 5 * 60 * 1000).unref();
  }
};
