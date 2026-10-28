const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const { ASGARD_RANKS, LEVEL_MILESTONES } = require('../../utils/rankManager');
const Logger = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  name: 'kurulum',
  aliases: ['setup', 'oto-kurulum'],
  description: '10 Asgard rütbesini, seviye rollerini, ses ve kayıt kanallarını otomatik eşleştirir (varsa yeni açmaz).',
  data: new SlashCommandBuilder()
    .setName('kurulum')
    .setDescription('Tüm Asgard rollerini ve kanallarını kontrol eder, sadece eksikleri oluşturur.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute({ client, message, interaction, isSlash, guild, member, user, channel, args, reply }) {
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      return reply({ content: '❌ Bu komutu yalnızca **Yönetici (Administrator)** yetkisine sahip kullanıcılar çalıştırabilir!', ephemeral: true });
    }

    if (isSlash) {
      await interaction.deferReply();
    } else {
      await channel.send('⏳ **Asgard Akıllı Kurulum Başlatılıyor...** Mevcut roller ve kanallar taranıyor (var olanlar yeniden açılmaz)...');
    }

    try {
      // Önce sunucudaki tüm rol ve kanalları güncel olarak çek (Cache eksikliği yüzünden çift açılmasın!)
      await guild.roles.fetch();
      await guild.channels.fetch();

      let settings = await GuildSettings.findOne({ guildId: guild.id });
      if (!settings) {
        settings = new GuildSettings({ guildId: guild.id });
      }

      const createdRoles = [];
      const createdChannels = [];

      // Yardımcı: Rol bulucu (Önce kayıtlı ID'ye bakar, sonra tam isme, sonra anahtar kelimeye bakar)
      const findExistingRole = (savedId, namesToMatch = [], keyword = null) => {
        if (savedId && guild.roles.cache.has(savedId)) {
          return guild.roles.cache.get(savedId);
        }
        const lowerNames = namesToMatch.map(n => n.toLowerCase().trim());
        let found = guild.roles.cache.find(r => lowerNames.includes(r.name.toLowerCase().trim()));
        if (!found && keyword) {
          const kw = keyword.toLowerCase().trim();
          found = guild.roles.cache.find(r => r.name.toLowerCase().includes(kw));
        }
        return found || null;
      };

      // Yardımcı: Kanal bulucu (Önce kayıtlı ID'ye bakar, sonra tam isme, sonra anahtar kelimeye bakar)
      const findExistingChannel = (savedId, exactName, keyword, type = null) => {
        if (savedId && guild.channels.cache.has(savedId)) {
          const ch = guild.channels.cache.get(savedId);
          if (type === null || ch.type === type) return ch;
        }
        let found = guild.channels.cache.find(c =>
          (type === null || c.type === type) &&
          c.name.toLowerCase().trim() === exactName.toLowerCase().trim()
        );
        if (!found && keyword) {
          const kw = keyword.toLowerCase().trim();
          found = guild.channels.cache.find(c =>
            (type === null || c.type === type) &&
            c.name.toLowerCase().includes(kw)
          );
        }
        return found || null;
      };

      // ============================================
      // 1. ASGARD 10 YÖNETİM RÜTBESİNİ KONTROL ET / OLUŞTUR
      // ============================================
      const rankKeywords = ['thrall', 'karl', 'berserker', 'hersir', 'thegn', 'jarl', 'einherjar', 'valkyrie', 'aesir', 'odin'];
      const rankMappings = [];

      for (const rankDef of ASGARD_RANKS) {
        const savedRank = (settings.ranks || []).find(r => r.rank === rankDef.rank);
        const baseKeyword = rankKeywords[rankDef.rank - 1] || rankDef.name.split(' ')[0];

        let existingRole = findExistingRole(
          savedRank?.roleId,
          [rankDef.roleName, rankDef.name, `Asgard - ${ rankDef.name.split(' ')[0] }`],
          baseKeyword
        );

        if (!existingRole) {
          existingRole = await guild.roles.create({
            name: rankDef.roleName,
            colors: { primaryColor: rankDef.color },
            hoist: true,
            reason: 'Asgard Otomatik Rütbe Kurulumu'
          });
          createdRoles.push(`👑 ${existingRole.name} *(Yeni Açıldı)*`);
        } else {
          createdRoles.push(`ℹ️ ${existingRole.name} *(Mevcut Eşleşti)*`);
        }

        rankMappings.push({
          rank: rankDef.rank,
          roleId: existingRole.id,
          name: rankDef.name
        });
      }
      settings.ranks = rankMappings;

      // ============================================
      // 2. ÜYE SEVİYE ROLLERİNİ (5, 10, 20, 30, 40, 50) KONTROL ET / OLUŞTUR
      // ============================================
      const levelMappings = [];
      for (const m of LEVEL_MILESTONES) {
        const savedLvl = (settings.levelRoles || []).find(lr => lr.level === m.level);
        let existingLvlRole = findExistingRole(
          savedLvl?.roleId,
          [m.roleName, m.name, `Seviye ${m.level}`, `Level ${m.level}`],
          `seviye ${m.level}`
        );

        if (!existingLvlRole) {
          existingLvlRole = await guild.roles.create({
            name: m.roleName,
            colors: { primaryColor: m.color },
            hoist: true,
            reason: 'Asgard Seviye Rolü Kurulumu'
          });
          createdRoles.push(`⭐ ${existingLvlRole.name} *(Yeni Açıldı)*`);
        } else {
          createdRoles.push(`ℹ️ ${existingLvlRole.name} *(Mevcut Eşleşti)*`);
        }

        levelMappings.push({
          level: m.level,
          roleId: existingLvlRole.id,
          name: m.name,
          perk: m.perk,
          color: m.color
        });
      }
      settings.levelRoles = levelMappings;

      // ============================================
      // 3. SİSTEM ROLLERİNİ KONTROL ET (Kayıtsız, Üye, Jail, Staff)
      // ============================================
      // A) Kayıtsız Rolü
      let unverifiedRole = findExistingRole(settings.unverifiedRoleId || settings.autoRoleId, ['Kayıtsız', 'Kayitsiz', 'Unverified'], 'kayıtsız');
      if (!unverifiedRole) {
        unverifiedRole = await guild.roles.create({
          name: 'Kayıtsız',
          colors: { primaryColor: '#7f8c8d' },
          reason: 'Asgard Kayıt Sistemi'
        });
        createdRoles.push(`📜 ${unverifiedRole.name} *(Yeni Açıldı)*`);
      }
      settings.unverifiedRoleId = unverifiedRole.id;
      settings.autoRoleId = unverifiedRole.id;

      // B) Asgard Halkı (Kayıtlı Üye) Rolü
      let memberRole = findExistingRole(settings.registeredRoleId, ['Asgard Halkı', 'Üye', 'Kayıtlı Üye'], 'asgard halkı');
      if (!memberRole) {
        memberRole = await guild.roles.create({
          name: 'Asgard Halkı',
          colors: { primaryColor: '#2ecc71' },
          reason: 'Asgard Kayıtlı Üye Rolü'
        });
        createdRoles.push(`👥 ${memberRole.name} *(Yeni Açıldı)*`);
      }
      settings.registeredRoleId = memberRole.id;

      // C) Jail / Cezalı Rolü
      let jailRole = findExistingRole(settings.jailRoleId, ['Cezalı / Jail', 'Cezalı', 'Jail'], 'jail');
      if (!jailRole) {
        jailRole = await guild.roles.create({
          name: 'Cezalı / Jail',
          colors: { primaryColor: '#111111' },
          reason: 'Asgard Moderasyon Jail Rolü'
        });
        createdRoles.push(`⛓️ ${jailRole.name} *(Yeni Açıldı)*`);
      }
      settings.jailRoleId = jailRole.id;

      // D) Staff / Yetkili Rolü
      let staffRole = findExistingRole(settings.staffRoleIds?.[0], ['Asgard Muhafız Konseyi', 'Yetkili', 'Staff'], 'muhafız konseyi');
      if (!staffRole) {
        staffRole = await guild.roles.create({
          name: 'Asgard Muhafız Konseyi',
          colors: { primaryColor: '#e74c3c' },
          reason: 'Asgard Yetkili Rolü'
        });
        createdRoles.push(`🛡️ ${staffRole.name} *(Yeni Açıldı)*`);
      }
      const allStaffIds = [staffRole.id, ...rankMappings.map(r => r.roleId)];
      settings.staffRoleIds = Array.from(new Set([...(settings.staffRoleIds || []), ...allStaffIds]));

      // ============================================
      // 4. KANALLARI KONTROL ET / OLUŞTUR (Varsa Yeni Açmaz!)
      // ============================================
      // A) Yönetim & Kayıt Kategorisi
      let adminCategory = findExistingChannel(null, '📜 ASGARD YÖNETİM & KAYIT', 'yönetim & kayıt', ChannelType.GuildCategory)
        || findExistingChannel(null, '📜 ASGARD YÖNETİM & KAYIT', 'asgard yönetim', ChannelType.GuildCategory);
      if (!adminCategory) {
        adminCategory = await guild.channels.create({
          name: '📜 ASGARD YÖNETİM & KAYIT',
          type: ChannelType.GuildCategory
        });
        createdChannels.push(`📁 ${adminCategory.name}`);
      }

      // Hoş Geldin Kanalı
      let welcomeChannel = findExistingChannel(settings.welcomeChannelId, '💬・hoş-geldin', 'hoş-geldin', ChannelType.GuildText)
        || findExistingChannel(null, 'hos-geldin', 'hosgeldin', ChannelType.GuildText);
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
      let approvalChannel = findExistingChannel(settings.approvalChannelId, '👑・developer-onay', 'developer-onay', ChannelType.GuildText);
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
      let modLogChannel = findExistingChannel(settings.modLogChannelId, '🛡️・mod-log', 'mod-log', ChannelType.GuildText);
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
      let rankLogChannel = findExistingChannel(settings.rankLogChannelId, '⚔️・rütbe-log', 'rütbe-log', ChannelType.GuildText)
        || findExistingChannel(null, 'rutbe-log', 'rutbe-log', ChannelType.GuildText);
      if (!rankLogChannel) {
        rankLogChannel = await guild.channels.create({
          name: '⚔️・rütbe-log',
          type: ChannelType.GuildText,
          parent: adminCategory.id
        });
        createdChannels.push(`⚔️ ${rankLogChannel.name}`);
      }
      settings.rankLogChannelId = rankLogChannel.id;

      // Seviye Log Kanalı
      let levelLogChannel = findExistingChannel(settings.levelLogChannelId, '📊・seviye-log', 'seviye-log', ChannelType.GuildText);
      if (!levelLogChannel) {
        levelLogChannel = await guild.channels.create({
          name: '📊・seviye-log',
          type: ChannelType.GuildText,
          parent: adminCategory.id
        });
        createdChannels.push(`📊 ${levelLogChannel.name}`);
      }
      settings.levelLogChannelId = levelLogChannel.id;

      // Canlı Sıralama Tablosu Kanalı (5 dakikada bir güncellenen tablo)
      let leaderboardChannel = findExistingChannel(settings.leaderboardChannelId, '🏆・sıralama', 'sıralama', ChannelType.GuildText)
        || findExistingChannel(null, 'siralama', 'siralama', ChannelType.GuildText);
      if (!leaderboardChannel) {
        leaderboardChannel = await guild.channels.create({
          name: '🏆・sıralama',
          type: ChannelType.GuildText,
          parent: adminCategory.id
        });
        createdChannels.push(`🏆 ${leaderboardChannel.name}`);
      }
      settings.leaderboardChannelId = leaderboardChannel.id;

      // B) Ses Odaları Kategorisi & Join-to-Create
      let voiceCategory = findExistingChannel(settings.tempVoiceCategoryId, '🔊 ASGARD SES ODALARI', 'ses odaları', ChannelType.GuildCategory)
        || findExistingChannel(null, '🔊 ASGARD SES ODALARI', 'asgard ses', ChannelType.GuildCategory);
      if (!voiceCategory) {
        voiceCategory = await guild.channels.create({
          name: '🔊 ASGARD SES ODALARI',
          type: ChannelType.GuildCategory
        });
        createdChannels.push(`📁 ${voiceCategory.name}`);
      }
      settings.tempVoiceCategoryId = voiceCategory.id;

      let j2cChannel = findExistingChannel(settings.joinToCreateChannelId, '➕ Ses Odası Oluştur', 'ses odası oluştur', ChannelType.GuildVoice)
        || findExistingChannel(null, 'Oda Oluştur', 'oda oluştur', ChannelType.GuildVoice);
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

      // Canlı Sıralama Tablosunu hemen oluştur veya güncelle
      const { LeaderboardManager } = require('../../utils/leaderboardManager');
      await LeaderboardManager.updateGuildLeaderboard(guild, settings);

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
              `• **Seviye Log:** <#${settings.levelLogChannelId}>\n` +
              `• **Canlı Sıralama Tablosu:** <#${settings.leaderboardChannelId}>\n` +
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
