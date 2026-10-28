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

    // 2. Chat XP & Leveling Engine
    const memberId = message.author.id;
    const rateLimitKey = `chat_xp_${message.guild.id}_${memberId}`;

    if (!chatXpLimiter.isRateLimited(rateLimitKey)) {
      try {
        let profile = await UserProfile.findOne({ guildId: message.guild.id, userId: memberId });
        if (!profile) {
          profile = new UserProfile({ guildId: message.guild.id, userId: memberId });
        }

        const earnedXp = Math.floor(Math.random() * 11) + 15; // 15-25 XP

        profile.messageCount += 1;
        profile.totalXp += earnedXp;
        profile.weekly.messages += 1;
        profile.weekly.xp += earnedXp;

        // Check for Rank Progression
        const eligible = RankManager.calculateEligibleRank(profile.weekly);

        if (eligible.rank > profile.currentRank) {
          const oldRank = RankManager.getRankByLevel(profile.currentRank);
          profile.currentRank = eligible.rank;

          // Assign role if configured
          const rankConfig = settings.ranks.find(r => r.rank === eligible.rank);
          if (rankConfig && rankConfig.roleId) {
            const role = message.guild.roles.cache.get(rankConfig.roleId);
            if (role) {
              await message.member.roles.add(role).catch(err => {
                Logger.error('Rütbe rolü verilemedi:', err.message);
              });
            }
          }

          // Announce Level Up
          const rankUpEmbed = new EmbedBuilder()
            .setColor(eligible.color || config.colors.gold)
            .setTitle('⚔️ ASGARD DİYARINDA YÜKSELİŞ!')
            .setDescription(`Tebrikler ${message.author}! Asgard diyarındaki gayretinle rütbe atladın!\n\n` +
              `🛡️ **Eski Rütbe:** ${oldRank.name}\n` +
              `👑 **Yeni Rütbe:** ${eligible.name} (Rütbe ${eligible.rank})\n\n` +
              `🎁 **Açılan Ayrıcalıklar:**\n${eligible.perks.map(p => `• ${p}`).join('\n')}`)
            .setFooter({ text: 'Asgard Krallığı Rütbe Sistemi', iconURL: message.guild.iconURL() })
            .setTimestamp();

          await message.channel.send({ embeds: [rankUpEmbed] }).catch(() => null);

          // Also log to rank log channel if configured
          if (settings.rankLogChannelId) {
            await Logger.sendGuildLog(message.guild, settings.rankLogChannelId, rankUpEmbed);
          }
        }

        await profile.save();
      } catch (err) {
        Logger.error('Mesaj XP hesaplanırken hata:', err.message);
      }
    }
  }
};
