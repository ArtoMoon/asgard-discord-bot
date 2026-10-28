const fs = require('fs');
const path = require('path');
const config = require('../src/config');

async function updateBotProfile(imagePath, newUsername = 'Asgard Muhafızı') {
  if (!config.token) {
    console.error('❌ HATA: DISCORD_TOKEN bulunamadı!');
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`❌ HATA: Resim dosyası bulunamadı: ${imagePath}`);
    process.exit(1);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).replace('.', '').toLowerCase();
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  const base64Data = imageBuffer.toString('base64');
  const avatarDataUri = `data:${mimeType};base64,${base64Data}`;

  console.log(`[Bot Profil Güncelleme]`);
  console.log(`• Yeni İsim: ${newUsername}`);
  console.log(`• Resim Boyutu: ${(imageBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`• Discord API'ye gönderiliyor...`);

  const payload = {
    avatar: avatarDataUri
  };

  if (newUsername) {
    payload.username = newUsername;
  }

  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bot ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      // If username change is rate limited (Discord allows 2 username changes per hour)
      if (errText.includes('USERNAME_RATE_LIMIT') || res.status === 400 && errText.includes('username')) {
        console.warn('⚠️ Kullanıcı adı değiştirme saatlik sınırına takıldı, sadece avatar güncelleniyor...');
        const avatarOnlyRes = await fetch('https://discord.com/api/v10/users/@me', {
          method: 'PATCH',
          headers: {
            'Authorization': `Bot ${config.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ avatar: avatarDataUri })
        });
        if (!avatarOnlyRes.ok) {
          const err2 = await avatarOnlyRes.text();
          throw new Error(`Avatar güncellenemedi (${avatarOnlyRes.status}): ${err2}`);
        }
        const user = await avatarOnlyRes.json();
        console.log(`✅ Avatar başarıyla güncellendi!`);
        console.log(`👑 Bot: ${user.username}#${user.discriminator || '0'} (ID: ${user.id})`);
        console.log(`🖼️ Avatar URL: https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=1024`);
        return user;
      }
      throw new Error(`Discord API Hatası (${res.status}): ${errText}`);
    }

    const updatedUser = await res.json();
    console.log(`✅ Bot profil fotoğrafı ve ismi başarıyla güncellendi!`);
    console.log(`👑 Yeni İsim: ${updatedUser.username}`);
    console.log(`🖼️ Yeni Avatar: https://cdn.discordapp.com/avatars/${updatedUser.id}/${updatedUser.avatar}.png?size=1024`);
    return updatedUser;
  } catch (err) {
    console.error('❌ Profil güncellenirken hata oluştu:', err.message);
    process.exit(1);
  }
}

// CLI usage: node update-bot-profile.js <imagePath> [username]
const args = process.argv.slice(2);
if (args[0]) {
  updateBotProfile(args[0], args[1] || 'Asgard Muhafızı');
}

module.exports = updateBotProfile;

