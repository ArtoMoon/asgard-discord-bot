const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const config = require('../../config');

module.exports = {
  name: 'yardim',
  aliases: ['help', 'komutlar', 'h'],
  description: 'Asgard Bot komut rehberini ve sunucu sistemlerini görüntüler.',
  data: new SlashCommandBuilder()
    .setName('yardim')
    .setDescription('Asgard Bot komut listesini ve sistem açıklamalarını görüntüler.'),

  async execute({ client, message, interaction, isSlash, guild, member, user, channel, args, reply }) {
    const settings = await GuildSettings.findOne({ guildId: guild.id });
    const prefix = settings?.prefix || config.defaultPrefix;

    const embed = new EmbedBuilder()
      .setColor(config.colors.asgard)
      .setTitle('👑 ASGARD BOT - SİSTEM VE KOMUT REHBERİ')
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setDescription(
        `Tüm komutlar hem **Slash (\`/\`)** hem de **Prefix (\`${prefix}\`)** formatında çalışmaktadır.\n` +
        `Asgard mimarisi ile donatılmış optimize ve güvenli sunucu yönetim asistanı.`
      )
      .addFields(
        {
          name: '⚔️ Rütbe ve Kullanıcı Komutları',
          value:
            `• **\`/me\`** veya **\`${prefix}me\`** [üye] → Asgard rütbenizi, haftalık mesaj/ses XP ve kazanılan ayrıcalıklarınızı gösterir.\n` +
            `• **\`/yardim\`** veya **\`${prefix}yardim\`** → Bu yardım menüsünü açar.`
        },
        {
          name: '🛡️ Kayıt ve Moderasyon Komutları',
          value:
            `• **\`/kayit\`** veya **\`${prefix}kayit\`** \`<üye> <isim> <yaş>\` → Üyeyi **\`İsim | Yaş\`** formatında kaydeder ve üye rolünü verir *(+15 Yetkili Puanı)*.\n` +
            `• **\`/jail\`** veya **\`${prefix}jail\`** \`<üye> [sebep]\` → Kullanıcının tüm rollerini alıp cezalıya atar *(+20 Yetkili Puanı)*.\n` +
            `• **\`/unjail\`** veya **\`${prefix}unjail\`** \`<üye>\` → Kullanıcının cezasını kaldırıp eski rollerini iade eder.\n` +
            `• **\`/timeout\`** veya **\`${prefix}timeout\`** \`<üye> <süre> [sebep]\` → Kullanıcıya zamanaşımı (susturma) uygular *(+20 Yetkili Puanı)*.\n`
        },
        {
          name: '👑 Yönetici & Yetkili Kariyer Komutları',
          value:
            `• **\`/yetkili-puan baslat\`** veya **\`${prefix}ypuan baslat <üye>\`** → Üyeyi 1. Kademe Stajyer Yetkili (Thrall) olarak kadroya başlatır.\n` +
            `• **\`/yetkili-puan ekle/cikar\`** veya **\`${prefix}ypuan ekle <yetkili> <puan>\`** → Yetkiliye ödül/ceza puanı verir.\n` +
            `• **\`/yetkili-puan terfi\`** veya **\`${prefix}ypuan terfi <yetkili>\`** → Yetkiliyi doğrudan 1 üst Asgard Kademesine terfi ettirir.\n` +
            `• **\`/kurulum\`** veya **\`${prefix}kurulum\`** → 10 Asgard rütbesini, odaları ve kayıt rollerini otomatik açar.\n` +
            `• **\`/yetki-ver\`** veya **\`${prefix}yetki-ver\`** \`<üye> <rol>\` → Developer onaylı rol verme talebi açar.`
        },
        {
          name: '💎 Özel Sunucu Sistemleri (Level vs Yetkili Terfi)',
          value:
            `• **🛡️ Yetkili İcraat & Terfi Sistemi (10 Asgard Kademesi):** Levelden tamamen bağımsızdır! Yetkililer kayıt yaptıkça (**+15p**), ceza işlemi uyguladıkça (**+20p**) ve ses mesaisi yaptıkça (**+10p**) otomatik kademe atlar.\n` +
            `• **⭐ 1-50 Üye Seviye Sistemi:** Normal üyeler XP kazanarak Seviye 10 (GIF), 20 (Görsel), 30 (Link), 40 (Yayın), 50 (VIP) izinlerini açar.\n` +
            `• **👻 Görünmezlik Koruması:** Yetkililer 'Görünmez / Çevrimdışı' moda geçerse yetki rolleri güvenlik gereği askıya alınır, çevrimiçi olunca geri verilir!\n` +
            `• **🔒 Rol Guard:** Güvenli liste dışındaki kimse Discord'dan el ile rol veremez; bot anında geri alır.`
        }
      )
      .setFooter({ text: 'Asgard Krallığı Güç & Düzen Sistemi', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    await reply({ embeds: [embed] });
  }
};
