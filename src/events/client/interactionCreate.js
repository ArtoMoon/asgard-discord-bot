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
      }
    }
  }
};
