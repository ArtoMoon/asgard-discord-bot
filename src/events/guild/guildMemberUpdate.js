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

      const staffRoleIds = settings.staffRoleIds || [];

      for (const [roleId, role] of addedRoles) {
        const isProtectedStaff = staffRoleIds.includes(roleId);
        const hasDangerousPerms = role.permissions.has(PermissionFlagsBits.Administrator) ||
          role.permissions.has(PermissionFlagsBits.ManageGuild) ||
          role.permissions.has(PermissionFlagsBits.BanMembers);

        if (isProtectedStaff || hasDangerousPerms) {
          // Check if this assignment was authorized via RoleRequest approved in the last 15 seconds
          const recentApproval = await RoleRequest.findOne({
            guildId: newMember.guild.id,
            targetUserId: newMember.id,
            roleId: roleId,
            status: 'APPROVED',
            reviewedAt: { $gte: new Date(Date.now() - 15000) }
          });

          // If no approved role request exists, it was added manually in Discord!
          if (!recentApproval) {
            // Fetch audit logs to see who manually gave this role
            let executor = null;
            try {
              const auditLogs = await newMember.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberRoleUpdate
              });
              const entry = auditLogs.entries.first();
              if (entry && entry.target.id === newMember.id && Date.now() - entry.createdTimestamp < 10000) {
                executor = entry.executor;
              }
            } catch (err) {
              Logger.warn('Audit log çekilemedi:', err.message);
            }

            // Developer bypass check: if executor is a registered developer, permit it
            const devList = [...(config.developerIds || []), ...(settings.developerUserIds || [])];
            if (executor && devList.includes(executor.id)) {
              continue;
            }

            // Unauthorized manual assignment: Remove role!
            await newMember.roles.remove(role, 'Güvenlik Protokolü: Developer onaysız el ile yetki verilemez.').catch(err => {
              Logger.error('İzinsiz rol geri alınamadı:', err.message);
            });

            // Send security alert to approval & mod log channels
            const alertEmbed = new EmbedBuilder()
              .setColor(config.colors.error)
              .setTitle('🚨 [GÜVENLİK İHLALİ] Onaysız Manuel Rol Verme Engellendi!')
              .setDescription(`Sunucuda bir yetkili bot onayı olmadan **manuel olarak yetki vermeye çalıştı** ve işlem iptal edildi.\n\n` +
                `👤 **Hedef Kullanıcı:** ${newMember} (${newMember.user.tag})\n` +
                `🛡️ **Verilmeye Çalışılan Rol:** ${role} (${role.name})\n` +
                `⚠️ **Müdahale Eden Yetkili:** ${executor ? `<@${executor.id}> (${executor.tag})` : 'Bilinmiyor (Hızlı İşlem)'}\n\n` +
                `*Not: Yetkiler sadece \`/yetki-ver\` komutu kullanılarak Developer onayı ile verilebilir!*`)
              .setTimestamp();

            const targetLogId = settings.approvalChannelId || settings.modLogChannelId;
            if (targetLogId) {
              await Logger.sendGuildLog(newMember.guild, targetLogId, alertEmbed);
            }

            Logger.warn(`[Yetki Koruması] ${newMember.user.tag} adlı kullanıcıya manuel ${role.name} verme girişimi engellendi.`);
          }
        }
      }
    } catch (err) {
      Logger.error('guildMemberUpdate eventinde hata:', err);
    }
  }
};
