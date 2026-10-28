const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const UserProfile = require('../../models/UserProfile');
const config = require('../../config');
const { RankManager } = require('../../utils/rankManager');

module.exports = {
  name: 'seviye',
  aliases: ['level', 'lvl', 'xp'],
  description: 'Üyelerin seviye (1-50) ve XP verilerini sıfırlama veya ayarlama komutu (Yetkili puanından ayrıdır).',
  data: new SlashCommandBuilder()
    .setName('seviye')
    .setDescription('Üye Seviye (Level 1-50) ve XP yönetimi (Yetkili puanından bağımsız).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('sifirla')
        .setDescription('Bir üyenin sadece Level ve XP verilerini sıfırlar (Yetkili puanına dokunmaz).')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Seviyesi sıfırlanacak üye').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('ayarla')
        .setDescription('Bir üyenin seviyesini (1-50) doğrudan ayarlar.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Seviyesi ayarlanacak üye').setRequired(true))
        .addIntegerOption(opt => opt.setName('seviye').setDescription('Yeni seviye (1-50)').setMinValue(1).setMaxValue(50).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('xp-ekle')
        .setDescription('Bir üyeye XP ekler.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('XP verilecek üye').setRequired(true))
        .addIntegerOption(opt => opt.setName('miktar').setDescription('Eklenecek XP miktarı').setRequired(true))
    ),

  async execute({ client, message, interaction, isSlash, guild, member, user, channel, args, reply }) {
    const settings = await GuildSettings.findOne({ guildId: guild.id });
    const devList = [...(config.developerIds || []), ...(settings?.developerUserIds || []), ...(settings?.safeUserIds || [])];
    const isAuthorized = guild.ownerId === member.id ||
      devList.includes(member.id) ||
      member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isAuthorized) {
      return reply({
        content: '🛡️ **Yetkisiz İşlem:** Bu komutu yalnızca **Sunucu Sahibi**, **Güvenli Liste** veya **Yönetici** kullanabilir!',
        ephemeral: true
      });
    }

    let action = '';
    let targetMember = null;
    let value = 0;

    if (isSlash) {
      action = interaction.options.getSubcommand();
      const targetUser = interaction.options.getUser('kullanici');
      targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      value = interaction.options.getInteger('seviye') || interaction.options.getInteger('miktar') || 0;
    } else {
      const sub = (args[0] || '').toLowerCase();
      if (!['sifirla', 'ayarla', 'xp-ekle', 'ekle'].includes(sub) || !args[1]) {
        return reply({
          content:
            `❌ **Seviye Yönetimi Kullanımı:**\n` +
            `• \`!seviye sifirla @üye\` → Üyenin sadece Seviye ve XP'sini sıfırlar *(Yetkili puanına dokunmaz)*.\n` +
            `• \`!seviye ayarla @üye <1-50>\` → Üyenin seviyesini doğrudan ayarlar.\n` +
            `• \`!seviye ekle @üye <xp>\` → Üyeye XP ekler.`
        });
      }
      action = sub === 'ekle' ? 'xp-ekle' : sub;
      const targetId = args[1].replace(/[<@!>]/g, '');
      targetMember = await guild.members.fetch(targetId).catch(() => null);
      value = parseInt(args[2], 10) || 1;
    }

    if (!targetMember) {
      return reply({ content: '❌ Belirtilen kullanıcı sunucuda bulunamadı!', ephemeral: true });
    }

    let profile = await UserProfile.findOne({ guildId: guild.id, userId: targetMember.id });
    if (!profile) {
      profile = new UserProfile({ guildId: guild.id, userId: targetMember.id });
    }

    // 1. SEVİYE & XP SIFIRLAMA
    if (action === 'sifirla') {
      profile.totalXp = 0;
      profile.level = 1;
      profile.messageCount = 0;
      profile.voiceMinutes = 0;
      profile.voiceJoinedAt = null;
      profile.weekly = { messages: 0, voiceMinutes: 0, xp: 0, weekStartDate: new Date() };
      await profile.save();

      // Üzerindeki seviye rollerini (10, 20, 30, 40, 50) temizle
      if (settings && Array.isArray(settings.levelRoles)) {
        const levelRoleIds = settings.levelRoles.map(lr => lr.roleId).filter(Boolean);
        for (const rId of levelRoleIds) {
          if (targetMember.roles.cache.has(rId)) {
            await targetMember.roles.remove(rId, 'Seviye sıfırlandı').catch(() => null);
          }
        }
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.warning)
        .setTitle('🔄 [SEVİYE SIFIRLANDI] Üye Seviyesi Sıfırlandı')
        .setDescription(
          `**${targetMember}** kullanıcısının **Seviye ve XP** verileri **${member}** tarafından sıfırlandı!\n\n` +
          `⭐ **Yeni Seviye:** \`Seviye 1 (0 XP)\`\n` +
          `🛡️ *Not: Kullanıcının Yetkili Puanı ve Yetkili Kademesine dokunulmamıştır.*`
        )
        .setTimestamp();

      return reply({ embeds: [embed] });
    }

    // 2. SEVİYE AYARLAMA (1-50)
    if (action === 'ayarla') {
      const newLevel = Math.max(1, Math.min(50, value));
      const newXp = RankManager.xpForLevel(newLevel);
      profile.level = newLevel;
      profile.totalXp = newXp;
      await profile.save();

      const milestone = RankManager.getHighestMilestoneReached(newLevel);
      if (milestone && settings && Array.isArray(settings.levelRoles)) {
        const roleCfg = settings.levelRoles.find(r => r.level === milestone.level);
        if (roleCfg?.roleId) {
          await targetMember.roles.add(roleCfg.roleId, `Seviye ${newLevel} olarak ayarlandı`).catch(() => null);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('⭐ [SEVİYE AYARLANDI] Üye Seviyesi Güncellendi')
        .setDescription(
          `**${targetMember}** kullanıcısının seviyesi **${member}** tarafından ayarlandı!\n\n` +
          `⭐ **Yeni Seviye:** **Seviye ${newLevel} / 50**\n` +
          `✨ **Yeni XP:** \`${newXp.toLocaleString()} XP\`\n` +
          (milestone ? `🎁 **Açık Seviye İzni:** ${milestone.perk}` : '')
        )
        .setTimestamp();

      return reply({ embeds: [embed] });
    }

    // 3. XP EKLEME
    if (action === 'xp-ekle') {
      profile.totalXp = Math.max(0, (profile.totalXp || 0) + value);
      profile.level = RankManager.calculateLevel(profile.totalXp);
      await profile.save();

      return reply({
        content: `✅ **${targetMember}** kullanıcısına \`+${value} XP\` eklendi! Güncel: **Seviye ${profile.level}** (\`${profile.totalXp} XP\`).`
      });
    }
  }
};

