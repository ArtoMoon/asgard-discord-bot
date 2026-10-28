/**
 * 10 Asgard Public Server Ranks System
 * Her rütbe haftalık görevler (mesaj, ses, XP) ile yükselir ve üyelere özel ayrıcalıklar (perks) tanır.
 */
const ASGARD_RANKS = [
  {
    rank: 1,
    name: 'Thrall (Yeni Savaşçı)',
    roleName: 'Asgard - Thrall',
    color: '#95a5a6',
    requiredWeeklyXp: 0,
    requiredMessages: 0,
    requiredVoiceMinutes: 0,
    perks: ['Genel Sohbet & Sesli Kanallara Erişim', 'Temel Asgard Hakları']
  },
  {
    rank: 2,
    name: 'Karl (Özgür Üye)',
    roleName: 'Asgard - Karl',
    color: '#3498db',
    requiredWeeklyXp: 500,
    requiredMessages: 50,
    requiredVoiceMinutes: 30,
    perks: ['Görsel & Resim Gönderme Yetkisi', 'Özel Metin Kanalları']
  },
  {
    rank: 3,
    name: 'Berserker (Yırtıcı)',
    roleName: 'Asgard - Berserker',
    color: '#e67e22',
    requiredWeeklyXp: 1200,
    requiredMessages: 120,
    requiredVoiceMinutes: 60,
    perks: ['Harici Emoji & Sticker Kullanabilme', 'GIF Paylaşabilme']
  },
  {
    rank: 4,
    name: 'Hersir (Akıncı)',
    roleName: 'Asgard - Hersir',
    color: '#2ecc71',
    requiredWeeklyXp: 2200,
    requiredMessages: 200,
    requiredVoiceMinutes: 120,
    perks: ['Bağlantı (Link) Paylaşabilme', 'Mesajlara Tepki Ekleyebilme']
  },
  {
    rank: 5,
    name: 'Thegn (Muhafız)',
    roleName: 'Asgard - Thegn',
    color: '#1abc9c',
    requiredWeeklyXp: 3500,
    requiredMessages: 300,
    requiredVoiceMinutes: 200,
    perks: ['Yayında 1080p/60FPS Açabilme', 'Öncelikli Etkinlik Bildirimleri']
  },
  {
    rank: 6,
    name: 'Jarl (Soylu Savaşçı)',
    roleName: 'Asgard - Jarl',
    color: '#9b59b6',
    requiredWeeklyXp: 5000,
    requiredMessages: 450,
    requiredVoiceMinutes: 300,
    perks: ['Çekilişlerde 2x Kazanma Şansı', 'Sesli Odalarda Kamera Açma Önceliği']
  },
  {
    rank: 7,
    name: 'Einherjar (Valhalla Seçilmişi)',
    roleName: 'Asgard - Einherjar',
    color: '#e74c3c',
    requiredWeeklyXp: 7000,
    requiredMessages: 600,
    requiredVoiceMinutes: 450,
    perks: ['Öncelikli Konuşmacı Yetkisi', 'Özel Valhalla Sohbet Kanalı']
  },
  {
    rank: 8,
    name: 'Valkyrie (Kader Rehberi)',
    roleName: 'Asgard - Valkyrie',
    color: '#fd79a8',
    requiredWeeklyXp: 9500,
    requiredMessages: 800,
    requiredVoiceMinutes: 600,
    perks: ['Çekilişlerde 3x Kazanma Şansı', 'Sesli Oda Yönetim İzni']
  },
  {
    rank: 9,
    name: 'Aesir (Tanrılar Meclisi)',
    roleName: 'Asgard - Aesir',
    color: '#f39c12',
    requiredWeeklyXp: 13000,
    requiredMessages: 1100,
    requiredVoiceMinutes: 850,
    perks: ['Alt Rütbelere Rehberlik Rozeti', 'Özel VIP Ses Odası Açabilme']
  },
  {
    rank: 10,
    name: 'Odin\'s Champion (Asgard Şampiyonu)',
    roleName: 'Asgard - Odin\'s Champion',
    color: '#f1c40f',
    requiredWeeklyXp: 18000,
    requiredMessages: 1500,
    requiredVoiceMinutes: 1200,
    perks: ['Tüm Ayrıcalıklar Açık', 'Efsanevi Asgard Tacı Rozeti', 'VIP Özel Destek & Çekiliş Hakkı']
  }
];

class RankManager {
  static getRanks() {
    return ASGARD_RANKS;
  }

  static getRankByLevel(level) {
    const validLevel = Math.max(1, Math.min(10, level || 1));
    return ASGARD_RANKS.find(r => r.rank === validLevel) || ASGARD_RANKS[0];
  }

  /**
   * Determine eligible rank based on weekly performance
   */
  static calculateEligibleRank(weeklyStats) {
    const { messages = 0, voiceMinutes = 0, xp = 0 } = weeklyStats;
    let highestEligible = ASGARD_RANKS[0];

    for (const rank of ASGARD_RANKS) {
      if (
        xp >= rank.requiredWeeklyXp &&
        messages >= rank.requiredMessages &&
        voiceMinutes >= rank.requiredVoiceMinutes
      ) {
        highestEligible = rank;
      }
    }
    return highestEligible;
  }

  /**
   * Get progress towards the next rank
   */
  static getNextRankProgress(currentRankLevel, weeklyStats) {
    const current = this.getRankByLevel(currentRankLevel);
    if (currentRankLevel >= 10) {
      return {
        nextRank: null,
        isMax: true,
        progressPercent: 100,
        xpPercent: 100,
        msgPercent: 100,
        voicePercent: 100
      };
    }

    const next = this.getRankByLevel(currentRankLevel + 1);
    const { messages = 0, voiceMinutes = 0, xp = 0 } = weeklyStats;

    const xpPercent = Math.min(100, Math.floor((xp / next.requiredWeeklyXp) * 100)) || 0;
    const msgPercent = Math.min(100, Math.floor((messages / next.requiredMessages) * 100)) || 0;
    const voicePercent = Math.min(100, Math.floor((voiceMinutes / next.requiredVoiceMinutes) * 100)) || 0;
    const totalPercent = Math.floor((xpPercent + msgPercent + voicePercent) / 3);

    return {
      currentRank: current,
      nextRank: next,
      isMax: false,
      progressPercent: totalPercent,
      xpPercent,
      msgPercent,
      voicePercent,
      neededXp: Math.max(0, next.requiredWeeklyXp - xp),
      neededMessages: Math.max(0, next.requiredMessages - messages),
      neededVoiceMinutes: Math.max(0, next.requiredVoiceMinutes - voiceMinutes)
    };
  }

  /**
   * Generates a clean text progress bar [████░░░░░░] 40%
   */
  static createProgressBar(percent, length = 10) {
    const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * length);
    const empty = length - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`;
  }
}

module.exports = {
  ASGARD_RANKS,
  RankManager
};
