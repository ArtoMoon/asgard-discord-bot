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
      // 2. VOICE SESSION TRACKING (XP ready.js üzerinden her 5 dakikada bir güvenli verilir)
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
        profile.voiceJoinedAt = null;
        await profile.save();
      }
    } catch (err) {
      Logger.error('voiceStateUpdate işleminde hata:', err);
    }
  }
};
