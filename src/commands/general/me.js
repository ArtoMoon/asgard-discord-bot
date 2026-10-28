const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');
const UserProfile = require('../../models/UserProfile');
const GuildSettings = require('../../models/GuildSettings');
const { RankManager } = require('../../utils/rankManager');
const config = require('../../config');

module.exports = {
  name: 'me',
  aliases: ['profil', 'profile', 'rank', 'stat', 'stats'],
  description: 'Asgard rütbenizi, haftalık mesaj/ses istatistiklerinizi ve açık ayrıcalıklarınızı gösterir.',
  data: new SlashCommandBuilder()
    .setName('me')
    .setDescription('Asgard rütbe, istatistik ve kazanılan ayrıcalıklarınızı görüntüler.')
    .addUserOption(option =>
      option.setName('kullanici')
        .setDescription('İstatistiklerine bakmak istediğiniz kullanıcı (İsteğe bağlı)')
        .setRequired(false)
    ),

  async execute({ client, message, interaction, isSlash, guild, member, user, channel, args, reply }) {
    let targetMember = member;

    if (isSlash) {
      const selectedUser = interaction.options.getUser('kullanici');
      if (selectedUser) {
        targetMember = await guild.members.fetch(selectedUser.id).catch(() => member);
      }
    } else if (args[0]) {
      const mentionId = args[0].replace(/[<@!>]/g, '');
      targetMember = await guild.members.fetch(mentionId).catch(() => member);
    }

    const settings = await GuildSettings.findOne({ guildId: guild.id });
    let profile = await UserProfile.findOne({ guildId: guild.id, userId: targetMember.id });

    if (!profile) {
      profile = new UserProfile({ guildId: guild.id, userId: targetMember.id });
    }

    const userLevel = profile.level || RankManager.calculateLevel(profile.totalXp);
    const currentMilestone = RankManager.getMilestoneForLevel(userLevel) || RankManager.getHighestMilestoneReached(userLevel);
    const milestones = RankManager.getLevelMilestones();
    const nextMilestone = milestones.find(m => m.level > userLevel);

    // Yetkili Kontrolü:
    const staffRoleIds = settings?.staffRoleIds || [];
    const asgardRoleIds = (settings?.ranks || []).map(r => r.roleId).filter(Boolean);
    const allStaffRoleIds = [...staffRoleIds, ...asgardRoleIds];

    const isStaffMember = profile?.staff?.isStaff ||
      targetMember.id === guild.ownerId ||
      (config.developerIds || []).includes(targetMember.id) ||
      (settings?.developerUserIds || []).includes(targetMember.id) ||
      targetMember.permissions.has(PermissionFlagsBits.ManageGuild) ||
      targetMember.permissions.has(PermissionFlagsBits.Administrator) ||
      targetMember.roles.cache.some(r => allStaffRoleIds.includes(r.id));

    const staffRankNum = isStaffMember ? RankManager.detectMemberStaffRank(targetMember, settings, profile) : 1;
    const currentRank = RankManager.getRankByLevel(staffRankNum);
    const staffStats = profile.staff || { points: 0, registrations: 0, punishments: 0, voiceMinutes: 0 };
    const progress = RankManager.getStaffPromotionProgress(staffRankNum, staffStats);
    const progressBar = RankManager.createProgressBar(progress.progressPercent, 12);

    const embed = new EmbedBuilder()
      .setColor(isStaffMember && currentRank.color ? parseInt(currentRank.color.replace('#', ''), 16) : config.colors.asgard)
      .setTitle(`⚔️ Asgard Profili: ${targetMember.displayName}`)
      .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        isStaffMember
          ? `🛡️ **Asgard Yönetim Kadrosu Üyesi** — Seviye durumunuz ve Yetkili İcraat istatistikleriniz aşağıdadır.`
          : `Asgard Krallığı'ndaki kalıcı seviye ilerlemeniz ve kazanılan izinleriniz aşağıdadır.`
      )
      .addFields(
        {
          name: '⭐ Üye Seviyesi (1-50)',
          value: `**Seviye ${userLevel} / 50** (\`${profile.totalXp.toLocaleString()} XP\`)\n` +
            (currentMilestone ? `🎁 **Açık İzin:** ${currentMilestone.perk}\n` : '🎁 **Açık İzin:** Temel Sohbet\n') +
            (nextMilestone ? `🎯 **Sıradaki Rol:** Seviye ${nextMilestone.level} (${nextMilestone.perk})` : '🏆 **Maksimum Seviye!**'),
          inline: false
        },
        {
          name: '💬 Toplam Sohbet',
          value: `**${profile.messageCount}** mesaj`,
          inline: true
        },
        {
          name: '🎙️ Toplam Ses',
          value: `**${profile.voiceMinutes}** dakika`,
          inline: true
        }
      );

    if (isStaffMember) {
      embed.addFields(
        {
          name: '👑 Yönetim Kademesi',
          value: `**${currentRank.name}**\n*(Kademe ${currentRank.rank}/10)*`,
          inline: true
        },
        {
          name: '🛡️ Yetkili İcraat Özeti (Levelden Bağımsız)',
          value:
            `• ⭐ **Yetkili Puanı:** \`${staffStats.points || 0} Puan\`\n` +
            `• 📝 **Kayıt İcraatı:** \`${staffStats.registrations || 0} Üye\` (+15p/kayıt)\n` +
            `• 🔨 **Ceza İşlemi:** \`${staffStats.punishments || 0} İşlem\` (+20p/işlem)\n` +
            `• 🎙️ **Yetkili Ses Mesaisi:** \`${staffStats.voiceMinutes || 0} dk\``,
          inline: false
        },
        {
          name: '📈 Yetkili Terfi İlerlemesi',
          value: `${progressBar}\n*(Sonraki Kademeye: %${progress.progressPercent})*`,
          inline: false
        }
      );
    }

    embed.setFooter({
      text: isStaffMember
        ? 'Detaylı terfi şartlarını görmek için aşağıdaki "Yetkili Terfi & Yükselme Durumu" butonuna tıklayın.'
        : 'Sohbette ve ses kanallarında aktif kalarak Seviye 10, 20, 30, 40 ve 50 ayrıcalıklarını açabilirsiniz.',
      iconURL: guild.iconURL()
    }).setTimestamp();

    const components = [];
    if (isStaffMember) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`staff_promote_info_${targetMember.id}`)
          .setLabel('🛡️ Yetkili Terfi & Yükselme Durumu')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📈')
      );
      components.push(row);
    }

    await reply({ embeds: [embed], components });
  }
};
