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
            `• **\`/kayit\`** veya **\`${prefix}kayit\`** \`<üye> <isim>\` → Yeni üyeyi kaydeder, ismini düzenler ve rütbe rolünü verir.\n` +
            `• **\`/jail\`** veya **\`${prefix}jail\`** \`<üye> [sebep]\` → Kullanıcının tüm rollerini alıp cezalıya atar.\n` +
            `• **\`/unjail\`** veya **\`${prefix}unjail\`** \`<üye>\` → Kullanıcının cezasını kaldırıp eski rollerini iade eder.\n` +
            `• **\`/timeout\`** veya **\`${prefix}timeout\`** \`<üye> <süre> [sebep]\` → Kullanıcıya zamanaşımı (susturma) uygular.`
        },
        {
          name: '👑 Yönetici & Kurulum Komutları',
          value:
            `• **\`/kurulum\`** veya **\`${prefix}kurulum\`** → **Otomatik Kurulum!** 10 Asgard rütbesini, odaları, cezalı ve kayıt rollerini saniyeler içinde otomatik açar ve veri tabanına kaydeder.\n` +
            `• **\`/settings\`** veya **\`${prefix}settings\`** → Bot ayarlarını (oto-rol, kanallar, developer listesi) yapılandırır veya görüntüler.\n` +
            `• **\`/yetki-ver\`** veya **\`${prefix}yetki-ver\`** \`<üye> <rol>\` → Yetkilinin birine rol vermesini sağlar; rol **sadece Developer onay verirse** teslim edilir!`
        },
        {
          name: '💎 Özel Sunucu Sistemleri',
          value:
            `• **10 Asgard Yönetim Kademesi:** Stajyer'den Baş Yöneticiye kadar sunucu moderasyon ve yönetim hiyerarşisi.\n` +
            `• **1-50 Seviye Rolleri (Her 10 Seviyede Bir):** Üyeler XP kazanarak Seviye 10 (GIF/Sticker), 20 (Görsel), 30 (Link), 40 (Yayın), 50 (VIP) izinleri kazanır.\n` +
            `• **Görünmezlik Koruması:** Yetkililer 'Görünmez / Çevrimdışı' moda geçerse yetki rolleri güvenlik gereği askıya alınır, çevrimiçi olunca geri verilir!\n` +
            `• **Ses Odası Oluşturucu:** \`➕ Ses Odası Oluştur\` kanalına girdiğiniz an size özel geçici oda açılır, herkes çıktığında oda otomatik silinir.\n` +
            `• **Rol Guard & Developer Onayı:** Güvenli liste dışındaki kimse Discord'dan el ile rol veremez; bot engeller ve log kanalına alarm düşer.`
        }
      )
      .setFooter({ text: 'Asgard Krallığı Güç & Düzen Sistemi', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    await reply({ embeds: [embed] });
  }
};
