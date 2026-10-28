const { EmbedBuilder } = require('discord.js');
const Logger = require('../../utils/logger');
const config = require('../../config');
const GuildSettings = require('../../models/GuildSettings');
const RoleRequest = require('../../models/RoleRequest');

module.exports = {
  name: 'interactionCreate',
  async execute(client, interaction) {
    // 1. Handle Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName.toLowerCase());
      if (!command) {
        return interaction.reply({ content: '❌ Bu komut sistemde bulunamadı!', ephemeral: true });
      }

      // Normalized reply wrapper
      const reply = async (options) => {
        if (interaction.deferred || interaction.replied) {
          return interaction.followUp(options);
        }
        return interaction.reply(options);
      };

      try {
        await command.execute({
          client,
          interaction,
          message: null,
          isSlash: true,
          guild: interaction.guild,
          member: interaction.member,
          user: interaction.user,
          channel: interaction.channel,
          args: [],
          reply
        });
      } catch (err) {
        Logger.error(`Slash komut hatası (${interaction.commandName}):`, err);
        const errorContent = {
          content: '❌ Komut çalıştırılırken beklenmeyen bir hata meydana geldi!',
          ephemeral: true
        };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(errorContent).catch(() => null);
        } else {
          await interaction.reply(errorContent).catch(() => null);
        }
      }
      return;
    }

    // 2. Handle Button Interactions (Developer Role Approval System)
    if (interaction.isButton()) {
      const customId = interaction.customId;

      if (customId.startsWith('approve_role_') || customId.startsWith('reject_role_')) {
        const isApprove = customId.startsWith('approve_role_');
        const requestId = customId.replace(isApprove ? 'approve_role_' : 'reject_role_', '');

        const settings = await GuildSettings.findOne({ guildId: interaction.guildId });
        const devList = [...(config.developerIds || []), ...(settings?.developerUserIds || [])];
        const isDev = devList.includes(interaction.user.id) || interaction.guild.ownerId === interaction.user.id;

        if (!isDev) {
          return interaction.reply({
            content: '🛡️ **Yetkisiz İşlem:** Bu yetki talebini yalnızca sistem Developer\'ı veya Sunucu Sahibi onaylayabilir!',
            ephemeral: true
          });
        }

        const roleRequest = await RoleRequest.findOne({ requestId, guildId: interaction.guildId });
        if (!roleRequest) {
          return interaction.reply({ content: '❌ Bu yetki talebi bulunamadı veya süresi dolmuş!', ephemeral: true });
        }

        if (roleRequest.status !== 'PENDING') {
          return interaction.reply({
            content: `⚠️ Bu talep zaten daha önce **${roleRequest.status === 'APPROVED' ? 'ONAYLANDI' : 'REDDEDİLDİ'}**!`,
            ephemeral: true
          });
        }

        const targetMember = await interaction.guild.members.fetch(roleRequest.targetUserId).catch(() => null);
        const targetRole = interaction.guild.roles.cache.get(roleRequest.roleId);

        if (isApprove) {
          if (!targetMember) {
            return interaction.reply({ content: '❌ Yetki verilecek üye sunucuda bulunamadı!', ephemeral: true });
          }
          if (!targetRole) {
            return interaction.reply({ content: '❌ Belirtilen rol sunucuda mevcut değil!', ephemeral: true });
          }

          // Assign role to target member
          await targetMember.roles.add(targetRole).catch(err => {
            Logger.error(`Rol verilirken hata:`, err.message);
          });

          roleRequest.status = 'APPROVED';
          roleRequest.approvedByUserId = interaction.user.id;
          roleRequest.reviewedAt = new Date();
          await roleRequest.save();

          const approvedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(config.colors.success)
            .setTitle('✅ [ONAYLANDI] Yetki Verme Talebi Kabul Edildi')
            .addFields(
              { name: '👑 Onaylayan Developer', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
              { name: '📅 Onay Tarihi', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            );

          await interaction.update({ embeds: [approvedEmbed], components: [] });

          Logger.success(`[Yetki Onaylandı] ${interaction.user.tag}, ${targetMember.user.tag} adlı kullanıcıya ${targetRole.name} rolünü onayladı.`);
        } else {
          // Reject
          roleRequest.status = 'REJECTED';
          roleRequest.approvedByUserId = interaction.user.id;
          roleRequest.reviewedAt = new Date();
          await roleRequest.save();

          const rejectedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(config.colors.error)
            .setTitle('❌ [REDDEDİLDİ] Yetki Verme Talebi Geri Çevrildi')
            .addFields(
              { name: '🛡️ Reddeden Yetkili', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
              { name: '📅 Red Tarihi', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            );

          await interaction.update({ embeds: [rejectedEmbed], components: [] });
          Logger.warn(`[Yetki Reddedildi] ${interaction.user.tag}, talep ID: ${requestId} talebini reddetti.`);
        }
        return;
      }

      // 3. Handle Staff Promotion Info Button (!me & /me)
      if (customId.startsWith('staff_promote_info_')) {
        const targetUserId = customId.replace('staff_promote_info_', '');

        const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
        if (!targetMember) {
          return interaction.reply({ content: '❌ Kullanıcı bilgisi sunucuda bulunamadı!', ephemeral: true });
        }

        const UserProfile = require('../../models/UserProfile');
        const { RankManager } = require('../../utils/rankManager');

        const settings = await GuildSettings.findOne({ guildId: interaction.guildId });
        let profile = await UserProfile.findOne({ guildId: interaction.guildId, userId: targetUserId });
        if (!profile) {
          profile = new UserProfile({ guildId: interaction.guildId, userId: targetUserId });
        }

        const staffRankNum = RankManager.detectMemberStaffRank(targetMember, settings, profile);
        const currentRank = RankManager.getRankByLevel(staffRankNum);
        const staffStats = profile.staff || { points: 0, registrations: 0, punishments: 0, voiceMinutes: 0 };
        const progress = RankManager.getStaffPromotionProgress(staffRankNum, staffStats);
        const progressBar = RankManager.createProgressBar(progress.progressPercent, 14);

        const promoteEmbed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle(`🛡️ Yetkili İcraat & Terfi Raporu: ${targetMember.displayName}`)
          .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
          .setDescription(
            `Asgard Yönetim Kadrosu terfi sistemi **normal seviye (level) sisteminden tamamen bağımsızdır**.\n` +
            `Yetkililer; **üye kaydı**, **moderasyon işlemleri (jail/mute)**, **ses mesaisi** ve **yönetim ödül puanları** ile yükselir!`
          )
          .addFields(
            {
              name: '👑 Mevcut Yönetim Kademesi',
              value: `**${currentRank.name}** *(Kademe ${currentRank.rank} / 10)*\n` +
                `**Mevcut Yetkiler:** ${currentRank.perks.join(' • ')}`,
              inline: false
            },
            {
              name: '📊 Yetkili İcraat Tablosu',
              value:
                `⭐ **Yetkili Puanı:** \`${staffStats.points || 0} Puan\`\n` +
                `📝 **Kayıt İcraatı:** \`${staffStats.registrations || 0} Üye\` *(+15 Puan/Kayıt)*\n` +
                `🔨 **Ceza İşlemi:** \`${staffStats.punishments || 0} İşlem\` *(+20 Puan/Ceza)*\n` +
                `🎙️ **Ses Mesaisi:** \`${staffStats.voiceMinutes || 0} Dakika\` *(+10 Puan/5dk)*`,
              inline: true
            },
            {
              name: '📈 Terfi İlerleme Oranı',
              value: `${progressBar}\n**Genel Tamamlama:** %${progress.progressPercent}`,
              inline: true
            }
          );

        if (progress.isMax || !progress.nextRank) {
          promoteEmbed.addFields({
            name: '🏆 Zirve Kademesi (Odin\'s Champion)',
            value: `En yüksek yönetim kademesindesiniz! Sunucunun en kıdemli baş yöneticisi olarak Asgard'ı yönetmeye devam edin.`,
            inline: false
          });
        } else {
          const isReady = progress.neededPoints <= 0;
          promoteEmbed.addFields(
            {
              name: `🎯 Sıradaki Yönetim Kademesi: ${progress.nextRank.name}`,
              value: `Yükseldiğinizde açılacak yeni yönetim yetkileri:\n` +
                progress.nextRank.perks.map(p => `✨ ${p}`).join('\n'),
              inline: false
            },
            {
              name: isReady ? '🎉 Terfi Durumu: ŞARTLAR TAMAMLANDI!' : '⏳ Bir Üst Kademeye Terfi İçin Gerekenler',
              value: isReady
                ? `✅ **Tebrikler!** Gerekli Yetkili Puanına ulaştınız! Bir sonraki icraatınızda veya \`!ypuan terfi\` komutuyla otomatik terfi alacaksınız.`
                : `**${progress.nextRank.name}** kademesine yükselmek için hedefler:\n` +
                  `• ⭐ **Yetkili Puanı:** \`${staffStats.points || 0} / ${progress.nextRank.requiredPoints}\` *(Kalan: **${progress.neededPoints} Puan**)*\n` +
                  `• 📝 **Önerilen Kayıt:** \`${staffStats.registrations || 0} / ${progress.nextRank.requiredRegistrations}\` üye\n` +
                  `• 🔨 **Önerilen Moderasyon:** \`${staffStats.punishments || 0} / ${progress.nextRank.requiredPunishments}\` işlem\n` +
                  `• 🎙️ **Önerilen Ses Mesaisi:** \`${staffStats.voiceMinutes || 0} / ${progress.nextRank.requiredVoiceMinutes}\` dk`,
              inline: false
            }
          );
        }

        promoteEmbed.addFields({
          name: '💡 Nasıl Hızlı Terfi Alırım?',
          value:
            `• Yeni gelen üyeleri **\`!kayit @üye İsim\`** ile kaydet (**+15 Puan**).\n` +
            `• Kural ihlali yapanlara **\`!timeout\`** veya **\`!jail\`** uygula (**+20 Puan**).\n` +
            `• Sesli odalarda mesai yap (**5 dk = +10 Puan**).\n` +
            `• Üst yöneticilerden başarılı görevlerin için **\`!ypuan ekle\`** ödülü al!`,
          inline: false
        });

        promoteEmbed.setFooter({
          text: 'Asgard Yönetim Kurulu • Yetkili Kariyer & İcraat Sistemi',
          iconURL: interaction.guild.iconURL()
        }).setTimestamp();

        return interaction.reply({ embeds: [promoteEmbed], ephemeral: true });
      }

      // 4. Handle Live Leaderboard Table Buttons
      if (customId.startsWith('leaderboard_view_') || customId === 'leaderboard_refresh') {
        const { LeaderboardManager } = require('../../utils/leaderboardManager');
        const mode = customId === 'leaderboard_refresh' ? 'ALL' : customId.replace('leaderboard_view_', '');
        const payload = await LeaderboardManager.buildLeaderboardPayload(interaction.guild, mode);
        return interaction.update(payload).catch(() => null);
      }
    }
  }
};
