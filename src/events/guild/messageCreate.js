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

        const earnedXp = Math.floor(Math.random() * 8) + 8; // 8-15 XP (Dengeli XP)

        const oldLevel = RankManager.calculateLevel(profile.totalXp);
        profile.messageCount += 1;
        profile.totalXp += earnedXp;
        profile.weekly.messages += 1;
        profile.weekly.xp += earnedXp;

        const newLevel = RankManager.calculateLevel(profile.totalXp);
        profile.level = newLevel;

        // Eğer kullanıcı yetkili kadrosundaysa sohbet denetimi için +3 Yetkili Puanı ekle ve terfi kontrolü yap
        if (RankManager.isMemberStaff(message.member, settings, profile)) {
          await RankManager.addStaffAction(message.guild, message.member, profile, settings, 'MESSAGE');
        }

        // Seviye 5, 10, 20, 30, 40, 50 rol senkronizasyonu (Her zaman kontrol et, rolü eksikse ver!)
        const roleSync = await RankManager.syncMemberLevelRole(message.guild, message.member, newLevel, settings);

        // Her Level Atladığında (veya yeni bir seviye rolü kazandığında) Log At!
        if (newLevel > oldLevel || roleSync.roleUpdated) {
          const awardedMilestone = roleSync.milestone;
          const nextMilestone = RankManager.getLevelMilestones().find(m => m.level > newLevel);

          const levelUpEmbed = new EmbedBuilder()
            .setColor(awardedMilestone ? awardedMilestone.color : config.colors.primary)
            .setTitle(roleSync.roleUpdated ? `👑 [SEVİYE ${awardedMilestone.level}] YENİ SEVİYE ROLÜ VERİLDİ!` : `⚡ TEBRİKLER! SEVİYE ATLADIN!`)
            .setDescription(
              `Tebrikler ${message.author}! Asgard diyarındaki aktifliğinle yükseldin!\n\n` +
              `📊 **Eski Seviye:** Seviye ${oldLevel}\n` +
              `⭐ **Yeni Seviye:** **Seviye ${newLevel}**\n` +
              (awardedMilestone ? `🎁 **Mevcut Seviye Yetkisi:** **${awardedMilestone.perk}**\n` : '') +
              (roleSync.assignedRoleId ? `🛡️ **Seviye Rolü:** <@&${roleSync.assignedRoleId}>\n` : '') +
              (nextMilestone ? `🎯 **Sonraki Rol Hedefi:** Seviye ${nextMilestone.level} (${nextMilestone.perk})\n\n` : '\n') +
              `💬 **Toplam Mesaj:** **${profile.messageCount}**\n` +
              `🎙️ **Toplam Ses:** **${profile.voiceMinutes} dk**\n` +
              `✨ **Toplam XP:** **${profile.totalXp.toLocaleString()} XP**`
            )
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Asgard Seviye & Rol Sistemi • 5, 10, 20, 30, 40, 50' })
            .setTimestamp();

          // Sohbete bildir
          await message.channel.send({
            content: roleSync.roleUpdated
              ? `🎉 ${message.author} **Seviye ${newLevel}** oldu ve <@&${roleSync.assignedRoleId}> rolünü kazandı!`
              : `🎉 ${message.author} **Seviye ${newLevel}** oldu!`,
            embeds: [levelUpEmbed]
          }).catch(() => null);

          // Seviye-Log kanalına her levelde log at
          const logChannelId = settings.levelLogChannelId || settings.rankLogChannelId || settings.modLogChannelId;
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
