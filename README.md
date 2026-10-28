# 👑 ASGARD - Modern Discord Public & Rütbe Botu

Asgard temalı, yüksek bellek optimizasyonuna sahip, **MongoDB** tabanlı ve hem **Slash (`/`)** hem de **Prefix (`!`)** komutlarını destekleyen hibrit mimarili Discord botu.

---

## ⚡ Temel Özellikler

1. **Modern Event & Command Handler:**
   - Komutlar `src/commands` altındaki kategorilerde modüler olarak tutulur.
   - Her komut hem Slash (`/komut`) hem Prefix (`!komut`) olarak eşzamanlı çalışır.
   - Eventler `src/events` klasöründen dinamik olarak yüklenir.

2. **Gelişmiş Bellek & Performans Optimizasyonu:**
   - Discord.js cache sweepers entegrasyonu (Mesajlar, kullanıcılar ve thread'ler otomatik temizlenir).
   - Bellek sızıntılarını önleyen TTL destekli `MemoryRateLimiter`.
   - Düşük RAM kullanımı (100MB altı RSS).

3. **10 Aşamalı Asgard Rütbe & Görev Sistemi:**
   - Public sunucular için özel tasarlanmış 10 seviyeli hiyerarşi:
     1. `Thrall (Yeni Savaşçı)`
     2. `Karl (Özgür Üye)` - Görsel/Resim gönderme izni
     3. `Berserker (Yırtıcı)` - Harici emoji & sticker & GIF kullanabilme
     4. `Hersir (Akıncı)` - Bağlantı (Link) paylaşabilme
     5. `Thegn (Muhafız)` - 1080p/60fps yayın açabilme
     6. `Jarl (Soylu Savaşçı)` - Çekilişlerde 2x şans & sesli oda ayrıcalıkları
     7. `Einherjar (Valhalla Seçilmişi)` - Öncelikli konuşmacı
     8. `Valkyrie (Kader Rehberi)` - Çekilişlerde 3x şans & oda kontrolü
     9. `Aesir (Tanrılar Meclisi)` - Özel VIP oda açabilme
     10. `Odin's Champion (Asgard Şampiyonu)` - Efsanevi taç ve tüm ayrıcalıklar
   - Haftalık görevler: Belirlenen mesaj adedi, ses aktiflik süresi ve XP kotasını dolduranlar otomatik olarak bir üst rütbeye terfi eder.

4. **Sohbet & Ses XP Motoru (Rate-Limit Korumalı):**
   - Sohbet mesajları 60 saniyelik anti-spam filtresiyle 15-25 XP kazandırır.
   - Ses kanallarında aktif olunan her 5 dakikada 25 Ses XP kazanılır (Kulaklık kapalı/sağır veya tek başına AFK kalma durumları filtrelenir).

5. **Görünmezlik / Çevrimdışı Yetki Koruması:**
   - Yetkililer Discord durumlarını **Görünmez / Çevrimdışı (Invisible / Offline)** moduna alırlarsa, bot güvenlik gereği yetki rollerini otomatik olarak askıya alır ve log kanalına bildirir.
   - Yetkili tekrar **Çevrimiçi (Online / DND / Idle)** olduğunda askıdaki rolleri otomatik iade edilir.

6. **Developer Onaylı Üst Yetki Sistemi:**
   - Yetkililer sunucuda bir üyeye rol vermek istediklerinde `/yetki-ver` komutunu kullanır.
   - Bot, rolü hemen vermek yerine **Developer Onay Kanalı**na interaktif butonlu (`[✅ Onayla]`, `[❌ Reddet]`) bir talep gönderir.
   - Rol **yalnızca Developer onay verirse** üyeye tanımlanır!
   - Bir yetkili Discord'dan el ile rol vermeye kalkışırsa bot işlemi iptal eder, rolü geri alır ve güvenlik uyarısı gönderir.

7. **Özel Ses Odası Oluşturucu (Join to Create):**
   - Belirlenen master ses kanalına (`➕ Ses Odası Oluştur`) giren kullanıcıya özel dinamik ses kanalı açılır (`🔊・[Kullanıcı]'in Odası`) ve kullanıcı oraya taşınır.
   - Kullanıcı odanın yöneticisi olur (isim değiştirme, üye atma, kilit yetkisi).
   - Odadaki tüm üyeler çıkıp **üye sayısı 0 olduğunda** oda otomatik olarak silinir.

8. **Otomatik Tek Tuş Kurulum (`/kurulum`):**
   - Tek bir komutla 10 Asgard rütbe rolü, kayıtsız/üye/jail rolleri, ses kategorisi, join-to-create odası ve log kanalları saniyeler içinde açılır ve MongoDB'ye kaydedilir.

9. **Kayıt ve Moderasyon:**
   - `/kayit <üye> <isim>`: Üyeyi kaydeder, ismini düzenler (`[İsim] | Asgard`), kayıtsız rolünü alıp üye ve 1. rütbe rolünü verir.
   - `/jail <üye> [sebep]` & `/unjail <üye>`: Üyenin tüm rollerini yedekler, sadece cezalı rolü bırakır; unjail yapıldığında rolleri eksiksiz iade eder.
   - `/timeout <üye> <süre> [sebep]`: Discord native süreli susturma (Örn: `10m`, `1h`, `1d`).

---

## 🚀 Başlangıç & Kurulum

### 1. Gereksinimler
- [Node.js](https://nodejs.org/) v18+ (v20+ tavsiye edilir)
- [MongoDB](https://www.mongodb.com/) (Yerel veya MongoDB Atlas)

### 2. Kurulum Adımları
```bash
# Proje dizinine gidin
cd e:/discordbot

# Paketleri yükleyin (zaten yüklendi)
npm install

# .env dosyasını yapılandırın
```

### 3. Ortam Değişkenleri (`.env`)
```env
DISCORD_TOKEN=bot_tokeniniz
CLIENT_ID=bot_uygulama_id
GUILD_ID=sunucu_id
MONGODB_URI=mongodb://127.0.0.1:27017/asgard_bot
PREFIX=!
DEVELOPER_IDS=kendi_discord_id_niz
```

### 4. Botu Başlatma
```bash
npm start
```

---

## 🌐 bot-hosting.net (Pterodactyl Panel) Kurulum Rehberi

Botunuz **[bot-hosting.net](https://bot-hosting.net)** ile tam uyumlu hale getirilmiştir. Pterodactyl panelinde 7/24 kesintisiz çalıştırmak için şu adımları izleyin:

1. **GitHub ile Bağlama veya Dosyaları Yükleme:**
   - Panelde yeni bir Node.js sunucusu oluşturun.
   - GitHub deponuzu (`https://github.com/ArtoMoon/asgard-discord-bot`) doğrudan bağlayabilir veya dosyaları zip olarak File Manager'a yükleyebilirsiniz.

2. **Giriş Dosyası (Startup / Main File):**
   - Startup ayarlarında **Main File** veya **Entry Point**: `index.js` olarak belirlenmiştir.

3. **Veri Tabanı (ÖNEMLİ):**
   - `bot-hosting.net` üzerinde yerel `127.0.0.1` MongoDB bulunmaz.
   - [MongoDB Atlas](https://www.mongodb.com/atlas) üzerinden ücretsiz bir küme (Cluster) açıp bağlantı adresinizi (`mongodb+srv://...`) alın.

4. **Çevre Değişkenleri (Startup / Variables):**
   Paneldeki **"Startup"** sekmesinden veya **File Manager**'da oluşturacağınız `.env` dosyasında şu değişkenleri tanımlayın:
   - `DISCORD_TOKEN`: Bot tokenınız
   - `CLIENT_ID`: Bot uygulama ID'niz
   - `GUILD_ID`: Sunucu ID'niz
   - `MONGODB_URI`: MongoDB Atlas bağlantı linkiniz (`mongodb+srv://...`)
   - `DEVELOPER_IDS`: Kendi Discord kullanıcı ID'niz
   - `PORT`: `8080` (veya panelin atadığı port)

5. **7/24 Uptime (Keep-Alive):**
   - Bot, `8080` portunda yerleşik bir HTTP Web Sunucusu çalıştırır.
   - Panelde verilen portu ve IP adresini [UptimeRobot](https://uptimerobot.com) gibi bir servise HTTP monitörü olarak ekleyerek botunuzun uyumasını önleyebilir, 7/24 aktif kalmasını sağlayabilirsiniz.


---

## 📜 Komut Listesi

| Komut | Alternatif Prefix | Açıklama |
| :--- | :--- | :--- |
| `/kurulum` | `!kurulum` | 10 Asgard rütbesini, rolleri ve kanalları otomatik kurar ve DB'ye bağlar. |
| `/me [üye]` | `!me` / `!profil` | Asgard rütbenizi, haftalık mesaj/ses XP'nizi ve ayrıcalıklarınızı gösterir. |
| `/yardim` | `!yardim` | Tüm sistemlerin ve komutların rehberini açar. |
| `/kayit <üye> <isim>` | `!kayit <üye> <isim>` | Yeni üyeyi kaydeder, rolünü tanımlar. |
| `/yetki-ver <üye> <rol>` | `!yetki-ver <üye> <rol>` | Developer onayına sunulacak yetki talebi oluşturur. |
| `/settings` | `!settings` / `!ayar` | Oto-rol, kanallar, prefix vb. ayarları görüntüler veya düzenler. |
| `/jail at/cikar` | `!jail` / `!unjail` | Kullanıcıyı cezalıya atar veya cezasını kaldırır. |
| `/timeout <üye> <süre>` | `!timeout <üye> <süre>` | Kullanıcıya zamanaşımı (mute) uygular. |
