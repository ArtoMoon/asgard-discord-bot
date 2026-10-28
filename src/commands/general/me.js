const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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

    const currentRank = RankManager.getRankByLevel(profile.currentRank);
    const progress = RankManager.getNextRankProgress(profile.currentRank, profile.weekly);
    const progressBar = RankManager.createProgressBar(progress.progressPercent, 12);

    const embed = new EmbedBuilder()
      .setColor(currentRank.color ? parseInt(currentRank.color.replace('#', ''), 16) : config.colors.asgard)
      .setTitle(`⚔️ Asgard Savaşçı Profili: ${targetMember.displayName}`)
      .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(`Asgard Krallığı'ndaki haftalık ve genel aktiflik durumunuz aşağıda listelenmiştir.`)
      .addFields(
        {
          name: '👑 Mevcut Rütbe',
          value: `**${currentRank.name}** (Rütbe ${currentRank.rank}/10)`,
          inline: true
        },
        {
          name: '✨ Toplam XP',
          value: `\`${profile.totalXp.toLocaleString()} XP\``,
          inline: true
        },
        {
          name: '📈 Haftalık İlerleme',
          value: `${progressBar}\n*(Genel Başarı: %${progress.progressPercent})*`,
          inline: false
        },
        {
          name: '💬 Haftalık Sohbet',
          value: `**${profile.weekly.messages}** / ${progress.nextRank ? progress.nextRank.requiredMessages : 'MAX'} mesaj\n*(Toplam: ${profile.messageCount})*`,
          inline: true
        },
        {
          name: '🎙️ Haftalık Ses',
          value: `**${profile.weekly.voiceMinutes}** / ${progress.nextRank ? progress.nextRank.requiredVoiceMinutes : 'MAX'} dk\n*(Toplam: ${profile.voiceMinutes} dk)*`,
          inline: true
        },
        {
          name: '⚡ Haftalık XP',
          value: `**${profile.weekly.xp}** / ${progress.nextRank ? progress.nextRank.requiredWeeklyXp : 'MAX'} XP`,
          inline: true
        }
      );

    if (!progress.isMax && progress.nextRank) {
      embed.addFields({
        name: `🎯 Sıradaki Hedef: ${progress.nextRank.name}`,
        value: `Bir sonraki rütbeye geçmek için eksikler:\n` +
          `• **${progress.neededXp}** XP\n` +
          `• **${progress.neededMessages}** Mesaj\n` +
          `• **${progress.neededVoiceMinutes}** Dakika Ses Aktifliği`,
        inline: false
      });
    }

    embed.addFields({
      name: '🎁 Sahip Olunan Ayrıcalıklar (Perks)',
      value: currentRank.perks.map(p => `✅ ${p}`).join('\n') || 'Temel ayrıcalıklar',
      inline: false
    });

    embed.setFooter({
      text: 'Her hafta görevlerinizi tamamlayarak rütbenizi koruyabilir ve yükseltebilirsiniz.',
      iconURL: guild.iconURL()
    }).setTimestamp();

    await reply({ embeds: [embed] });
  }
};
