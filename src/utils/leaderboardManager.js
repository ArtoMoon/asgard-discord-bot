const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UserProfile = require('../models/UserProfile');
const { RankManager } = require('./rankManager');
const config = require('../config');
const Logger = require('./logger');

class LeaderboardManager {
  /**
   * Sunucu için sıralama tablosu Embed ve Butonlarını oluşturur
   * @param {import('discord.js').Guild} guild
   * @param {'ALL'|'LEVEL'|'STAFF'|'VOICE'} mode
   */
  static async buildLeaderboardPayload(guild, mode = 'ALL') {
    const topXpUsers = await UserProfile.find({ guildId: guild.id, totalXp: { $gt: 0 } })
      .sort({ totalXp: -1 })
      .limit(10)
      .lean();

    const topVoiceUsers = await UserProfile.find({ guildId: guild.id, voiceMinutes: { $gt: 0 } })
      .sort({ voiceMinutes: -1 })
      .limit(10)
      .lean();

    const topStaffUsers = await UserProfile.find({ guildId: guild.id, 'staff.points': { $gt: 0 } })
      .sort({ 'staff.points': -1 })
      .limit(10)
      .lean();

    const medals = ['🥇', '🥈', '🥉', '`4.`', '`5.`', '`6.`', '`7.`', '`8.`', '`9.`', '`10.`'];

    const formatLevelRow = (u, idx) => {
      const lvl = u.level || RankManager.calculateLevel(u.totalXp);
      return `${medals[idx]} <@${u.userId}> — **Seviye ${lvl}** • \`${(u.totalXp || 0).toLocaleString()} XP\` *(💬 ${u.messageCount || 0} • 🎙️ ${u.voiceMinutes || 0}dk)*`;
    };

    const formatVoiceRow = (u, idx) => {
      const hours = Math.floor((u.voiceMinutes || 0) / 60);
      const mins = (u.voiceMinutes || 0) % 60;
      const timeStr = hours > 0 ? `${hours} sa ${mins} dk` : `${mins} dk`;
      return `${medals[idx]} <@${u.userId}> — 🎙️ **${timeStr}** *(${u.voiceMinutes} dk • 💬 ${u.messageCount || 0} mesaj)*`;
    };

    const formatStaffRow = (u, idx) => {
      const s = u.staff || {};
      const rObj = RankManager.getRankByLevel(s.rank || 1);
      return `${medals[idx]} <@${u.userId}> — ⭐ **${s.points || 0} Puan** • *${rObj.name.split(' ')[0]}* *(📝 ${s.registrations || 0} Kayıt • 🔨 ${s.punishments || 0} Ceza)*`;
    };

    const nowUnix = Math.floor(Date.now() / 1000);
    const nextUpdateUnix = nowUnix + 300; // +5 minutes

    const embed = new EmbedBuilder()
      .setColor(config.colors.asgard || 0x9b59b6)
      .setTitle(`🏆 ${guild.name.toUpperCase()} — CANLI SIRALAMA TABLOSU`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setDescription(
        `Asgard diyarının en aktif savaşçıları ve en başarılı yetkilileri aşağıda listelenmiştir.\n` +
        `🔄 **Son Güncelleme:** <t:${nowUnix}:R> • **Sonraki Güncelleme:** <t:${nextUpdateUnix}:R> *(5 dakikada bir otomatik)*`
      );

    if (mode === 'ALL' || mode === 'LEVEL') {
      const levelListText = topXpUsers.length > 0
        ? topXpUsers.slice(0, mode === 'LEVEL' ? 10 : 5).map((u, i) => formatLevelRow(u, i)).join('\n')
        : '*Henüz XP kazanan üye bulunmuyor.*';

      embed.addFields({
        name: '⭐ EN YÜKSEK SEVİYE & XP SIRALAMASI',
        value: levelListText,
        inline: false
      });
    }

    if (mode === 'ALL' || mode === 'VOICE') {
      const voiceListText = topVoiceUsers.length > 0
        ? topVoiceUsers.slice(0, mode === 'VOICE' ? 10 : 5).map((u, i) => formatVoiceRow(u, i)).join('\n')
        : '*Henüz ses aktifliği bulunan üye yok.*';

      embed.addFields({
        name: '🎙️ EN AKTİF SES SIRALAMASI',
        value: voiceListText,
        inline: false
      });
    }

    if (mode === 'ALL' || mode === 'STAFF') {
      const staffListText = topStaffUsers.length > 0
        ? topStaffUsers.slice(0, mode === 'STAFF' ? 10 : 5).map((u, i) => formatStaffRow(u, i)).join('\n')
        : '*Henüz yetkili icraat puanı bulunan yetkili yok.*';

      embed.addFields({
        name: '🛡️ EN BAŞARILI YETKİLİ (İCRAAT) SIRALAMASI',
        value: staffListText,
        inline: false
      });
    }

    embed.setFooter({
      text: 'Asgard Krallığı Canlı İstatistik & Sıralama Sistemi • Her 5 dakikada bir güncellenir',
      iconURL: guild.iconURL()
    }).setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('leaderboard_view_ALL')
        .setLabel('📊 Genel Tablo')
        .setStyle(mode === 'ALL' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('leaderboard_view_LEVEL')
        .setLabel('⭐ Top 10 Seviye')
        .setStyle(mode === 'LEVEL' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('leaderboard_view_VOICE')
        .setLabel('🎙️ Top 10 Ses')
        .setStyle(mode === 'VOICE' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('leaderboard_view_STAFF')
        .setLabel('🛡️ Top 10 Yetkili')
        .setStyle(mode === 'STAFF' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('leaderboard_refresh')
        .setLabel('🔄 Yenile')
        .setStyle(ButtonStyle.Success)
    );

    return { embeds: [embed], components: [row] };
  }

  /**
   * Sunucunun sabit sıralama tablosu mesajını günceller (yoksa yeni gönderir)
   */
  static async updateGuildLeaderboard(guild, settings) {
    if (!guild || !settings || !settings.leaderboardChannelId) return null;

    try {
      const channel = guild.channels.cache.get(settings.leaderboardChannelId)
        || await guild.channels.fetch(settings.leaderboardChannelId).catch(() => null);

      if (!channel || !channel.isTextBased()) return null;

      const payload = await this.buildLeaderboardPayload(guild, 'ALL');

      // Mevcut mesaj varsa düzenle
      if (settings.leaderboardMessageId) {
        const existingMsg = await channel.messages.fetch(settings.leaderboardMessageId).catch(() => null);
        if (existingMsg) {
          await existingMsg.edit(payload);
          return existingMsg;
        }
      }

      // Mesaj yoksa veya silinmişse yeni gönder ve ID'sini kaydet
      const newMsg = await channel.send(payload);
      settings.leaderboardMessageId = newMsg.id;
      await settings.save().catch(() => null);
      return newMsg;
    } catch (err) {
      Logger.warn(`[Sıralama Tablosu] ${guild.name} güncellenemedi: ${err.message}`);
      return null;
    }
  }
}

module.exports = { LeaderboardManager };
