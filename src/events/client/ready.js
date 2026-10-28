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

                // Add 5 minutes and 25 Voice XP
                profile.voiceMinutes += 5;
                profile.totalXp += 25;
                profile.weekly.voiceMinutes += 5;
                profile.weekly.xp += 25;

                // Check rank up
                const eligible = RankManager.calculateEligibleRank(profile.weekly);
                if (eligible.rank > profile.currentRank) {
                  profile.currentRank = eligible.rank;
                  const rankConfig = settings.ranks.find(r => r.rank === eligible.rank);
                  if (rankConfig && rankConfig.roleId) {
                    await member.roles.add(rankConfig.roleId).catch(() => null);
                  }
                  Logger.info(`[Rütbe Yükseldi] ${member.user.tag} yeni rütbeye ulaştı: ${eligible.name} (Ses XP ile)`);
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
