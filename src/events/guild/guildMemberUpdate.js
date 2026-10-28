const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const RoleRequest = require('../../models/RoleRequest');
const Logger = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(client, oldMember, newMember) {
    if (newMember.user.bot) return;

    try {
      const settings = await GuildSettings.findOne({ guildId: newMember.guild.id });
      if (!settings) return;

      // Identify newly added roles
      const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
      if (addedRoles.size === 0) return;

      // Fetch audit logs to see who gave the role
      let executor = null;
      try {
        const auditLogs = await newMember.guild.fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.MemberRoleUpdate
        });
        const entry = auditLogs.entries.first();
        if (entry && entry.target.id === newMember.id && Date.now() - entry.createdTimestamp < 15000) {
          executor = entry.executor;
        }
      } catch (err) {
        Logger.warn('Audit log çekilemedi:', err.message);
      }

      // Check if executor is the BOT itself (Level roles, Oto-rol, Kayıt vb.)
      if (executor && executor.id === client.user.id) {
        return;
      }

      // Check if executor is Server Owner
      if (executor && executor.id === newMember.guild.ownerId) {
        return;
      }

      // Check if executor is in Developer Whitelist
      const devList = [...(config.developerIds || []), ...(settings.developerUserIds || [])];
      if (executor && devList.includes(executor.id)) {
        return;
      }

      // Check if executor is in Safe Whitelist (Güvenli Liste)
      const safeList = settings.safeUserIds || [];
      if (executor && safeList.includes(executor.id)) {
        return;
      }

      for (const [roleId, role] of addedRoles) {
        // Check if this assignment was authorized via RoleRequest approved in the last 30 seconds
        const recentApproval = await RoleRequest.findOne({
          guildId: newMember.guild.id,
          targetUserId: newMember.id,
          roleId: roleId,
          status: 'APPROVED',
          reviewedAt: { $gte: new Date(Date.now() - 30000) }
        });

        if (recentApproval) {
          continue;
        }

        // Check if role is an automatic bot role (Oto-rol / Kayıt / Seviye)
        const isBotManagedRole = roleId === settings.autoRoleId ||
          roleId === settings.unverifiedRoleId ||
          roleId === settings.registeredRoleId ||
          (settings.levelRoles && settings.levelRoles.some(lr => lr.roleId === roleId));

        if (!executor && isBotManagedRole) {
          continue;
        }

        // UNAUTHORIZED ROLE GRANT DETECTED!
        // Immediately remove role
        await newMember.roles.remove(role, 'Guard Protokolü: Güvenli listede olmayan kullanıcılar Discord üzerinden el ile rol veremez.').catch(err => {
          Logger.error('Yetkisiz rol geri alınamadı:', err.message);
        });

        Logger.warn(`[Guard - Rol Koruması] ${newMember.user.tag} adlı kullanıcıya el ile ${role.name} verme girişimi engellendi ve rol geri alındı! (Müdahale eden: ${executor ? executor.tag : 'Bilinmiyor'})`);

        // Send security alert embed to mod-log / approval channel
        const alertEmbed = new EmbedBuilder()
          .setColor(config.colors.error)
          .setTitle('🚨 [GUARD] Yetkisiz Manuel Rol Verme Engellendi!')
          .setDescription(`Sunucuda güvenli listede olmayan bir yetkili Discord üzerinden **el ile rol vermeye çalıştı** ve rol derhal geri alındı.\n\n` +
            `👤 **Hedef Kullanıcı:** ${newMember} (\`${newMember.id}\`)\n` +
            `🛡️ **Verilmeye Çalışılan Rol:** ${role} (\`${role.name}\`)\n` +
            `⚠️ **Müdahale Eden Yetkili:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : 'Audit Log algılanamadı'}\n\n` +
            `*Güvenlik Politikası: Yalnızca bot ve Güvenli Liste (Whitelist) onaylı kullanıcılar rol işlemi yapabilir.*`)
          .setFooter({ text: 'Asgard Güvenlik & Guard Sistemi' })
          .setTimestamp();

        const targetLogId = settings.modLogChannelId || settings.approvalChannelId;
        if (targetLogId) {
          await Logger.sendGuildLog(newMember.guild, targetLogId, alertEmbed);
        }
      }
    } catch (err) {
      Logger.error('guildMemberUpdate eventinde hata:', err);
    }
  }
};
