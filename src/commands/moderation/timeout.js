const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ms = require('ms');
const GuildSettings = require('../../models/GuildSettings');
const Logger = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  name: 'timeout',
  aliases: ['sustur', 'mute', 'mutele'],
  description: 'Bir üyeye zamanaşımı (timeout/susturma) uygular.',
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Bir kullanıcıyı belirli bir süre susturur.')
    .addUserOption(opt =>
      opt.setName('kullanici')
        .setDescription('Susturulacak kullanıcı')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('sure')
        .setDescription('Susturma süresi (Örn: 10m, 1h, 1d)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('sebep')
        .setDescription('Susturma gerekçesi')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute({ client, message, interaction, isSlash, guild, member, user, channel, args, reply }) {
    if (!member.permissions.has(PermissionFlagsBits.ModerateMembers) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      return reply({ content: '❌ Bu komutu kullanabilmek için **Üyeleri Yönet (Moderate Members)** yetkisine sahip olmalısınız!', ephemeral: true });
    }

    let targetMember = null;
    let durationString = '';
    let reason = 'Belirtilmedi';

    if (isSlash) {
      const targetUser = interaction.options.getUser('kullanici');
      durationString = interaction.options.getString('sure');
      reason = interaction.options.getString('sebep') || 'Belirtilmedi';
      targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    } else {
      if (!args[0] || !args[1]) {
        return reply({ content: '❌ **Kullanım:** `!timeout @kullanıcı <süre: 10m, 1h, 1d> [sebep]`' });
      }

      const targetId = args[0].replace(/[<@!>]/g, '');
      durationString = args[1];
      targetMember = await guild.members.fetch(targetId).catch(() => null);
      if (args.slice(2).length > 0) {
        reason = args.slice(2).join(' ');
      }
    }

    if (!targetMember) {
      return reply({ content: '❌ İşlem yapılacak üye sunucuda bulunamadı!', ephemeral: true });
    }

    if (targetMember.id === client.user.id) {
      return reply({ content: '❌ Botu susturamazsınız!', ephemeral: true });
    }

    // Role hierarchy check
    const botMember = await guild.members.fetchMe();
    if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
      return reply({ content: '❌ Bu üyenin rolü botun rolünden daha yüksek veya eşit olduğu için susturulamaz!', ephemeral: true });
    }

    const durationMs = ms(durationString);
    if (!durationMs || durationMs < 5000 || durationMs > 28 * 24 * 60 * 60 * 1000) {
      return reply({ content: '❌ Geçersiz süre! Süre 5 saniye ile 28 gün arasında olmalıdır (Örn: `10m`, `1h`, `2d`).', ephemeral: true });
    }

    try {
      await targetMember.timeout(durationMs, `${member.user.tag} tarafından susturuldu: ${reason}`);

      const settings = await GuildSettings.findOne({ guildId: guild.id });

      const timeoutEmbed = new EmbedBuilder()
        .setColor(config.colors.warning)
        .setTitle('🔇 [ZAMANAŞIMI] Kullanıcı Susturuldu')
        .setDescription(
          `**Susturulan Kullanıcı:** ${targetMember} (\`${targetMember.user.tag}\`)\n` +
          `**Yetkili:** ${member} (\`${member.user.tag}\`)\n` +
          `**Süre:** \`${durationString}\`\n` +
          `**Bitiş Zamanı:** <t:${Math.floor((Date.now() + durationMs) / 1000)}:R>\n` +
          `**Sebep:** ${reason}`
        )
        .setFooter({ text: 'Asgard Güvenlik & Moderasyon Sistemi', iconURL: guild.iconURL() })
        .setTimestamp();

      await reply({ embeds: [timeoutEmbed] });

      if (settings?.modLogChannelId) {
        await Logger.sendGuildLog(guild, settings.modLogChannelId, timeoutEmbed);
      }

      Logger.info(`[Timeout] ${targetMember.user.tag} üyesi ${durationString} boyunca susturuldu (${member.user.tag}). Sebep: ${reason}`);
    } catch (err) {
      Logger.error('Timeout uygulanırken hata oluştu:', err);
      return reply({ content: `❌ Susturma işlemi uygulanamadı: ${err.message}`, ephemeral: true });
    }
  }
};
