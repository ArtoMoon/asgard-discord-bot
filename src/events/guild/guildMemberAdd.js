const { EmbedBuilder } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const Logger = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  name: 'guildMemberAdd',
  async execute(client, member) {
    if (member.user.bot) return;

    try {
      const settings = await GuildSettings.findOne({ guildId: member.guild.id });
      if (!settings) {
        Logger.warn(`[guildMemberAdd] ${member.guild.name} sunucusu için ayarlar bulunamadı (/kurulum veya /settings komutuyla ayar yapılmalı).`);
        return;
      }

      // 1. Assign Auto-Role (e.g. Unverified / Kayıtsız)
      const targetRoleId = settings.autoRoleId || settings.unverifiedRoleId;
      if (targetRoleId) {
        const autoRole = member.guild.roles.cache.get(targetRoleId);
        if (autoRole) {
          await member.roles.add(autoRole).catch(err => {
            Logger.error(`[Oto-Rol] Rol verilemedi (${member.user.tag}):`, err.message);
          });
          Logger.info(`[Oto-Rol] ${member.user.tag} kullanıcısına ${autoRole.name} rolü verildi.`);
        }
      }

      // 2. Send Welcome Message
      if (settings.welcomeChannelId) {
        const welcomeChannel = member.guild.channels.cache.get(settings.welcomeChannelId)
          || await member.guild.channels.fetch(settings.welcomeChannelId).catch(() => null);

        if (welcomeChannel && welcomeChannel.isTextBased()) {
          const prefix = settings.prefix || config.defaultPrefix;
          const createdAt = Math.floor(member.user.createdTimestamp / 1000);

          const welcomeEmbed = new EmbedBuilder()
            .setColor(config.colors.asgard)
            .setTitle('⚔️ ASGARD KAPILARINA HOŞ GELDİN!')
            .setDescription(`Selamlar ${member}, **Asgard Diyarı**'na hoş geldin!\n\n` +
              `📜 **Kayıt ve Giriş Rehberi:**\n` +
              `• Sunucumuzdaki metin ve ses kanallarına erişebilmek için kayıt olmalısın.\n` +
              `• Kayıt işlemi için yetkililerimiz **\`${prefix}kayit @üye [İsim] [Yaş]\`** veya **\`/kayit\`** komutunu kullanarak ismini **\`İsim | Yaş\`** formatında kaydedecektir.\n` +
              `• Kayıt kanalına **İsim ve Yaş** bilgini yazarak yetkililerimizi bekleyebilirsin.\n\n` +
              `⭐ **Asgard Seviye & İzin Sistemi:**\n` +
              `• Ses kanallarında vakit geçirerek ve sohbette aktif olarak **Seviye 10, 20, 30, 40 ve 50**'ye ulaşabilir; özel GIF, sticker, görsel, link ve 1080p yayın yetkileri kazanabilirsin!\n\n` +
              `👤 **Hesap Kurulum Tarihi:** <t:${createdAt}:R>\n` +
              `👥 **Toplam Üye Sayımız:** **${member.guild.memberCount}**`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: 'Asgard Krallığı Güvenlik & Kayıt Sistemi', iconURL: member.guild.iconURL() })
            .setTimestamp();

          await welcomeChannel.send({
            content: `👋 Hoş geldin ${member}! Aramıza katıldığın için mutluyuz.`,
            embeds: [welcomeEmbed]
          }).catch(err => {
            Logger.error('Hoş geldin mesajı gönderilemedi:', err.message);
          });
        } else {
          Logger.warn(`[guildMemberAdd] Hoş geldin kanalı (ID: ${settings.welcomeChannelId}) bulunamadı veya bota kapalı.`);
        }
      } else {
        Logger.warn(`[guildMemberAdd] Hoş geldin kanalı ayarlı değil! /settings hosgeldin-kanal veya /kurulum komutunu kullanın.`);
      }
    } catch (err) {
      Logger.error('guildMemberAdd eventinde hata:', err);
    }
  }
};
