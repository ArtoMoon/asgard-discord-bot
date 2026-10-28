const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const UserProfile = require('../../models/UserProfile');
const Logger = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  name: 'jail',
  aliases: ['unjail', 'cezali'],
  description: 'Bir üyeyi cezalıya (Jail) atar veya cezalısını kaldırır.',
  data: new SlashCommandBuilder()
    .setName('jail')
    .setDescription('Cezalı (Jail) sistem komutları.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub.setName('at')
        .setDescription('Kullanıcıyı cezalıya atar (tüm rollerini alıp Jail rolü verir).')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Cezalandırılacak üye').setRequired(true))
        .addStringOption(opt => opt.setName('sebep').setDescription('Cezalandırma sebebi').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('cikar')
        .setDescription('Kullanıcının cezasını kaldırıp eski rollerini iade eder.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Cezası kaldırılacak üye').setRequired(true))
    ),

  async execute({ client, message, interaction, isSlash, guild, member, user, channel, args, reply }) {
    if (!member.permissions.has(PermissionFlagsBits.ModerateMembers) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      return reply({ content: '❌ Bu komutu kullanabilmek için **Üyeleri Yönet (Moderate Members)** yetkisine sahip olmalısınız!', ephemeral: true });
    }

    const settings = await GuildSettings.findOne({ guildId: guild.id });
    if (!settings || !settings.jailRoleId) {
      return reply({ content: '❌ Cezalı (Jail) rolü ayarlanmamış! Lütfen önce `/kurulum` yapınız veya `/settings jail-rol` belirleyiniz.', ephemeral: true });
    }

    const jailRole = guild.roles.cache.get(settings.jailRoleId);
    if (!jailRole) {
      return reply({ content: '❌ Sunucuda ayarlanan Jail rolü bulunamadı!', ephemeral: true });
    }

    let isUnjail = false;
    let targetMember = null;
    let reason = 'Belirtilmedi';

    if (isSlash) {
      const sub = interaction.options.getSubcommand();
      isUnjail = (sub === 'cikar');
      const targetUser = interaction.options.getUser('kullanici');
      targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      reason = interaction.options.getString('sebep') || 'Belirtilmedi';
    } else {
      // Prefix handling: !jail or !unjail
      const invoked = message.content.slice(settings.prefix?.length || 1).trim().split(/ +/)[0].toLowerCase();
      isUnjail = invoked === 'unjail' || args[0]?.toLowerCase() === 'cikar';

      const targetArg = isUnjail && args[0]?.toLowerCase() === 'cikar' ? args[1] : args[0];
      if (!targetArg) {
        return reply({ content: `❌ **Kullanım:** \`${settings.prefix || '!'}jail @üye [sebep]\` veya \`${settings.prefix || '!'}unjail @üye\`` });
      }

      const targetId = targetArg.replace(/[<@!>]/g, '');
      targetMember = await guild.members.fetch(targetId).catch(() => null);
      const reasonIndex = (isUnjail && args[0]?.toLowerCase() === 'cikar') ? 2 : 1;
      if (args.slice(reasonIndex).length > 0) {
        reason = args.slice(reasonIndex).join(' ');
      }
    }

    if (!targetMember) {
      return reply({ content: '❌ İşlem yapılacak üye sunucuda bulunamadı!', ephemeral: true });
    }

    if (targetMember.id === client.user.id) {
      return reply({ content: '❌ Botu cezalıya atamazsınız!', ephemeral: true });
    }

    // Role hierarchy check
    const botMember = await guild.members.fetchMe();
    if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
      return reply({ content: '❌ Bu üyenin rolü botun rolünden daha yüksek olduğu için ceza uygulanamaz!', ephemeral: true });
    }

    let profile = await UserProfile.findOne({ guildId: guild.id, userId: targetMember.id });
    if (!profile) {
      profile = new UserProfile({ guildId: guild.id, userId: targetMember.id });
    }

    // 1. UNJAIL
    if (isUnjail) {
      if (!profile.isJailed && !targetMember.roles.cache.has(jailRole.id)) {
        return reply({ content: '⚠️ Bu kullanıcı zaten cezalıda değil!', ephemeral: true });
      }

      // Remove Jail Role
      await targetMember.roles.remove(jailRole).catch(err => {
        Logger.error('Jail rolü alınırken hata:', err.message);
      });

      // Restore backed up roles
      if (profile.jailedRoles && profile.jailedRoles.length > 0) {
        const rolesToRestore = profile.jailedRoles.filter(rId => guild.roles.cache.has(rId) && rId !== jailRole.id);
        if (rolesToRestore.length > 0) {
          await targetMember.roles.add(rolesToRestore).catch(err => {
            Logger.error('Roller iade edilirken hata:', err.message);
          });
        }
      }

      profile.isJailed = false;
      profile.jailedRoles = [];
      await profile.save();

      const unjailEmbed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('⛓️ [CEZA KALDIRILDI] Kullanıcı Cezalıdan Çıkarıldı')
        .setDescription(`**${targetMember}** kullanıcısının cezası **${member}** tarafından kaldırıldı ve eski rolleri iade edildi.`)
        .setFooter({ text: 'Asgard Güvenlik & Adalet Sistemi', iconURL: guild.iconURL() })
        .setTimestamp();

      await reply({ embeds: [unjailEmbed] });

      const targetLogId = settings.jailLogChannelId || settings.modLogChannelId;
      if (targetLogId) {
        await Logger.sendGuildLog(guild, targetLogId, unjailEmbed);
      }
      return;
    }

    // 2. JAIL
    if (targetMember.roles.cache.has(jailRole.id) || profile.isJailed) {
      return reply({ content: '⚠️ Bu üye zaten şu anda cezalıda!', ephemeral: true });
    }

    // Save existing roles
    const existingRoles = targetMember.roles.cache
      .filter(r => r.id !== guild.id && !r.managed && r.id !== jailRole.id)
      .map(r => r.id);

    profile.jailedRoles = existingRoles;
    profile.isJailed = true;
    await profile.save();

    // Strip roles and give jail role
    await targetMember.roles.set([jailRole.id], `Jail Cezası: ${reason}`).catch(err => {
      Logger.error('Kullanıcı cezalıya atılırken hata:', err.message);
    });

    const jailEmbed = new EmbedBuilder()
      .setColor(config.colors.error)
      .setTitle('⛓️ [CEZALANDIRMA] Kullanıcı Cezalıya (Jail) Atıldı')
      .setDescription(
        `**Cezalandırılan Üye:** ${targetMember} (\`${targetMember.user.tag}\`)\n` +
        `**Yetkili:** ${member} (\`${member.user.tag}\`)\n` +
        `**Sebep:** ${reason}\n\n` +
        `*Kullanıcının tüm rolleri geçici olarak alınmış ve sadece Cezalı rolü tanımlanmıştır.*`
      )
      .setFooter({ text: 'Asgard Güvenlik & Ceza Sistemi', iconURL: guild.iconURL() })
      .setTimestamp();

    await reply({ embeds: [jailEmbed] });

    const targetLogId = settings.jailLogChannelId || settings.modLogChannelId;
    if (targetLogId) {
      await Logger.sendGuildLog(guild, targetLogId, jailEmbed);
    }

    Logger.warn(`[Jail] ${targetMember.user.tag} üyesi ${member.user.tag} tarafından cezalıya atıldı. Sebep: ${reason}`);
  }
};
