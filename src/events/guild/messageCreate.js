const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const Logger = require('../../utils/logger');
const GuildSettings = require('../../models/GuildSettings');
const UserProfile = require('../../models/UserProfile');
const { MemoryRateLimiter } = require('../../utils/memoryManager');
const { RankManager } = require('../../utils/rankManager');

// Rate limiter for Chat XP (1 message per 60 seconds gives XP)
const chatXpLimiter = new MemoryRateLimiter(60000);

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    if (!message.guild || message.author.bot) return;

    let settings = await GuildSettings.findOne({ guildId: message.guild.id });
    if (!settings) {
      settings = await GuildSettings.create({ guildId: message.guild.id });
    }

    const prefix = settings.prefix || config.defaultPrefix;

    // Check if message starts with prefix
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift()?.toLowerCase();

      if (commandName) {
        const cmdName = client.aliases.get(commandName) || commandName;
        const command = client.commands.get(cmdName);

        if (command) {
          const reply = async (options) => {
            return message.reply(options);
          };

          try {
            await command.execute({
              client,
              message,
              interaction: null,
              isSlash: false,
              guild: message.guild,
              member: message.member,
              user: message.author,
              channel: message.channel,
              args,
              reply
            });
          } catch (err) {
            Logger.error(`Prefix komut hatası (${commandName}):`, err);
            await message.reply('❌ Komut çalıştırılırken bir hata oluştu!').catch(() => null);
          }
          return;
        }
      }
    }

    // 2. Chat XP & Leveling Engine (Seviye 1-50 & Her 10 Seviyede Rol Güncelleme)
    const memberId = message.author.id;
    const rateLimitKey = `chat_xp_${message.guild.id}_${memberId}`;

    if (!chatXpLimiter.isRateLimited(rateLimitKey)) {
      try {
        let profile = await UserProfile.findOne({ guildId: message.guild.id, userId: memberId });
        if (!profile) {
          profile = new UserProfile({ guildId: message.guild.id, userId: memberId });
        }

        const earnedXp = Math.floor(Math.random() * 11) + 15; // 15-25 XP

        const oldLevel = profile.level || RankManager.calculateLevel(profile.totalXp);
        profile.messageCount += 1;
        profile.totalXp += earnedXp;
        profile.weekly.messages += 1;
        profile.weekly.xp += earnedXp;

        const newLevel = RankManager.calculateLevel(profile.totalXp);
        profile.level = newLevel;

        // Level Up Trigger
        if (newLevel > oldLevel) {
          const oldMilestone = RankManager.getHighestMilestoneReached(oldLevel);
          const newMilestone = RankManager.getHighestMilestoneReached(newLevel);

          let awardedMilestone = null;
          let roleUpdated = false;
          let assignedRoleId = null;

          // Milestone check every 10 levels (10, 20, 30, 40, 50)
          if (newMilestone && (!oldMilestone || newMilestone.level > oldMilestone.level)) {
            awardedMilestone = newMilestone;
            profile.currentRank = newMilestone.level;

            // Find milestone role in settings
            const levelRoles = settings.levelRoles || [];
            let milestoneRoleConfig = levelRoles.find(r => r.level === newMilestone.level);

            // Backward compatibility fallback to ranks
            if (!milestoneRoleConfig && settings.ranks) {
              milestoneRoleConfig = settings.ranks.find(r => r.rank === newMilestone.level / 5 || r.rank === newMilestone.level);
            }

            if (milestoneRoleConfig && milestoneRoleConfig.roleId) {
              const roleToAdd = message.guild.roles.cache.get(milestoneRoleConfig.roleId);
              if (roleToAdd) {
                await message.member.roles.add(roleToAdd).catch(err => {
                  Logger.error('Seviye rolü verilemedi:', err.message);
                });
                roleUpdated = true;
                assignedRoleId = milestoneRoleConfig.roleId;
              }
            }
          }

          // Build Level Up Embed
          const levelUpEmbed = new EmbedBuilder()
            .setColor(awardedMilestone ? awardedMilestone.color : config.colors.primary)
            .setTitle(awardedMilestone ? `👑 [SEVİYE ${newMilestone.level}] YENİ AYRICALIK & ROL KAZANILDI!` : `⚡ TEBRİKLER! SEVİYE ATLADIN!`)
            .setDescription(`Tebrikler ${message.author}! Asgard diyarındaki aktifliğinle yükseldin!\n\n` +
              `📊 **Eski Seviye:** Seviye ${oldLevel}\n` +
              `⭐ **Yeni Seviye:** **Seviye ${newLevel}**\n\n` +
              (awardedMilestone ? `🎁 **Açılan Ayrıcalık:** **${awardedMilestone.perk}**\n` : '') +
              (roleUpdated && assignedRoleId ? `🛡️ **Verilen Rol:** <@&${assignedRoleId}>\n\n` : '\n') +
              `💬 **Toplam Mesaj:** **${profile.messageCount}**\n` +
              `✨ **Toplam XP:** **${profile.totalXp.toLocaleString()} XP**`)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Asgard Seviye & Terfi Sistemi' })
            .setTimestamp();

          // Announce in chat
          await message.channel.send({
            content: `🎉 ${message.author} **Seviye ${newLevel}** oldu!`,
            embeds: [levelUpEmbed]
          }).catch(() => null);

          // Log to seviye-log channel
          const logChannelId = settings.levelLogChannelId || settings.rankLogChannelId;
          if (logChannelId) {
            await Logger.sendGuildLog(message.guild, logChannelId, levelUpEmbed);
          }
        }

        await profile.save();
      } catch (err) {
        Logger.error('Mesaj XP hesaplanırken hata:', err.message);
      }
    }
  }
};
