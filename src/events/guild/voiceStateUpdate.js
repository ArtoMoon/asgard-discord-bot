const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const TempChannel = require('../../models/TempChannel');
const UserProfile = require('../../models/UserProfile');
const Logger = require('../../utils/logger');
const config = require('../../config');
const { RankManager } = require('../../utils/rankManager');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(client, oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guild = newState.guild || oldState.guild;

    try {
      let settings = await GuildSettings.findOne({ guildId: guild.id });
      if (!settings) {
        settings = await GuildSettings.create({ guildId: guild.id });
      }

      // ==========================================
      // 1. JOIN TO CREATE (Özel Ses Odası Sistemi)
      // ==========================================
      let joinToCreateId = settings.joinToCreateChannelId;

      // Auto-detect master voice channel if not configured or changed
      if (!joinToCreateId || !guild.channels.cache.has(joinToCreateId)) {
        const found = guild.channels.cache.find(c =>
          c.type === ChannelType.GuildVoice &&
          (c.name.includes('Ses Odası Oluştur') || c.name.includes('Oda Oluştur'))
        );
        if (found) {
          joinToCreateId = found.id;
          settings.joinToCreateChannelId = found.id;
          if (found.parentId) settings.tempVoiceCategoryId = found.parentId;
          await settings.save().catch(() => null);
          Logger.info(`[Geçici Oda] '${found.name}' kanalı otomatik tespit edildi ve ayarlandı.`);
        }
      }

      // Member joined the master "➕ Ses Odası Oluştur" channel
      if (newState.channelId && newState.channelId === joinToCreateId) {
        Logger.info(`[Geçici Oda] ${member.user.tag} oda oluşturucu kanalına girdi. Yeni oda hazırlanıyor...`);

        const categoryId = settings.tempVoiceCategoryId || newState.channel?.parentId;

        const botMember = await guild.members.fetchMe().catch(() => null);
        if (botMember && !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
          Logger.error('[Geçici Oda] Botun "Kanalları Yönet (Manage Channels)" yetkisi YOK!');
        }
        if (botMember && !botMember.permissions.has(PermissionFlagsBits.MoveMembers)) {
          Logger.error('[Geçici Oda] Botun "Üyeleri Taşı (Move Members)" yetkisi YOK!');
        }

        const newChannel = await guild.channels.create({
          name: `🔊・${member.displayName}'in Odası`,
          type: ChannelType.GuildVoice,
          parent: categoryId || undefined,
          permissionOverwrites: [
            {
              id: guild.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
            },
            {
              id: member.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers
              ]
            }
          ]
        });

        // Move member to the newly created channel
        await newState.setChannel(newChannel).catch(err => {
          Logger.error('Kullanıcı yeni oluşturulan ses kanalına taşınamadı:', err.message);
        });

        // Register in DB
        await TempChannel.create({
          guildId: guild.id,
          channelId: newChannel.id,
          ownerId: member.id
        });

        Logger.info(`[Geçici Oda] ${member.user.tag} için ${newChannel.name} kanalı oluşturuldu ve kullanıcı taşındı.`);
      }

      // Check if someone left a channel, and see if it's a temporary channel that is now empty (0 members)
      if (oldState.channelId && oldState.channelId !== newState.channelId) {
        const tempRecord = await TempChannel.findOne({ channelId: oldState.channelId });
        if (tempRecord) {
          const oldChannel = guild.channels.cache.get(oldState.channelId);
          if (oldChannel && oldChannel.members.size === 0) {
            await oldChannel.delete().catch(err => {
              Logger.error(`Geçici kanal silinirken hata: ${err.message}`);
            });
            await TempChannel.deleteOne({ channelId: oldState.channelId });
            Logger.info(`[Geçici Oda] ${oldChannel.name} boşaldığı için otomatik silindi.`);
          }
        }
      }

      // ==========================================
      // 2. VOICE XP ENGINE
      // ==========================================
      let profile = await UserProfile.findOne({ guildId: guild.id, userId: member.id });
      if (!profile) {
        profile = new UserProfile({ guildId: guild.id, userId: member.id });
      }

      // User joined a voice channel
      if (!oldState.channelId && newState.channelId) {
        profile.voiceJoinedAt = new Date();
        await profile.save();
      }
      // User left voice channel
      else if (oldState.channelId && !newState.channelId) {
        if (profile.voiceJoinedAt) {
          const now = Date.now();
          const joinedTime = new Date(profile.voiceJoinedAt).getTime();
          const elapsedMinutes = Math.floor((now - joinedTime) / 60000);

          if (elapsedMinutes >= 1) {
            const earnedXp = elapsedMinutes * 5; // 5 XP per minute

            profile.voiceMinutes += elapsedMinutes;
            profile.totalXp += earnedXp;
            profile.weekly.voiceMinutes += elapsedMinutes;
            profile.weekly.xp += earnedXp;

            // Check rank up
            const eligible = RankManager.calculateEligibleRank(profile.weekly);
            if (eligible.rank > profile.currentRank) {
              const oldRank = RankManager.getRankByLevel(profile.currentRank);
              profile.currentRank = eligible.rank;

              const rankConfig = settings.ranks.find(r => r.rank === eligible.rank);
              if (rankConfig && rankConfig.roleId) {
                const role = guild.roles.cache.get(rankConfig.roleId);
                if (role) {
                  await member.roles.add(role).catch(() => null);
                }
              }

              // Send rank up embed to log channel
              if (settings.rankLogChannelId) {
                const rankUpEmbed = new EmbedBuilder()
                  .setColor(eligible.color || config.colors.gold)
                  .setTitle('⚔️ ASGARD DİYARINDA SESLİ YÜKSELİŞ!')
                  .setDescription(`Tebrikler ${member}! Ses kanallarındaki aktifliğinle rütbe atladın!\n\n` +
                    `🛡️ **Eski Rütbe:** ${oldRank.name}\n` +
                    `👑 **Yeni Rütbe:** ${eligible.name} (Rütbe ${eligible.rank})\n\n` +
                    `🎙️ **Toplam Ses Süresi:** ${profile.voiceMinutes} dakika\n` +
                    `🎁 **Açılan Ayrıcalıklar:**\n${eligible.perks.map(p => `• ${p}`).join('\n')}`)
                  .setFooter({ text: 'Asgard Krallığı Rütbe Sistemi', iconURL: guild.iconURL() })
                  .setTimestamp();

                await Logger.sendGuildLog(guild, settings.rankLogChannelId, rankUpEmbed);
              }
            }
          }

          profile.voiceJoinedAt = null;
          await profile.save();
        }
      }
    } catch (err) {
      Logger.error('voiceStateUpdate işleminde hata:', err);
    }
  }
};
