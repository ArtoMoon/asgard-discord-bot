const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const UserProfile = require('../../models/UserProfile');
const Logger = require('../../utils/logger');
const config = require('../../config');
const { RankManager } = require('../../utils/rankManager');

module.exports = {
  name: 'kayit',
  aliases: ['register', 'k'],
  description: 'Yeni gelen bir üyeyi sunucuya kaydeder, ismini düzenler ve temel rütbe rolünü verir.',
  data: new SlashCommandBuilder()
    .setName('kayit')
    .setDescription('Yeni bir üyeyi Asgard diyarına kaydeder.')
    .addUserOption(opt =>
      opt.setName('kullanici')
        .setDescription('Kayıt edilecek kullanıcı')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('isim')
        .setDescription('Kullanıcının kaydedilecek ismi')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  async execute({ client, message, interaction, isSlash, guild, member, user, channel, args, reply }) {
    // Check permission: ManageNicknames or ManageRoles or Administrator
    const hasPerm = member.permissions.has(PermissionFlagsBits.ManageNicknames) ||
      member.permissions.has(PermissionFlagsBits.ManageRoles) ||
      member.permissions.has(PermissionFlagsBits.Administrator);

    if (!hasPerm) {
      return reply({ content: '❌ Bu komutu kullanabilmek için **Kayıt Yetkilisi** veya **Yönetici** olmalısınız!', ephemeral: true });
    }

    let targetMember = null;
    let newName = '';

    if (isSlash) {
      const targetUser = interaction.options.getUser('kullanici');
      newName = interaction.options.getString('isim').trim();
      targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    } else {
      if (!args[0] || !args[1]) {
        return reply({ content: '❌ **Kullanım:** `!kayit @kullanıcı [İsim]`' });
      }

      const targetId = args[0].replace(/[<@!>]/g, '');
      targetMember = await guild.members.fetch(targetId).catch(() => null);
      newName = args.slice(1).join(' ').trim();
    }

    if (!targetMember) {
      return reply({ content: '❌ Kayıt edilecek üye sunucuda bulunamadı!', ephemeral: true });
    }

    if (targetMember.user.bot) {
      return reply({ content: '❌ Botlar kayıt edilemez!', ephemeral: true });
    }

    const settings = await GuildSettings.findOne({ guildId: guild.id });
    if (!settings) {
      return reply({ content: '❌ Sunucu ayarları bulunamadı! Lütfen önce `/kurulum` yapınız.', ephemeral: true });
    }

    // Format nickname: [İsim] | Asgard
    const formattedNick = `${newName} | Asgard`;

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

      // 3. Add Registered Role
      if (settings.registeredRoleId) {
        const regRole = guild.roles.cache.get(settings.registeredRoleId);
        if (regRole) {
          await targetMember.roles.add(regRole).catch(() => null);
        }
      }

      // 4. Add Rank 1 (Thrall) Role
      const rank1Config = settings.ranks.find(r => r.rank === 1);
      if (rank1Config && rank1Config.roleId) {
        const r1Role = guild.roles.cache.get(rank1Config.roleId);
        if (r1Role) {
          await targetMember.roles.add(r1Role).catch(() => null);
        }
      }

      // 5. Initialize or update user profile
      let profile = await UserProfile.findOne({ guildId: guild.id, userId: targetMember.id });
      if (!profile) {
        profile = new UserProfile({
          guildId: guild.id,
          userId: targetMember.id,
          currentRank: 1
        });
      } else {
        profile.currentRank = 1;
      }
      await profile.save();

      const rank1Info = RankManager.getRankByLevel(1);

      const successEmbed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('⚔️ ASGARD DİYARINA HOŞ GELDİN!')
        .setDescription(
          `**${targetMember}** kullanıcısının kaydı **${member}** tarafından başarıyla tamamlandı!\n\n` +
          `📝 **Yeni İsim:** \`${formattedNick}\`\n` +
          `🛡️ **Başlangıç Rütbesi:** **${rank1Info.name}**\n` +
          `🎁 **Başlangıç Hakları:** ${rank1Info.perks.join(', ')}\n\n` +
          `*Sohbet ederek ve ses kanallarında vakit geçirerek daha üst rütbelere ve ayrıcalıklara erişebilirsin!*`
        )
        .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Asgard Krallığı Kayıt Bürosu', iconURL: guild.iconURL() })
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
