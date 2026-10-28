const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const { LeaderboardManager } = require('../../utils/leaderboardManager');

module.exports = {
  name: 'siralama',
  aliases: ['top', 'tablo', 'liderlik', 'leaderboard', 'ranklist'],
  description: 'Sunucu Seviye, Ses ve Yetkili sıralama tablosunu gösterir veya 5 dakikada bir güncellenen sabit tablo kurar.',
  data: new SlashCommandBuilder()
    .setName('siralama')
    .setDescription('Asgard Seviye, Ses ve Yetkili sıralama tablosu.')
    .addSubcommand(sub =>
      sub.setName('goster')
        .setDescription('Anlık sıralama tablosunu görüntüler.')
    )
    .addSubcommand(sub =>
      sub.setName('kur')
        .setDescription('Belirtilen kanala 5 dakikada bir otomatik güncellenen canlı sıralama tablosu kurar (Yönetici).')
        .addChannelOption(opt =>
          opt.setName('kanal')
            .setDescription('Tablonun kurulacağı metin kanalı (Boş bırakılırsa bulunduğu kanala kurar)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    ),

  async execute({ client, message, interaction, isSlash, guild, member, user, channel, args, reply }) {
    let settings = await GuildSettings.findOne({ guildId: guild.id });
    if (!settings) {
      settings = new GuildSettings({ guildId: guild.id });
    }

    let sub = 'goster';
    let targetChannel = channel;

    if (isSlash) {
      sub = interaction.options.getSubcommand() || 'goster';
      targetChannel = interaction.options.getChannel('kanal') || channel;
    } else if (args[0] && ['kur', 'ayarla', 'sabitle'].includes(args[0].toLowerCase())) {
      sub = 'kur';
      if (args[1]) {
        const chId = args[1].replace(/[<#>]/g, '');
        targetChannel = guild.channels.cache.get(chId) || channel;
      }
    }

    // 1. SABİT 5 DAKİKADA BİR GÜNCELLENEN TABLO KURULUMU
    if (sub === 'kur') {
      if (!member.permissions.has(PermissionFlagsBits.ManageGuild) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
        return reply({ content: '❌ Canlı sıralama tablosu kurmak için **Yönetici** yetkisine sahip olmalısınız!', ephemeral: true });
      }

      settings.leaderboardChannelId = targetChannel.id;
      settings.leaderboardMessageId = null; // Yeni mesaj göndermesi için sıfırla
      await settings.save();

      const msg = await LeaderboardManager.updateGuildLeaderboard(guild, settings);
      if (!msg) {
        return reply({ content: '❌ Sıralama tablosu mesajı gönderilemedi! Botun kanal izinlerini kontrol edin.', ephemeral: true });
      }

      return reply({
        content: `✅ **Canlı Sıralama Tablosu** başarıyla ${targetChannel} kanalına kuruldu! Tablo **her 5 dakikada bir otomatik olarak** güncellenecektir.`,
        ephemeral: true
      });
    }

    // 2. ANLIK TABLO GÖSTERİMİ
    const payload = await LeaderboardManager.buildLeaderboardPayload(guild, 'ALL');
    return reply(payload);
  }
};
