const { EmbedBuilder } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const UserProfile = require('../../models/UserProfile');
const Logger = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  name: 'presenceUpdate',
  async execute(client, oldPresence, newPresence) {
    if (!newPresence || !newPresence.member || newPresence.member.user.bot) return;

    try {
      const member = newPresence.member;
      const guild = newPresence.guild;

      const settings = await GuildSettings.findOne({ guildId: guild.id });
      if (!settings || !Array.isArray(settings.staffRoleIds) || settings.staffRoleIds.length === 0) {
        return;
      }

      // Sunucu Sahibi ve Developer'lar görünmezlik korumasından muaftır (yetkileri düşmez)
      const devList = [...(config.developerIds || []), ...(settings.developerUserIds || [])];
      if (member.id === guild.ownerId || devList.includes(member.id)) {
        return;
      }

      const oldStatus = oldPresence ? oldPresence.status : 'offline';
      const newStatus = newPresence.status;

      let profile = await UserProfile.findOne({ guildId: guild.id, userId: member.id });
      if (!profile) {
        profile = new UserProfile({ guildId: guild.id, userId: member.id });
      }

      // 1. Yetkili Çevrimdışı / Görünmez (Offline) moda geçti -> Yetkilerini askıya al
      if (newStatus === 'offline' && oldStatus !== 'offline') {
        // Sadece panelde yetkili olarak işaretlenmiş (staffRoleIds) rolleri askıya al
        const staffRolesToSuspend = member.roles.cache
          .filter(r => settings.staffRoleIds.includes(r.id))
          .map(r => r.id);

        if (staffRolesToSuspend.length > 0) {
          profile.offlineStaffSuspendedRoles = staffRolesToSuspend;
          await profile.save();

          await member.roles.remove(staffRolesToSuspend, 'Görünmezlik / Çevrimdışı Koruması: Yetkili rolü askıya alındı.').catch(err => {
            Logger.warn(`Görünmezlik koruması rol alırken hata: ${err.message}`);
          });

          // Mod Log bildirimi
          if (settings.modLogChannelId) {
            const embed = new EmbedBuilder()
              .setColor(config.colors.warning)
              .setTitle('🛡️ [GÖRÜNMEZLİK KORUMASI] Yetkili Rolleri Askıya Alındı')
              .setDescription(`**Yetkili:** ${member} (\`${member.user.tag}\`)\n` +
                `**Durum:** Çevrimdışı / Görünmez moda geçti.\n` +
                `**Askıya Alınan Roller:**\n${staffRolesToSuspend.map(id => `• <@&${id}>`).join('\n')}\n\n` +
                `*Yetkili tekrar aktif/çevrimiçi olduğunda rolleri otomatik olarak iade edilecektir.*`)
              .setFooter({ text: 'Asgard Güvenlik & Görünmezlik Koruması' })
              .setTimestamp();

            await Logger.sendGuildLog(guild, settings.modLogChannelId, embed);
          }
        }
      }

      // 2. Yetkili Çevrimiçi (Online / DND / Idle) oldu -> Askıdaki yetkilerini geri ver
      else if (newStatus !== 'offline' && oldStatus === 'offline') {
        if (Array.isArray(profile.offlineStaffSuspendedRoles) && profile.offlineStaffSuspendedRoles.length > 0) {
          const rolesToRestore = profile.offlineStaffSuspendedRoles.filter(rId => guild.roles.cache.has(rId));

          if (rolesToRestore.length > 0) {
            await member.roles.add(rolesToRestore, 'Görünmezlik / Çevrimdışı Koruması: Aktif olunduğu için roller iade edildi.').catch(err => {
              Logger.warn(`Görünmezlik koruması rol verirken hata: ${err.message}`);
            });

            if (settings.modLogChannelId) {
              const embed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle('✅ [GÖRÜNMEZLİK KORUMASI] Yetkili Rolleri İade Edildi')
                .setDescription(`**Yetkili:** ${member} (\`${member.user.tag}\`)\n` +
                  `**Durum:** Tekrar aktif (çevrimiçi) oldu.\n` +
                  `**İade Edilen Roller:**\n${rolesToRestore.map(id => `• <@&${id}>`).join('\n')}`)
                .setFooter({ text: 'Asgard Güvenlik & Görünmezlik Koruması' })
                .setTimestamp();

              await Logger.sendGuildLog(guild, settings.modLogChannelId, embed);
            }
          }

          profile.offlineStaffSuspendedRoles = [];
          await profile.save();
        }
      }
    } catch (err) {
      Logger.error('presenceUpdate hatası:', err.message);
    }
  }
};
