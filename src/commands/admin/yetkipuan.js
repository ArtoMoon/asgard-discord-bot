const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const UserProfile = require('../../models/UserProfile');
const Logger = require('../../utils/logger');
const config = require('../../config');
const { RankManager } = require('../../utils/rankManager');

module.exports = {
  name: 'yetkili-puan',
  aliases: ['ypuan', 'yetkilipuan', 'terfi', 'staffpuan'],
  description: 'Yetkili kadrosuna başlatma, yetkili icraat puanı ekleme/çıkarma ve terfi yönetimi.',
  data: new SlashCommandBuilder()
    .setName('yetkili-puan')
    .setDescription('Yetkili kadrosu puan ve terfi yönetimi (Sadece Üst Yönetim).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('baslat')
        .setDescription('Bir üyeyi 1. Kademe Stajyer Yetkili (Thrall) olarak yetkili kadrosuna başlatır.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Yetkili yapılacak üye').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('ekle')
        .setDescription('Bir yetkiliye ödül/görev puanı ekler (şart dolarsa otomatik terfi alır).')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Puan verilecek yetkili').setRequired(true))
        .addIntegerOption(opt => opt.setName('puan').setDescription('Eklenecek puan miktarı').setRequired(true))
        .addStringOption(opt => opt.setName('sebep').setDescription('Puan verilme sebebi').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('cikar')
        .setDescription('Bir yetkiliden ceza nedeniyle puan düşer.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Puanı düşülecek yetkili').setRequired(true))
        .addIntegerOption(opt => opt.setName('puan').setDescription('Düşülecek puan miktarı').setRequired(true))
        .addStringOption(opt => opt.setName('sebep').setDescription('Puan düşülme sebebi').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('terfi')
        .setDescription('Bir yetkiliyi doğrudan 1 üst Asgard Yönetim Kademesine terfi ettirir.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Terfi ettirilecek yetkili').setRequired(true))
    ),

  async execute({ client, message, interaction, isSlash, guild, member, user, channel, args, reply }) {
    const settings = await GuildSettings.findOne({ guildId: guild.id });
    const devList = [...(config.developerIds || []), ...(settings?.developerUserIds || []), ...(settings?.safeUserIds || [])];
    const isAuthorized = guild.ownerId === member.id ||
      devList.includes(member.id) ||
      member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isAuthorized) {
      return reply({
        content: '🛡️ **Yetkisiz İşlem:** Bu komutu yalnızca **Sunucu Sahibi**, **Güvenli Liste** veya **Üst Yönetim** kullanabilir!',
        ephemeral: true
      });
    }

    let action = '';
    let targetMember = null;
    let points = 0;
    let reason = 'Üst Yönetim Değerlendirmesi';

    if (isSlash) {
      action = interaction.options.getSubcommand();
      const targetUser = interaction.options.getUser('kullanici');
      targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      points = interaction.options.getInteger('puan') || 0;
      reason = interaction.options.getString('sebep') || 'Üst Yönetim Değerlendirmesi';
    } else {
      const sub = (args[0] || '').toLowerCase();
      if (!['baslat', 'ekle', 'cikar', 'terfi'].includes(sub) || !args[1]) {
        return reply({
          content:
            `❌ **Kullanım:**\n` +
            `• \`!ypuan baslat @üye\` → Üyeyi 1. Kademe Yetkili (Thrall) olarak kadroya alır.\n` +
            `• \`!ypuan ekle @yetkili <puan> [sebep]\` → Yetkiliye ödül puanı verir.\n` +
            `• \`!ypuan cikar @yetkili <puan> [sebep]\` → Yetkiliden puan düşer.\n` +
            `• \`!ypuan terfi @yetkili\` → Yetkiliyi doğrudan 1 üst kademeye terfi ettirir.`
        });
      }
      action = sub;
      const targetId = args[1].replace(/[<@!>]/g, '');
      targetMember = await guild.members.fetch(targetId).catch(() => null);
      if (action === 'ekle' || action === 'cikar') {
        points = parseInt(args[2], 10) || 50;
        if (args.slice(3).length > 0) reason = args.slice(3).join(' ');
      }
    }

    if (!targetMember) {
      return reply({ content: '❌ Belirtilen kullanıcı sunucuda bulunamadı!', ephemeral: true });
    }

    let profile = await UserProfile.findOne({ guildId: guild.id, userId: targetMember.id });
    if (!profile) {
      profile = new UserProfile({ guildId: guild.id, userId: targetMember.id });
    }
    if (!profile.staff) {
      profile.staff = { isStaff: false, rank: 1, points: 0, registrations: 0, punishments: 0, voiceMinutes: 0, messages: 0, bonusPoints: 0 };
    }

    // 1. KADROYA BAŞLATMA (THRALL - STAJYER YETKİLİ)
    if (action === 'baslat') {
      profile.staff.isStaff = true;
      profile.staff.rank = 1;
      profile.currentRank = 1;
      await profile.save();

      const rank1 = RankManager.getRankByLevel(1);
      const r1Config = settings?.ranks?.find(r => r.rank === 1);
      if (r1Config?.roleId) {
        await targetMember.roles.add(r1Config.roleId, 'Asgard Yetkili Kadrosuna Başlatıldı').catch(() => null);
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('🛡️ [YETKİLİ KADROSU] Yeni Yetkili Göreve Başladı!')
        .setDescription(
          `**${targetMember}** kullanıcısı **${member}** tarafından Asgard Yönetim Kadrosuna alındı!\n\n` +
          `👑 **Başlangıç Kademesi:** **${rank1.name}** *(Kademe 1/10)*\n` +
          `🎁 **Görev Yetkileri:** ${rank1.perks.join(' • ')}\n\n` +
          `*Kayıt yaparak (+15p), moderasyon işlemi uygulayarak (+20p) ve sesli odalarda mesai yaparak otomatik terfi alabilir!*`
        )
        .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      return reply({ embeds: [embed] });
    }

    // 2. DOĞRUDAN 1 ÜST KADEMEYE TERFİ ETTİRME
    if (action === 'terfi') {
      profile.staff.isStaff = true;
      const currentRankNum = RankManager.detectMemberStaffRank(targetMember, settings, profile);
      if (currentRankNum >= 10) {
        return reply({ content: '⚠️ Bu yetkili zaten en üst kademede (**Odin\'s Champion**)!', ephemeral: true });
      }

      const nextRankObj = RankManager.getRankByLevel(currentRankNum + 1);
      const needed = Math.max(10, nextRankObj.requiredPoints - (profile.staff.points || 0));
      const res = await RankManager.addStaffAction(guild, targetMember, profile, settings, 'BONUS', needed);

      const embed = new EmbedBuilder()
        .setColor(config.colors.asgard)
        .setTitle('🎖️ [ÜST YÖNETİM TERFİSİ] Yetkili Kademesi Yükseltildi!')
        .setDescription(
          `**${targetMember}** adlı yetkili **${member}** tarafından bir üst kademeye terfi ettirildi!\n\n` +
          `👑 **Yeni Kademe:** **${nextRankObj.name}** *(Kademe ${nextRankObj.rank}/10)*\n` +
          `⭐ **Güncel Yetkili Puanı:** \`${profile.staff.points} Puan\`\n` +
          `🎁 **Yeni Yetkileri:**\n${nextRankObj.perks.map(p => `✅ ${p}`).join('\n')}`
        )
        .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      return reply({ embeds: [embed] });
    }

    // 3. PUAN EKLE / ÇIKAR
    const delta = action === 'cikar' ? -Math.abs(points) : Math.abs(points);
    profile.staff.isStaff = true;
    const result = await RankManager.addStaffAction(guild, targetMember, profile, settings, 'BONUS', delta);
    const currentRankObj = RankManager.getRankByLevel(profile.staff.rank || 1);

    const embed = new EmbedBuilder()
      .setColor(delta >= 0 ? config.colors.success : config.colors.warning)
      .setTitle(delta >= 0 ? '⭐ Yetkili Ödül Puanı Eklendi' : '⚠️ Yetkili Ceza Puanı Düşüldü')
      .setDescription(
        `**Yetkili:** ${targetMember}\n` +
        `**İşlemi Yapan:** ${member}\n` +
        `**Puan Değişimi:** \`${delta >= 0 ? '+' + delta : delta} Yetkili Puanı\`\n` +
        `**Sebep:** ${reason}\n\n` +
        `📊 **Güncel Yetkili Puanı:** \`${profile.staff.points} Puan\`\n` +
        `👑 **Mevcut Kademe:** **${currentRankObj.name}** *(Kademe ${currentRankObj.rank}/10)*` +
        (result.promoted ? `\n\n🎉 **OTOMATİK TERFİ:** Yetkili puanı barajı aştığı için **${result.newRank.name}** kademesine terfi etti!` : '')
      )
      .setTimestamp();

    return reply({ embeds: [embed] });
  }
};

