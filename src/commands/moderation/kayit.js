const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const UserProfile = require('../../models/UserProfile');
const Logger = require('../../utils/logger');
const config = require('../../config');
const { RankManager } = require('../../utils/rankManager');

module.exports = {
  name: 'kayit',
  aliases: ['register', 'k', 'e', 'kız', 'erkek'],
  description: 'Yeni gelen bir üyeyi sunucuya "İsim | Yaş" formatında kaydeder ve üye rolünü verir.',
  data: new SlashCommandBuilder()
    .setName('kayit')
    .setDescription('Yeni bir üyeyi "İsim | Yaş" formatında Asgard diyarına kaydeder.')
    .addUserOption(opt =>
      opt.setName('kullanici')
        .setDescription('Kayıt edilecek kullanıcı')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('isim')
        .setDescription('Kullanıcının ismi')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('yas')
        .setDescription('Kullanıcının yaşı')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  async execute({ client, message, interaction, isSlash, guild, member, user, channel, args, reply }) {
    const settings = await GuildSettings.findOne({ guildId: guild.id });
    if (!settings) {
      return reply({ content: '❌ Sunucu ayarları bulunamadı! Lütfen önce `/kurulum` yapınız.', ephemeral: true });
    }

    // Check permission: ManageNicknames, ManageRoles, Administrator, or Asgard Staff Role
    const isStaff = RankManager.isMemberStaff(member, settings, null);
    const hasPerm = isStaff ||
      member.permissions.has(PermissionFlagsBits.ManageNicknames) ||
      member.permissions.has(PermissionFlagsBits.ManageRoles) ||
      member.permissions.has(PermissionFlagsBits.Administrator);

    if (!hasPerm) {
      return reply({ content: '❌ Bu komutu kullanabilmek için **Yetkili Kadrosunda** veya **Yönetici** olmalısınız!', ephemeral: true });
    }

    let targetMember = null;
    let rawName = '';
    let rawAge = '';

    if (isSlash) {
      const targetUser = interaction.options.getUser('kullanici');
      rawName = interaction.options.getString('isim').trim();
      rawAge = interaction.options.getString('yas').trim();
      targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    } else {
      if (!args[0] || !args[1] || !args[2]) {
        return reply({
          content: `❌ **Eksik Argüman!** Doğru kullanım:\n\`${settings.prefix || '!'}kayit @kullanıcı [İsim] [Yaş]\` *(Örn: \`${settings.prefix || '!'}kayit @üye Ahmet 21\`)*`
        });
      }

      const targetId = args[0].replace(/[<@!>]/g, '');
      targetMember = await guild.members.fetch(targetId).catch(() => null);

      // Son argüman yaş, aradakiler isim (Örn: !kayit @üye Mehmet Ali 22 -> Mehmet Ali | 22)
      const cleanedArgs = args.slice(1).filter(a => a !== '|');
      if (cleanedArgs.length >= 2) {
        rawAge = cleanedArgs[cleanedArgs.length - 1];
        rawName = cleanedArgs.slice(0, -1).join(' ');
      } else {
        rawName = cleanedArgs[0] || '';
      }
    }

    if (!targetMember) {
      return reply({ content: '❌ Kayıt edilecek üye sunucuda bulunamadı!', ephemeral: true });
    }

    if (targetMember.user.bot) {
      return reply({ content: '❌ Botlar kayıt edilemez!', ephemeral: true });
    }

    // İsmin baş harflerini büyüt (Örn: ahmet -> Ahmet)
    const capitalizedName = rawName
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR'))
      .join(' ');

    // Format nickname: İsim | Yaş
    const formattedNick = rawAge ? `${capitalizedName} | ${rawAge}` : capitalizedName;

    try {
      // 1. Change nickname
      await targetMember.setNickname(formattedNick).catch(err => {
        Logger.warn(`[Kayıt] İsim değiştirilemedi (rol hiyerarşisi): ${err.message}`);
      });

      // 2. Remove Unverified role
      const unverifiedId = settings.unverifiedRoleId || settings.autoRoleId;
      if (unverifiedId && targetMember.roles.cache.has(unverifiedId)) {
        await targetMember.roles.remove(unverifiedId).catch(() => null);
      }

      // 3. Add Registered Member Role (Normal Üye Rolü)
      if (settings.registeredRoleId) {
        const regRole = guild.roles.cache.get(settings.registeredRoleId);
        if (regRole) {
          await targetMember.roles.add(regRole).catch(() => null);
        }
      }

      // 4. Initialize or update target user profile
      let profile = await UserProfile.findOne({ guildId: guild.id, userId: targetMember.id });
      if (!profile) {
        profile = new UserProfile({
          guildId: guild.id,
          userId: targetMember.id,
          level: 1
        });
      }
      await profile.save();

      // 5. Kayıt Yapan Yetkiliye +15 Yetkili Puanı ve +1 Kayıt İcraatı Ekle!
      let staffProfile = await UserProfile.findOne({ guildId: guild.id, userId: member.id });
      if (!staffProfile) {
        staffProfile = new UserProfile({ guildId: guild.id, userId: member.id });
      }
      if (!staffProfile.staff) staffProfile.staff = { isStaff: true, rank: 1, points: 0, registrations: 0, punishments: 0, voiceMinutes: 0, messages: 0, bonusPoints: 0 };
      staffProfile.staff.isStaff = true;

      const staffResult = await RankManager.addStaffAction(guild, member, staffProfile, settings, 'REGISTER');

      const successEmbed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('⚔️ ASGARD DİYARINA HOŞ GELDİN!')
        .setDescription(
          `**${targetMember}** kullanıcısının kaydı **${member}** tarafından başarıyla tamamlandı!\n\n` +
          `📝 **Yeni İsim:** \`${formattedNick}\`\n` +
          `⭐ **Başlangıç Seviyesi:** **Seviye 1** *(Sohbet & seste XP kasarak 10, 20, 30, 40, 50 seviyelerinde GIF, Görsel, Link ve Yayın açılır)*\n\n` +
          `🛡️ **Yetkili İcraat Ödülü:** ${member} bu kayıt ile **+15 Yetkili Puanı** kazandı! *(Toplam Kayıt: ${staffProfile.staff.registrations} • Puan: ${staffProfile.staff.points})*` +
          (staffResult.promoted ? `\n🎉 **TERFİ MÜJDESİ:** ${member} yeni yönetim kademesine yükseldi: **${staffResult.newRank.name}**!` : '')
        )
        .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Asgard Krallığı Kayıt & Yetkili Terfi Sistemi', iconURL: guild.iconURL() })
        .setTimestamp();

      await reply({ embeds: [successEmbed] });

      // Log to Mod / Welcome channel
      const targetLogId = settings.modLogChannelId || settings.welcomeChannelId;
      if (targetLogId) {
        await Logger.sendGuildLog(guild, targetLogId, successEmbed);
      }

      Logger.info(`[Kayıt] ${targetMember.user.tag} üyesi ${member.user.tag} tarafından kaydedildi.`);
    } catch (err) {
      Logger.error('Kayıt sırasında hata oluştu:', err);
      return reply({ content: `❌ Kayıt işlemi gerçekleştirilemedi: ${err.message}`, ephemeral: true });
    }
  }
};
