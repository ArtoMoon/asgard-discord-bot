const GuildSettings = require('../../models/GuildSettings');
const UserProfile = require('../../models/UserProfile');
const Logger = require('../../utils/logger');

module.exports = {
  name: 'presenceUpdate',
  async execute(client, oldPresence, newPresence) {
    if (!newPresence || !newPresence.member || newPresence.member.user.bot) return;

    // Presence update tracking - offline yetki sıyırma kaldırıldı (kullanıcı isteği: görüşüz/görünmezlik yok, guard stabilite)
    try {
      const member = newPresence.member;
      const guild = newPresence.guild;

      let profile = await UserProfile.findOne({ guildId: guild.id, userId: member.id });
      if (!profile) {
        profile = new UserProfile({ guildId: guild.id, userId: member.id });
        await profile.save();
      }
    } catch (err) {
      Logger.error('presenceUpdate hatası:', err.message);
    }
  }
};
