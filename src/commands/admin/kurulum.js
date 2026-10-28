const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const { ASGARD_RANKS } = require('../../utils/rankManager');
const Logger = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  name: 'kurulum',
  aliases: ['setup', 'oto-kurulum'],
  description: '10 Asgard rütbesini, ses ve kayıt kanallarını, yetki ve jail rollerini otomatik oluşturur.',
  data: new SlashCommandBuilder()
    .setName('kurulum')
    .setDescription('Tüm Asgard rollerini ve kanallarını tek seferde otomatik oluşturur.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute({ client, message, interaction, isSlash, guild, member, user, channel, args, reply }) {
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      return reply({ content: '❌ Bu komutu yalnızca **Yönetici (Administrator)** yetkisine sahip kullanıcılar çalıştırabilir!', ephemeral: true });
    }

    if (isSlash) {
      await interaction.deferReply();
    } else {
      await channel.send('⏳ **Asgard Otomatik Kurulumu Başlatılıyor...** Lütfen bekleyin...');
    }

    try {
      let settings = await GuildSettings.findOne({ guildId: guild.id });
      if (!settings) {
        settings = new GuildSettings({ guildId: guild.id });
      }

      const createdRoles = [];
      const createdChannels = [];

      // ============================================
      // 1. ASGARD 10 RÜTBE ROLLERİNİ OLUŞTUR / GÜNCELLE
      // ============================================
      const rankMappings = [];

      for (const rankDef of ASGARD_RANKS) {
        let existingRole = guild.roles.cache.find(r => r.name.toLowerCase() === rankDef.roleName.toLowerCase());

        if (!existingRole) {
          existingRole = await guild.roles.create({
            name: rankDef.roleName,
            colors: { primaryColor: rankDef.color },
            hoist: true,
            reason: 'Asgard Otomatik Rütbe Kurulumu'
          });
          createdRoles.push(`👑 ${existingRole.name}`);
        } else {
          createdRoles.push(`ℹ️ ${existingRole.name} *(Mevcut)*`);
        }

        rankMappings.push({
          rank: rankDef.rank,
          roleId: existingRole.id,
          name: rankDef.name
        });
      }

      settings.ranks = rankMappings;

      // ============================================
      // 2. SİSTEM ROLLERİ OLUŞTUR (Kayıtsız, Üye, Jail, Staff)
      // ============================================
      // A) Kayıtsız Rolü
      let unverifiedRole = guild.roles.cache.find(r => r.name === 'Kayıtsız');
      if (!unverifiedRole) {
        unverifiedRole = await guild.roles.create({
          name: 'Kayıtsız',
          colors: { primaryColor: '#7f8c8d' },
          reason: 'Asgard Kayıt Sistemi'
        });
        createdRoles.push(`📜 ${unverifiedRole.name}`);
      }
      settings.unverifiedRoleId = unverifiedRole.id;
      settings.autoRoleId = unverifiedRole.id;

      // B) Asgard Halkı (Kayıtlı Üye) Rolü
      let memberRole = guild.roles.cache.find(r => r.name === 'Asgard Halkı');
      if (!memberRole) {
        memberRole = await guild.roles.create({
          name: 'Asgard Halkı',
          colors: { primaryColor: '#2ecc71' },
          reason: 'Asgard Kayıtlı Üye Rolü'
        });
        createdRoles.push(`👥 ${memberRole.name}`);
      }
      settings.registeredRoleId = memberRole.id;

      // C) Jail / Cezalı Rolü
      let jailRole = guild.roles.cache.find(r => r.name === 'Cezalı / Jail');
      if (!jailRole) {
        jailRole = await guild.roles.create({
          name: 'Cezalı / Jail',
          colors: { primaryColor: '#111111' },
          reason: 'Asgard Moderasyon Jail Rolü'
        });
        createdRoles.push(`⛓️ ${jailRole.name}`);
      }
      settings.jailRoleId = jailRole.id;

      // D) Staff / Yetkili Rolü
      let staffRole = guild.roles.cache.find(r => r.name === 'Asgard Muhafız Konseyi');
      if (!staffRole) {
        staffRole = await guild.roles.create({
          name: 'Asgard Muhafız Konseyi',
          colors: { primaryColor: '#e74c3c' },
          reason: 'Asgard Yetkili Rolü'
        });
        createdRoles.push(`🛡️ ${staffRole.name}`);
      }
      if (!settings.staffRoleIds.includes(staffRole.id)) {
        settings.staffRoleIds.push(staffRole.id);
      }

      // ============================================
      // 3. KANALLARI OLUŞTUR
      // ============================================
      // A) Yönetim & Kayıt Kategorisi
      let adminCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === '📜 ASGARD YÖNETİM & KAYIT');
      if (!adminCategory) {
        adminCategory = await guild.channels.create({
          name: '📜 ASGARD YÖNETİM & KAYIT',
          type: ChannelType.GuildCategory
        });
        createdChannels.push(`📁 ${adminCategory.name}`);
      }

      // Hoş Geldin Kanalı
      let welcomeChannel = guild.channels.cache.find(c => c.name === '💬・hoş-geldin');
      if (!welcomeChannel) {
        welcomeChannel = await guild.channels.create({
          name: '💬・hoş-geldin',
          type: ChannelType.GuildText,
          parent: adminCategory.id
        });
        createdChannels.push(`💬 ${welcomeChannel.name}`);
      }
      settings.welcomeChannelId = welcomeChannel.id;

      // Developer Onay Kanalı (Gizli Kanal)
      let approvalChannel = guild.channels.cache.find(c => c.name === '👑・developer-onay');
      if (!approvalChannel) {
        approvalChannel = await guild.channels.create({
          name: '👑・developer-onay',
          type: ChannelType.GuildText,
          parent: adminCategory.id,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: member.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            }
          ]
        });
        createdChannels.push(`🔒 ${approvalChannel.name}`);
      }
      settings.approvalChannelId = approvalChannel.id;

      // Mod Log Kanalı
      let modLogChannel = guild.channels.cache.find(c => c.name === '🛡️・mod-log');
      if (!modLogChannel) {
        modLogChannel = await guild.channels.create({
          name: '🛡️・mod-log',
          type: ChannelType.GuildText,
          parent: adminCategory.id
        });
        createdChannels.push(`🛡️ ${modLogChannel.name}`);
      }
      settings.modLogChannelId = modLogChannel.id;

      // Rütbe Log Kanalı
      let rankLogChannel = guild.channels.cache.find(c => c.name === '⚔️・rütbe-log');
      if (!rankLogChannel) {
        rankLogChannel = await guild.channels.create({
          name: '⚔️・rütbe-log',
          type: ChannelType.GuildText,
          parent: adminCategory.id
        });
        createdChannels.push(`⚔️ ${rankLogChannel.name}`);
      }
      settings.rankLogChannelId = rankLogChannel.id;

      // B) Ses Odaları Kategorisi & Join-to-Create
      let voiceCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === '🔊 ASGARD SES ODALARI');
      if (!voiceCategory) {
        voiceCategory = await guild.channels.create({
          name: '🔊 ASGARD SES ODALARI',
          type: ChannelType.GuildCategory
        });
        createdChannels.push(`📁 ${voiceCategory.name}`);
      }
      settings.tempVoiceCategoryId = voiceCategory.id;

      let j2cChannel = guild.channels.cache.find(c => c.name === '➕ Ses Odası Oluştur' && c.type === ChannelType.GuildVoice);
      if (!j2cChannel) {
        j2cChannel = await guild.channels.create({
          name: '➕ Ses Odası Oluştur',
          type: ChannelType.GuildVoice,
          parent: voiceCategory.id
        });
        createdChannels.push(`🔊 ${j2cChannel.name}`);
      }
      settings.joinToCreateChannelId = j2cChannel.id;

      // Ensure bot runner is registered as developer if list empty
      if (!settings.developerUserIds.includes(user.id)) {
        settings.developerUserIds.push(user.id);
      }

      await settings.save();

      const resultEmbed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('✅ ASGARD OTOMATİK KURULUM TAMAMLANDI!')
        .setDescription(
          `Sunucunuz için 10 Asgard rütbesi, oto-rol, kayıt kanalı, developer onay logu ve geçici ses odası sistemi başarıyla kuruldu ve **MongoDB** veri tabanına kaydedildi!\n\n` +
          `Artık hiçbir rolü veya kanalı elle ayarlamanıza gerek kalmadı.`
        )
        .addFields(
          {
            name: '👑 Oluşturulan / Doğrulanan 10 Asgard Rütbesi',
            value: rankMappings.map(r => `• **Rütbe ${r.rank}:** <@&${r.roleId}> (${r.name})`).join('\n')
          },
          {
            name: '🛡️ Sistem Rolleri',
            value:
              `• **Oto-Rol & Kayıtsız:** <@&${settings.unverifiedRoleId}>\n` +
              `• **Kayıtlı Üye:** <@&${settings.registeredRoleId}>\n` +
              `• **Jail Rolü:** <@&${settings.jailRoleId}>\n` +
              `• **Yetkili Rolü:** <@&${staffRole.id}>`
          },
          {
            name: '📁 Oluşturulan Kanallar',
            value:
              `• **Hoş Geldin Kanalı:** <#${settings.welcomeChannelId}>\n` +
              `• **Developer Onay Log:** <#${settings.approvalChannelId}>\n` +
              `• **Mod Log:** <#${settings.modLogChannelId}>\n` +
              `• **Rütbe Log:** <#${settings.rankLogChannelId}>\n` +
              `• **Özel Oda Oluşturucu:** <#${settings.joinToCreateChannelId}>`
          }
        )
        .setFooter({ text: 'Asgard Krallığı Otomatik Sistem', iconURL: guild.iconURL() })
        .setTimestamp();

      if (isSlash) {
        await interaction.editReply({ embeds: [resultEmbed] });
      } else {
        await channel.send({ embeds: [resultEmbed] });
      }

      Logger.success(`[Kurulum] ${guild.name} sunucusunda Asgard kurulumu başarıyla tamamlandı.`);
    } catch (err) {
      Logger.error('Kurulum sırasında hata oluştu:', err);
      const errMsg = `❌ Kurulum sırasında bir hata oluştu: ${err.message}`;
      if (isSlash) {
        await interaction.editReply({ content: errMsg }).catch(() => null);
      } else {
        await channel.send(errMsg).catch(() => null);
      }
    }
  }
};
