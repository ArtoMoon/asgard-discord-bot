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
            // Member must be in a non-AFK voice channel and not deafened or muted
            if (vs && vs.channelId && !vs.deaf && !vs.selfDeaf && !vs.selfMute && !vs.serverMute && vs.channelId !== guild.afkChannelId) {
              const activeMembers = vs.channel.members.filter(m => !m.user.bot && !m.voice.deaf && !m.voice.selfDeaf);
              if (activeMembers.size >= 1) {
                let profile = await UserProfile.findOne({ guildId: guild.id, userId: memberId });
                if (!profile) {
                  profile = new UserProfile({ guildId: guild.id, userId: memberId });
                }

                const oldLevel = RankManager.calculateLevel(profile.totalXp);
                // Her 5 dakikada 10 Ses XP (Dakikada 2 XP - Çok kolay kasılmaması için dengelendi)
                profile.voiceMinutes += 5;
                profile.totalXp += 10;
                profile.weekly.voiceMinutes += 5;
                profile.weekly.xp += 10;

                const newLevel = RankManager.calculateLevel(profile.totalXp);
                profile.level = newLevel;

                // Eğer kullanıcı yetkili kadrosundaysa ses mesaisi için +10 Yetkili Puanı ekle ve terfi kontrolü yap
                if (RankManager.isMemberStaff(member, settings, profile)) {
                  await RankManager.addStaffAction(guild, member, profile, settings, 'VOICE');
                }

                // Seviye 5, 10, 20, 30, 40, 50 rol senkronizasyonu (5 olunca veya üstündeyse rolünü kesin verir!)
                const roleSync = await RankManager.syncMemberLevelRole(guild, member, newLevel, settings);

                // Her level atladığında veya yeni rol verildiğinde seviye-log kanalına log at!
                if (newLevel > oldLevel || roleSync.roleUpdated) {
                  const awardedMilestone = roleSync.milestone;
                  const nextMilestone = RankManager.getLevelMilestones().find(m => m.level > newLevel);

                  const logChannelId = settings.levelLogChannelId || settings.rankLogChannelId || settings.modLogChannelId;
                  if (logChannelId) {
                    const embed = {
                      color: awardedMilestone ? parseInt(awardedMilestone.color.replace('#', ''), 16) : 0x5865F2,
                      title: roleSync.roleUpdated
                        ? `👑 [SES AKTİFLİĞİ - SEVİYE ${awardedMilestone.level}] YENİ ROL KAZANILDI!`
                        : '🔊 SES AKTİFLİĞİ: SEVİYE YÜKSELDİ!',
                      description:
                        `Tebrikler ${member}! Ses kanallarında aktif kalarak yükseldin!\n\n` +
                        `📊 **Eski Seviye:** Seviye ${oldLevel}\n` +
                        `⭐ **Yeni Seviye:** **Seviye ${newLevel}**\n` +
                        (awardedMilestone ? `🎁 **Mevcut Seviye Yetkisi:** **${awardedMilestone.perk}**\n` : '') +
                        (roleSync.assignedRoleId ? `🛡️ **Verilen Seviye Rolü:** <@&${roleSync.assignedRoleId}>\n` : '') +
                        (nextMilestone ? `🎯 **Sonraki Rol Hedefi:** Seviye ${nextMilestone.level} (${nextMilestone.perk})\n\n` : '\n') +
                        `🎙️ **Toplam Ses Süresi:** ${profile.voiceMinutes} dakika\n` +
                        `💬 **Toplam Mesaj:** ${profile.messageCount} mesaj\n` +
                        `✨ **Toplam XP:** ${profile.totalXp.toLocaleString()} XP`,
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
