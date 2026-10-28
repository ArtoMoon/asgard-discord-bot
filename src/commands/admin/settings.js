const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const config = require('../../config');
const Logger = require('../../utils/logger');

module.exports = {
  name: 'settings',
  aliases: ['ayar', 'ayarlar', 'config'],
  description: 'Botun rol, kanal ve güvenlik ayarlarını görüntüler veya düzenler.',
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Botun rol, kanal ve güvenlik ayarlarını yönetir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('goruntule')
        .setDescription('Mevcut sunucu ayarlarını görüntüler.')
    )
    .addSubcommand(sub =>
      sub.setName('oto-rol')
        .setDescription('Yeni gelenlere verilecek otomatik rolü ayarlar.')
        .addRoleOption(opt => opt.setName('rol').setDescription('Oto-rol').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('hosgeldin-kanal')
        .setDescription('Hoş geldin mesajının gideceği kanalı ayarlar.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Hoş geldin kanalı').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('onay-kanal')
        .setDescription('Developer yetki onay bildirimlerinin gideceği kanalı ayarlar.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Onay kanalı').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('mod-log')
        .setDescription('Moderasyon ve güvenlik kayıt kanalını ayarlar.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Mod log kanalı').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('ses-odasi')
        .setDescription('Kullanıcı girdiğinde oda açan ses kanalını ayarlar (Join-to-create).')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Oda oluşturucu ses kanalı').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('jail-rol')
        .setDescription('Cezalı (Jail) rolünü ayarlar.')
        .addRoleOption(opt => opt.setName('rol').setDescription('Jail rolü').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('developer-ekle')
        .setDescription('Yetki onaylayabilecek Developer kullanıcı ekler.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Developer kullanıcı').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('prefix')
        .setDescription('Metin komutları için ön eki (prefix) değiştirir.')
        .addStringOption(opt => opt.setName('on-ek').setDescription('Yeni prefix (Örn: !, ., -)').setRequired(true))
    ),

  async execute({ client, message, interaction, isSlash, guild, member, user, channel, args, reply }) {
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      return reply({ content: '❌ Bu komutu yalnızca **Yönetici (Administrator)** yetkisine sahip kullanıcılar çalıştırabilir!', ephemeral: true });
    }

    let settings = await GuildSettings.findOne({ guildId: guild.id });
    if (!settings) {
      settings = await GuildSettings.create({ guildId: guild.id });
    }

    let subcommand = 'goruntule';

    if (isSlash) {
      subcommand = interaction.options.getSubcommand();
    } else if (args[0]) {
      subcommand = args[0].toLowerCase();
    }

    // 1. GÖRÜNTÜLE
    if (subcommand === 'goruntule' || subcommand === 'view' || subcommand === 'list') {
      const devList = [...(config.developerIds || []), ...(settings.developerUserIds || [])];

      const embed = new EmbedBuilder()
        .setColor(config.colors.asgard)
        .setTitle(`⚙️ Asgard Sunucu Ayarları: ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .addFields(
          {
            name: '👑 Temel Bilgiler',
            value: `• **Prefix:** \`${settings.prefix || config.defaultPrefix}\`\n` +
              `• **Developerlar:** ${devList.length > 0 ? devList.map(id => `<@${id}>`).join(', ') : 'Varsayılan yok'}`,
            inline: false
          },
          {
            name: '🎭 Rol Yapılandırması',
            value: `• **Oto-Rol:** ${settings.autoRoleId ? `<@&${settings.autoRoleId}>` : '❌ Ayarlı değil'}\n` +
              `• **Kayıtsız Rolü:** ${settings.unverifiedRoleId ? `<@&${settings.unverifiedRoleId}>` : '❌ Ayarlı değil'}\n` +
              `• **Kayıtlı Üye Rolü:** ${settings.registeredRoleId ? `<@&${settings.registeredRoleId}>` : '❌ Ayarlı değil'}\n` +
              `• **Jail Rolü:** ${settings.jailRoleId ? `<@&${settings.jailRoleId}>` : '❌ Ayarlı değil'}\n` +
              `• **10 Asgard Rütbesi:** ${settings.ranks && settings.ranks.length > 0 ? `✅ (${settings.ranks.length}/10 ayarlı)` : '❌ `/kurulum` yapınız'}`,
            inline: false
          },
          {
            name: '📁 Kanal Yapılandırması',
            value: `• **Hoş Geldin Kanalı:** ${settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : '❌ Ayarlı değil'}\n` +
              `• **Developer Onay Log:** ${settings.approvalChannelId ? `<#${settings.approvalChannelId}>` : '❌ Ayarlı değil'}\n` +
              `• **Mod Log Kanalı:** ${settings.modLogChannelId ? `<#${settings.modLogChannelId}>` : '❌ Ayarlı değil'}\n` +
              `• **Rütbe Log Kanalı:** ${settings.rankLogChannelId ? `<#${settings.rankLogChannelId}>` : '❌ Ayarlı değil'}\n` +
              `• **Özel Oda Oluşturucu:** ${settings.joinToCreateChannelId ? `<#${settings.joinToCreateChannelId}>` : '❌ Ayarlı değil'}`,
            inline: false
          }
        )
        .setFooter({ text: 'Ayarları değiştirmek için /settings veya /kurulum komutunu kullanabilirsiniz.', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      return reply({ embeds: [embed] });
    }

    // 2. OTO-ROL
    if (subcommand === 'oto-rol' || subcommand === 'otorol') {
      const role = isSlash ? interaction.options.getRole('rol') : guild.roles.cache.get(args[1]?.replace(/[<@&>]/g, ''));
      if (!role) return reply({ content: '❌ Lütfen geçerli bir rol belirtin!' });

      settings.autoRoleId = role.id;
      settings.unverifiedRoleId = role.id;
      await settings.save();
      return reply({ content: `✅ Yeni üyelere otomatik verilecek rol **${role.name}** olarak ayarlandı!` });
    }

    // 3. HOŞGELDİN KANAL
    if (subcommand === 'hosgeldin-kanal' || subcommand === 'hosgeldin') {
      const ch = isSlash ? interaction.options.getChannel('kanal') : guild.channels.cache.get(args[1]?.replace(/[<#>]/g, ''));
      if (!ch) return reply({ content: '❌ Lütfen geçerli bir metin kanalı belirtin!' });

      settings.welcomeChannelId = ch.id;
      await settings.save();
      return reply({ content: `✅ Hoş geldin mesaj kanalı ${ch} olarak ayarlandı!` });
    }

    // 4. ONAY KANAL (Developer Approval Channel)
    if (subcommand === 'onay-kanal' || subcommand === 'onay') {
      const ch = isSlash ? interaction.options.getChannel('kanal') : guild.channels.cache.get(args[1]?.replace(/[<#>]/g, ''));
      if (!ch) return reply({ content: '❌ Lütfen geçerli bir metin kanalı belirtin!' });

      settings.approvalChannelId = ch.id;
      await settings.save();
      return reply({ content: `✅ Developer yetki onay bildirim kanalı ${ch} olarak ayarlandı!` });
    }

    // 5. MOD LOG
    if (subcommand === 'mod-log' || subcommand === 'modlog') {
      const ch = isSlash ? interaction.options.getChannel('kanal') : guild.channels.cache.get(args[1]?.replace(/[<#>]/g, ''));
      if (!ch) return reply({ content: '❌ Lütfen geçerli bir metin kanalı belirtin!' });

      settings.modLogChannelId = ch.id;
      await settings.save();
      return reply({ content: `✅ Moderasyon ve güvenlik kayıt kanalı ${ch} olarak ayarlandı!` });
    }

    // 6. SES ODASI (Join to Create)
    if (subcommand === 'ses-odasi' || subcommand === 'ses') {
      const ch = isSlash ? interaction.options.getChannel('kanal') : guild.channels.cache.get(args[1]?.replace(/[<#>]/g, ''));
      if (!ch || ch.type !== 2) return reply({ content: '❌ Lütfen geçerli bir **ses kanalı** belirtin!' });

      settings.joinToCreateChannelId = ch.id;
      await settings.save();
      return reply({ content: `✅ Özel ses odası oluşturucu kanalı ${ch} olarak ayarlandı!` });
    }

    // 7. JAIL ROLÜ
    if (subcommand === 'jail-rol' || subcommand === 'jail') {
      const role = isSlash ? interaction.options.getRole('rol') : guild.roles.cache.get(args[1]?.replace(/[<@&>]/g, ''));
      if (!role) return reply({ content: '❌ Lütfen geçerli bir rol belirtin!' });

      settings.jailRoleId = role.id;
      await settings.save();
      return reply({ content: `✅ Cezalı (Jail) rolü **${role.name}** olarak ayarlandı!` });
    }

    // 8. DEVELOPER EKLE
    if (subcommand === 'developer-ekle' || subcommand === 'dev-ekle') {
      const targetUser = isSlash ? interaction.options.getUser('kullanici') : await client.users.fetch(args[1]?.replace(/[<@!>]/g, '')).catch(() => null);
      if (!targetUser) return reply({ content: '❌ Lütfen geçerli bir kullanıcı belirtin!' });

      if (!settings.developerUserIds.includes(targetUser.id)) {
        settings.developerUserIds.push(targetUser.id);
        await settings.save();
      }
      return reply({ content: `✅ ${targetUser} kullanıcısı yetki taleplerini onaylayabilecek Developer listesine eklendi!` });
    }

    // 9. PREFIX
    if (subcommand === 'prefix') {
      const newPrefix = isSlash ? interaction.options.getString('on-ek') : args[1];
      if (!newPrefix) return reply({ content: '❌ Lütfen yeni prefixi belirtin! Örn: `!`' });

      settings.prefix = newPrefix.trim();
      await settings.save();
      return reply({ content: `✅ Bot ön eki (prefix) başarıyla \`${settings.prefix}\` olarak güncellendi!` });
    }

    return reply({ content: '❌ Geçersiz alt komut! Kullanılabilir seçenekler: `goruntule`, `oto-rol`, `hosgeldin-kanal`, `onay-kanal`, `mod-log`, `ses-odasi`, `jail-rol`, `developer-ekle`, `prefix`' });
  }
};
