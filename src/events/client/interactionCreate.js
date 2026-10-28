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

        let profile = await UserProfile.findOne({ guildId: interaction.guildId, userId: targetUserId });
        if (!profile) {
          profile = new UserProfile({ guildId: interaction.guildId, userId: targetUserId });
        }

        const currentRank = RankManager.getRankByLevel(profile.currentRank);
        const progress = RankManager.getNextRankProgress(profile.currentRank, profile.weekly);
        const progressBar = RankManager.createProgressBar(progress.progressPercent, 14);

        const promoteEmbed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle(`🛡️ Yetkili Terfi & Yükselme Raporu: ${targetMember.displayName}`)
          .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
          .setDescription(
            `Asgard Yönetim Kadrosu haftalık performans ve terfi durumu aşağıda belirtilmiştir.\n` +
            `Yetkili kademeleri haftalık aktifliğe (sohbet, ses, XP) ve yönetim kurulu değerlendirmesine göre yükseltilir.`
          )
          .addFields(
            {
              name: '👑 Mevcut Yönetim Kademesi',
              value: `**${currentRank.name}** *(Kademe ${currentRank.rank} / 10)*\n` +
                `**Mevcut Yetkiler:** ${currentRank.perks.join(' • ')}`,
              inline: false
            },
            {
              name: '📊 Bu Haftaki Yönetim Performansı',
              value: `💬 **Mesaj:** \`${profile.weekly.messages}\` adet\n` +
                `🎙️ **Ses:** \`${profile.weekly.voiceMinutes}\` dakika\n` +
                `⚡ **Haftalık XP:** \`${profile.weekly.xp.toLocaleString()}\` XP`,
              inline: true
            },
            {
              name: '📈 Terfi İlerleme Oranı',
              value: `${progressBar}\n**Başarı:** %${progress.progressPercent}`,
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
          const isReady = progress.progressPercent >= 100;
          promoteEmbed.addFields(
            {
              name: `🎯 Sıradaki Yönetim Kademesi: ${progress.nextRank.name}`,
              value: `Yükseldiğinizde kazanacağınız yeni yetkiler:\n` +
                progress.nextRank.perks.map(p => `✨ ${p}`).join('\n'),
              inline: false
            },
            {
              name: isReady ? '🎉 Terfi Durumu: HAZIR!' : '⏳ Terfi İçin Kalan Eksikler',
              value: isReady
                ? `✅ **Tebrikler!** Bu haftaki tüm terfi şartlarını tamamladınız.\n` +
                  `Haftalık değerlendirmede veya üst yöneticiniz \`/yetki-ver\` onayı verdiğinde terfiniz gerçekleşir!`
                : `Bir sonraki kademeye terfi edebilmek için:\n` +
                  `• **${progress.neededMessages}** mesaj daha yazmalısınız.\n` +
                  `• **${progress.neededVoiceMinutes}** dakika daha ses odalarında aktif olmalısınız.\n` +
                  `• **${progress.neededXp.toLocaleString()}** XP daha kazanmalısınız.`,
              inline: false
            }
          );
        }

        promoteEmbed.addFields({
          name: '📅 Terfi & Değerlendirme Zamanı',
          value: `• **Haftalık Değerlendirme:** Her **Pazar gecesi 23:59'da** yetkili kadrosunun aktifliği kontrol edilir ve uygun yetkililer terfi ettirilir.\n` +
            `• **Erken Terfi:** Hedeflerini erkenden bitiren yetkililer, üst yönetimden \`/yetki-ver\` talebi isteyerek erken terfi alabilir.`,
          inline: false
        });

        promoteEmbed.setFooter({
          text: 'Asgard Yönetim Kurulu • Performans & Terfi Takip Sistemi',
          iconURL: interaction.guild.iconURL()
        }).setTimestamp();

        return interaction.reply({ embeds: [promoteEmbed], ephemeral: true });
      }
    }
  }
};
