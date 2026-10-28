const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const UserProfile = require('../../models/UserProfile');
const Logger = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  name: 'presenceUpdate',
  async execute(client, oldPresence, newPresence) {
    if (!newPresence || !newPresence.member || newPresence.member.user.bot) return;

    const member = newPresence.member;
    const guild = newPresence.guild;

    try {
      const settings = await GuildSettings.findOne({ guildId: guild.id });
      if (!settings) return;

      const oldStatus = oldPresence ? oldPresence.status : 'offline';
      const newStatus = newPresence.status;

      let profile = await UserProfile.findOne({ guildId: guild.id, userId: member.id });
      if (!profile) {
        profile = new UserProfile({ guildId: guild.id, userId: member.id });
      }

      // 1. User switched to OFFLINE / INVISIBLE
      if (newStatus === 'offline' && oldStatus !== 'offline') {
        // Find if member holds staff roles
        const staffRolesToSuspend = [];

        member.roles.cache.forEach(role => {
          // Check if role is explicitly marked as staff role OR has dangerous/mod permissions
          const isConfiguredStaff = settings.staffRoleIds && settings.staffRoleIds.includes(role.id);
          const hasModPerms = role.permissions.has(PermissionFlagsBits.Administrator) ||
            role.permissions.has(PermissionFlagsBits.BanMembers) ||
            role.permissions.has(PermissionFlagsBits.KickMembers) ||
            role.permissions.has(PermissionFlagsBits.ManageGuild) ||
            role.permissions.has(PermissionFlagsBits.ManageRoles);

          if (isConfiguredStaff || hasModPerms) {
            staffRolesToSuspend.push(role.id);
          }
        });

        if (staffRolesToSuspend.length > 0) {
          profile.offlineStaffSuspendedRoles = staffRolesToSuspend;
          await profile.save();

          // Remove roles from member
          await member.roles.remove(staffRolesToSuspend, 'Görünmez/Çevrimdışı mod koruması: Yetkiler askıya alındı.').catch(err => {
            Logger.error(`Yetki rolleri alınırken hata:`, err.message);
          });

          // Log to mod channel
          if (settings.modLogChannelId) {
            const embed = new EmbedBuilder()
              .setColor(config.colors.warning)
              .setTitle('🛡️ [GÖRÜNMEZLİK KORUMASI] Yetkiler Askıya Alındı')
              .setDescription(`**Yetkili:** ${member} (${member.user.tag})\n` +
                `**Durum:** Çevrimdışı / Görünmez moda geçti.\n` +
                `**Askıya Alınan Roller:**\n${staffRolesToSuspend.map(rId => `• <@&${rId}>`).join('\n')}\n\n` +
                `*Yetkili tekrar çevrimiçi olduğunda rolleri otomatik olarak iade edilecektir.*`)
              .setTimestamp();

            await Logger.sendGuildLog(guild, settings.modLogChannelId, embed);
          }

          Logger.warn(`[Görünmezlik Koruması] ${member.user.tag} çevrimdışı olduğu için ${staffRolesToSuspend.length} yetki rolü askıya alındı.`);
        }
      }

      // 2. User came back ONLINE / IDLE / DND
      else if (newStatus !== 'offline' && oldStatus === 'offline') {
        if (profile.offlineStaffSuspendedRoles && profile.offlineStaffSuspendedRoles.length > 0) {
          const rolesToRestore = profile.offlineStaffSuspendedRoles.filter(rId => guild.roles.cache.has(rId));

          if (rolesToRestore.length > 0) {
            await member.roles.add(rolesToRestore, 'Çevrimiçi moda dönüldü: Askıdaki yetkiler iade edildi.').catch(err => {
              Logger.error(`Yetki rolleri iade edilirken hata:`, err.message);
            });

            if (settings.modLogChannelId) {
              const embed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle('✅ [GÖRÜNMEZLİK KORUMASI] Yetkiler İade Edildi')
                .setDescription(`**Yetkili:** ${member} (${member.user.tag})\n` +
                  `**Durum:** Tekrar aktif / çevrimiçi oldu.\n` +
                  `**İade Edilen Roller:**\n${rolesToRestore.map(rId => `• <@&${rId}>`).join('\n')}`)
                .setTimestamp();

              await Logger.sendGuildLog(guild, settings.modLogChannelId, embed);
            }

            Logger.info(`[Görünmezlik Koruması] ${member.user.tag} çevrimiçi oldu, rolleri iade edildi.`);
          }

          profile.offlineStaffSuspendedRoles = [];
          await profile.save();
        }
      }
    } catch (err) {
      Logger.error('presenceUpdate eventinde hata:', err);
    }
  }
};
