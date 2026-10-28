const http = require('http');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const config = require('./src/config');
const GuildSettings = require('./src/models/GuildSettings');
const UserProfile = require('./src/models/UserProfile');
const { ASGARD_RANKS, LEVEL_MILESTONES } = require('./src/utils/rankManager');

const PORT = process.env.DASHBOARD_PORT || 3000;
let isMongoConnected = false;
let lastMongoError = null;

// Connect to MongoDB with friendly diagnostics
async function connectDB() {
  try {
    if (mongoose.connection.readyState === 1) {
      isMongoConnected = true;
      lastMongoError = null;
      return;
    }
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 6000
    });
    isMongoConnected = true;
    lastMongoError = null;
    console.log('[Dashboard] MongoDB bağlantısı başarıyla kuruldu!');
  } catch (err) {
    isMongoConnected = false;
    lastMongoError = err.message;
    console.error('[Dashboard] MongoDB bağlantı hatası:', err.message);
  }
}

connectDB();

// Helper: Parse JSON body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Helper: Send JSON response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// Helper: Call Discord API
async function discordApiFetch(endpoint, method = 'GET', body = null) {
  if (!config.token) {
    throw new Error('DISCORD_TOKEN tanımlanmamış!');
  }
  const headers = {
    'Authorization': `Bot ${config.token}`,
    'Content-Type': 'application/json'
  };
  const options = {
    method,
    headers,
    signal: AbortSignal.timeout(6000)
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`https://discord.com/api/v10${endpoint}`, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord API Hatası (${response.status}): ${errorText}`);
  }
  return await response.json();
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    // 1. API: STATUS
    if (pathname === '/api/status' && req.method === 'GET') {
      if (mongoose.connection.readyState !== 1) {
        // Retry connection in background if currently disconnected
        connectDB().catch(() => null);
      }

      let tip = '';
      if (lastMongoError) {
        const errLower = lastMongoError.toLowerCase();
        if (errLower.includes('whitelist') || errLower.includes('serverselection') || errLower.includes('timeout')) {
          tip = 'MongoDB Atlas IP Whitelist engeli olabilir! Atlas panelinde Network Access > Add IP > 0.0.0.0/0 ekleyin.';
        } else if (errLower.includes('auth') || errLower.includes('bad auth')) {
          tip = 'MongoDB kullanıcı adı veya şifresi hatalı! .env dosyasındaki MONGODB_URI adresini kontrol edin.';
        } else if (errLower.includes('querytxt') || errLower.includes('enotfound')) {
          tip = 'DNS / İnternet sağlayıcı engeli (SRV). DNS adresinizi 8.8.8.8 veya 1.1.1.1 yapmayı deneyin.';
        } else {
          tip = 'Lütfen Atlas panelinde kümenizin (Cluster) aktif/çalışır durumda olduğunu kontrol edin.';
        }
      }

      return sendJson(res, 200, {
        success: true,
        mongoConnected: mongoose.connection.readyState === 1,
        mongoError: lastMongoError,
        mongoTip: tip,
        defaultGuildId: config.guildId || '',
        hasToken: !!config.token,
        prefix: config.defaultPrefix || '!'
      });
    }

    // 2. API: GUILDS (Fetch all guilds bot is in + MongoDB guilds)
    if (pathname === '/api/guilds' && req.method === 'GET') {
      const guildMap = new Map();

      // 1. Fetch from Discord API
      if (config.token) {
        try {
          const discordGuilds = await discordApiFetch('/users/@me/guilds');
          if (Array.isArray(discordGuilds)) {
            discordGuilds.forEach(g => {
              guildMap.set(g.id, {
                id: g.id,
                name: g.name,
                icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : null,
                isBotInGuild: true
              });
            });
          }
        } catch (err) {
          console.warn('[Dashboard] /users/@me/guilds çekilemedi:', err.message);
        }
      }

      // 2. Fetch from MongoDB GuildSettings
      if (mongoose.connection.readyState === 1) {
        try {
          const settingsList = await GuildSettings.find({}, 'guildId').lean();
          settingsList.forEach(s => {
            if (!guildMap.has(s.guildId)) {
              guildMap.set(s.guildId, {
                id: s.guildId,
                name: `Sunucu (${s.guildId.slice(0, 6)}...)`,
                icon: null,
                isBotInGuild: false
              });
            }
          });
        } catch (err) {
          console.warn('[Dashboard] MongoDB guildId listesi alınamadı:', err.message);
        }
      }

      // 3. Ensure default config.guildId is included
      if (config.guildId && !guildMap.has(config.guildId)) {
        guildMap.set(config.guildId, {
          id: config.guildId,
          name: `Varsayılan Sunucu (${config.guildId.slice(0, 6)}...)`,
          icon: null,
          isBotInGuild: false
        });
      }

      const guilds = Array.from(guildMap.values());
      const inviteUrl = config.clientId ? `https://discord.com/oauth2/authorize?client_id=${config.clientId}&permissions=8&scope=bot%20applications.commands` : null;

      return sendJson(res, 200, {
        success: true,
        guilds,
        defaultGuildId: config.guildId || (guilds[0] ? guilds[0].id : ''),
        inviteUrl
      });
    }

    // 3. API: GUILD DATA (Live Channels & Roles from Discord API)
    if (pathname === '/api/guild-data' && req.method === 'GET') {
      const guildId = parsedUrl.searchParams.get('guildId') || config.guildId;
      if (!guildId) {
        return sendJson(res, 400, { error: 'Guild ID belirtilmedi.' });
      }

      let guildInfo = { id: guildId, name: 'Asgard Sunucusu' };
      let channels = [];
      let roles = [];
      let discordApiAvailable = false;

      if (config.token) {
        try {
          const [guildRes, channelsRes, rolesRes] = await Promise.all([
            discordApiFetch(`/guilds/${guildId}`).catch(() => null),
            discordApiFetch(`/guilds/${guildId}/channels`).catch(() => []),
            discordApiFetch(`/guilds/${guildId}/roles`).catch(() => [])
          ]);

          if (guildRes) {
            guildInfo = {
              id: guildRes.id,
              name: guildRes.name,
              icon: guildRes.icon ? `https://cdn.discordapp.com/icons/${guildRes.id}/${guildRes.icon}.png` : null
            };
          }

          if (Array.isArray(channelsRes)) {
            channels = channelsRes
              .filter(c => [0, 2, 4, 5].includes(c.type)) // 0: Text, 2: Voice, 4: Category, 5: Announcement
              .map(c => ({
                id: c.id,
                name: c.name,
                type: c.type, // 0: text, 2: voice, 4: category
                parent_id: c.parent_id
              }));
          }

          if (Array.isArray(rolesRes)) {
            roles = rolesRes
              .filter(r => r.name !== '@everyone')
              .map(r => ({
                id: r.id,
                name: r.name,
                color: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : '#99aab5',
                position: r.position
              }))
              .sort((a, b) => b.position - a.position);
          }

          discordApiAvailable = true;
        } catch (err) {
          console.warn('[Dashboard] Discord API verisi çekilemedi (elle ID girilebilir):', err.message);
        }
      }

      return sendJson(res, 200, {
        success: true,
        discordApiAvailable,
        guild: guildInfo,
        channels,
        roles
      });
    }

    // 4. API: GET SETTINGS
    if (pathname === '/api/settings' && req.method === 'GET') {
      const guildId = parsedUrl.searchParams.get('guildId') || config.guildId;
      if (!guildId) {
        return sendJson(res, 400, { error: 'Guild ID belirtilmedi.' });
      }

      let settings = null;
      if (mongoose.connection.readyState === 1) {
        settings = await GuildSettings.findOne({ guildId }).lean();
      }

      if (!settings) {
        settings = {
          guildId,
          prefix: config.defaultPrefix || '!',
          autoRoleId: null,
          unverifiedRoleId: null,
          registeredRoleId: null,
          jailRoleId: null,
          staffRoleIds: [],
          safeUserIds: [],
          welcomeChannelId: null,
          modLogChannelId: null,
          approvalChannelId: null,
          rankLogChannelId: null,
          levelLogChannelId: null,
          joinToCreateChannelId: null,
          tempVoiceCategoryId: null,
          developerUserIds: config.developerIds || [],
          levelRoles: [],
          ranks: []
        };
      }

      // Merge Level Milestones (10, 20, 30, 40, 50)
      const mergedLevelRoles = LEVEL_MILESTONES.map(m => {
        const existing = (settings.levelRoles || []).find(lr => lr.level === m.level)
          || (settings.ranks || []).find(r => r.rank === m.level / 5 || r.rank === m.level);
        return {
          level: m.level,
          name: m.name,
          roleName: m.roleName,
          color: m.color,
          perk: m.perk,
          roleId: existing ? existing.roleId : null
        };
      });

      // Merge 10 Asgard Ranks definitions with existing mappings
      const mergedRanks = ASGARD_RANKS.map(r => {
        const existing = (settings.ranks || []).find(sr => sr.rank === r.rank);
        return {
          rank: r.rank,
          name: r.name,
          roleName: r.roleName,
          color: r.color,
          requiredWeeklyXp: r.requiredWeeklyXp,
          requiredMessages: r.requiredMessages,
          requiredVoiceMinutes: r.requiredVoiceMinutes,
          perks: r.perks,
          roleId: existing ? existing.roleId : null
        };
      });

      settings.levelRoles = mergedLevelRoles;
      settings.ranks = mergedRanks;
      return sendJson(res, 200, { success: true, settings });
    }

    // 5. API: POST SETTINGS (SAVE)
    if (pathname === '/api/settings' && req.method === 'POST') {
      if (mongoose.connection.readyState !== 1) {
        await connectDB();
        if (mongoose.connection.readyState !== 1) {
          return sendJson(res, 500, { error: 'MongoDB veri tabanına bağlanılamadı. Lütfen .env dosyasındaki MONGODB_URI adresini kontrol edin.' });
        }
      }

      const body = await parseJsonBody(req);
      const guildId = body.guildId || config.guildId;
      if (!guildId) {
        return sendJson(res, 400, { error: 'Guild ID eksik.' });
      }

      let settings = await GuildSettings.findOne({ guildId });
      if (!settings) {
        settings = new GuildSettings({ guildId });
      }

      // Update fields
      if (body.prefix !== undefined) settings.prefix = body.prefix || '!';
      if (body.welcomeChannelId !== undefined) settings.welcomeChannelId = body.welcomeChannelId || null;
      if (body.autoRoleId !== undefined) {
        settings.autoRoleId = body.autoRoleId || null;
        settings.unverifiedRoleId = body.autoRoleId || null;
      }
      if (body.registeredRoleId !== undefined) settings.registeredRoleId = body.registeredRoleId || null;
      if (body.jailRoleId !== undefined) settings.jailRoleId = body.jailRoleId || null;
      if (body.modLogChannelId !== undefined) settings.modLogChannelId = body.modLogChannelId || null;
      if (body.approvalChannelId !== undefined) settings.approvalChannelId = body.approvalChannelId || null;
      if (body.rankLogChannelId !== undefined) settings.rankLogChannelId = body.rankLogChannelId || null;
      if (body.levelLogChannelId !== undefined) settings.levelLogChannelId = body.levelLogChannelId || null;
      if (body.joinToCreateChannelId !== undefined) settings.joinToCreateChannelId = body.joinToCreateChannelId || null;
      if (body.tempVoiceCategoryId !== undefined) settings.tempVoiceCategoryId = body.tempVoiceCategoryId || null;
      if (Array.isArray(body.developerUserIds)) settings.developerUserIds = body.developerUserIds;
      if (Array.isArray(body.safeUserIds)) settings.safeUserIds = body.safeUserIds;
      if (Array.isArray(body.staffRoleIds)) settings.staffRoleIds = body.staffRoleIds;
      if (Array.isArray(body.levelRoles)) {
        settings.levelRoles = body.levelRoles.map(lr => ({
          level: Number(lr.level),
          roleId: lr.roleId || null,
          name: lr.name || `Seviye ${lr.level}`,
          perk: lr.perk || '',
          color: lr.color || '#9b59b6'
        }));
      }
      if (Array.isArray(body.ranks)) {
        settings.ranks = body.ranks.map(r => ({
          rank: Number(r.rank),
          roleId: r.roleId || null,
          name: r.name || `Rütbe ${r.rank}`
        }));
      }

      await settings.save();
      return sendJson(res, 200, { success: true, message: 'Ayarlar başarıyla kaydedildi!', settings });
    }

    // 6. API: TEST WELCOME MESSAGE
    if (pathname === '/api/test-welcome' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const channelId = body.channelId;

      if (!channelId) {
        return sendJson(res, 400, { error: 'Lütfen önce bir hoş geldin kanalı seçin veya kaydedin.' });
      }
      if (!config.token) {
        return sendJson(res, 400, { error: 'DISCORD_TOKEN tanımlı olmadığı için Discord API çağrısı yapılamadı.' });
      }

      const prefix = body.prefix || config.defaultPrefix || '!';
      const welcomePayload = {
        content: '👋 **[TEST MESAJI]** Hoş geldin misafir! Aramıza katıldığın için mutluyuz.',
        embeds: [{
          color: 0x9B59B6,
          title: '⚔️ ASGARD KAPILARINA HOŞ GELDİN! (TEST ÖNİZLEME)',
          description: `Selamlar **Test Kullanıcısı**, **Asgard Diyarı**'na hoş geldin!\n\n` +
            `📜 **Kayıt ve Giriş Rehberi:**\n` +
            `• Sunucumuzdaki metin ve ses kanallarına erişebilmek için kayıt olmalısın.\n` +
            `• Kayıt işlemi için **\`${prefix}kayit [İsim]\`** veya **\`/kayit [isim]\`** komutunu kullanabilirsin.\n` +
            `• Yetkililerimiz müsait olduğunda kaydını onaylayacaktır.\n\n` +
            `🛡️ **Asgard Rütbe Sistemi:**\n` +
            `• Ses kanallarında vakit geçirerek ve sohbette aktif olarak **10 Asgard Rütbesi**'nde yükselebilirsin!\n\n` +
            `👤 **Hesap Kurulum Tarihi:** <t:${Math.floor(Date.now() / 1000)}:R>\n` +
            `👥 **Toplam Üye Sayımız:** **1**`,
          footer: { text: 'Asgard Krallığı Güvenlik & Kayıt Sistemi (Dashboard Test)' },
          timestamp: new Date().toISOString()
        }]
      };

      try {
        await discordApiFetch(`/channels/${channelId}/messages`, 'POST', welcomePayload);
        return sendJson(res, 200, { success: true, message: '✅ Test hoş geldin mesajı başarıyla Discord kanalına gönderildi!' });
      } catch (err) {
        return sendJson(res, 500, { error: `Discord'a mesaj atılamadı: ${err.message}` });
      }
    }

    // API: SEND CUSTOM EMBED (BETA)
    if (pathname === '/api/send-embed' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const channelId = body.channelId;
      const content = body.content || '';
      const embed = body.embed;

      if (!channelId) {
        return sendJson(res, 400, { error: 'Lütfen mesajın gönderileceği bir kanal seçin.' });
      }
      if (!embed || (!embed.title && !embed.description && (!embed.fields || embed.fields.length === 0) && !embed.image?.url)) {
        return sendJson(res, 400, { error: 'Embed için en az bir başlık, açıklama veya resim girilmelidir.' });
      }
      if (!config.token) {
        return sendJson(res, 400, { error: 'DISCORD_TOKEN tanımlanmadığı için Discord API çağrısı yapılamadı.' });
      }

      // Convert hex color string to integer if needed
      if (embed.color && typeof embed.color === 'string') {
        embed.color = parseInt(embed.color.replace('#', ''), 16) || 0x5865F2;
      }

      // Clean empty fields and objects
      if (embed.author && !embed.author.name) delete embed.author;
      if (embed.footer && !embed.footer.text) delete embed.footer;
      if (embed.image && !embed.image.url) delete embed.image;
      if (embed.thumbnail && !embed.thumbnail.url) delete embed.thumbnail;
      if (embed.fields && Array.isArray(embed.fields)) {
        embed.fields = embed.fields.filter(f => f.name && f.value);
        if (embed.fields.length === 0) delete embed.fields;
      }

      try {
        await discordApiFetch(`/channels/${channelId}/messages`, 'POST', {
          content: content.trim() || undefined,
          embeds: [embed]
        });
        return sendJson(res, 200, { success: true, message: '🎉 Embed mesajı başarıyla kanala gönderildi!' });
      } catch (err) {
        return sendJson(res, 500, { error: `Discord'a embed gönderilemedi: ${err.message}` });
      }
    }

    // 7. API: AUTO SETUP 10 RANKS (Create / link on Discord and MongoDB)
    if (pathname === '/api/auto-setup-ranks' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const guildId = body.guildId || config.guildId;

      if (!guildId) return sendJson(res, 400, { error: 'Guild ID eksik.' });
      if (!config.token) return sendJson(res, 400, { error: 'DISCORD_TOKEN tanımlanmamış!' });

      try {
        // Fetch current roles in Discord guild
        const existingRoles = await discordApiFetch(`/guilds/${guildId}/roles`);
        const createdOrLinkedRanks = [];

        let settings = await GuildSettings.findOne({ guildId });
        if (!settings) settings = new GuildSettings({ guildId });

        // 1. Level Milestones (10, 20, 30, 40, 50)
        const createdOrLinkedLevelRoles = [];
        for (const m of LEVEL_MILESTONES) {
          let role = existingRoles.find(r =>
            r.name.toLowerCase() === m.roleName.toLowerCase() ||
            r.name.toLowerCase() === m.name.toLowerCase()
          );

          if (!role) {
            const hexColor = parseInt(m.color.replace('#', ''), 16);
            role = await discordApiFetch(`/guilds/${guildId}/roles`, 'POST', {
              name: m.roleName,
              color: hexColor,
              hoist: true,
              mentionable: false
            });
            console.log(`[Dashboard Kurulum] Seviye rolü oluşturuldu: ${role.name}`);
          }

          createdOrLinkedLevelRoles.push({
            level: m.level,
            roleId: role.id,
            name: m.name,
            perk: m.perk,
            color: m.color
          });
        }
        settings.levelRoles = createdOrLinkedLevelRoles;

        for (const rankDef of ASGARD_RANKS) {
          let role = existingRoles.find(r =>
            r.name.toLowerCase() === rankDef.roleName.toLowerCase() ||
            r.name.toLowerCase() === rankDef.name.toLowerCase()
          );

          if (!role) {
            // Create role via Discord REST API
            const hexColor = parseInt(rankDef.color.replace('#', ''), 16);
            role = await discordApiFetch(`/guilds/${guildId}/roles`, 'POST', {
              name: rankDef.roleName,
              color: hexColor,
              hoist: true,
              mentionable: false
            });
            console.log(`[Dashboard Kurulum] Discord'da rol oluşturuldu: ${role.name}`);
          }

          createdOrLinkedRanks.push({
            rank: rankDef.rank,
            roleId: role.id,
            name: rankDef.name
          });
        }

        settings.ranks = createdOrLinkedRanks;
        await settings.save();

        return sendJson(res, 200, {
          success: true,
          message: '10 Asgard rütbesi Discord üzerinde başarıyla oluşturuldu ve eşleştirildi!',
          ranks: settings.ranks
        });
      } catch (err) {
        return sendJson(res, 500, { error: `Rütbeler kurulurken hata: ${err.message}` });
      }
    }

    // 8. API: FULL AUTO SETUP (Ranks, System Roles & Channels)
    if (pathname === '/api/full-setup' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const guildId = body.guildId || config.guildId;

      if (!guildId) return sendJson(res, 400, { error: 'Guild ID eksik.' });
      if (!config.token) return sendJson(res, 400, { error: 'DISCORD_TOKEN tanımlanmamış!' });

      try {
        const [existingRoles, existingChannels] = await Promise.all([
          discordApiFetch(`/guilds/${guildId}/roles`),
          discordApiFetch(`/guilds/${guildId}/channels`)
        ]);

        let settings = await GuildSettings.findOne({ guildId });
        if (!settings) settings = new GuildSettings({ guildId });

        // 1. 10 Asgard Ranks
        const rankMappings = [];
        // 1. Level Milestones (10, 20, 30, 40, 50)
        const createdOrLinkedLevelRoles = [];
        for (const m of LEVEL_MILESTONES) {
          let role = existingRoles.find(r =>
            r.name.toLowerCase() === m.roleName.toLowerCase() ||
            r.name.toLowerCase() === m.name.toLowerCase()
          );

          if (!role) {
            const hexColor = parseInt(m.color.replace('#', ''), 16);
            role = await discordApiFetch(`/guilds/${guildId}/roles`, 'POST', {
              name: m.roleName,
              color: hexColor,
              hoist: true,
              mentionable: false
            });
            console.log(`[Dashboard Kurulum] Seviye rolü oluşturuldu: ${role.name}`);
          }

          createdOrLinkedLevelRoles.push({
            level: m.level,
            roleId: role.id,
            name: m.name,
            perk: m.perk,
            color: m.color
          });
        }
        settings.levelRoles = createdOrLinkedLevelRoles;

        for (const rankDef of ASGARD_RANKS) {
          let role = existingRoles.find(r =>
            r.name.toLowerCase() === rankDef.roleName.toLowerCase() ||
            r.name.toLowerCase() === rankDef.name.toLowerCase()
          );
          if (!role) {
            const hexColor = parseInt(rankDef.color.replace('#', ''), 16);
            role = await discordApiFetch(`/guilds/${guildId}/roles`, 'POST', {
              name: rankDef.roleName,
              color: hexColor,
              hoist: true
            });
          }
          rankMappings.push({ rank: rankDef.rank, roleId: role.id, name: rankDef.name });
        }
        settings.ranks = rankMappings;

        // 2. System Roles (Kayıtsız, Üye, Jail, Staff)
        let unverified = existingRoles.find(r => r.name === 'Kayıtsız');
        if (!unverified) {
          unverified = await discordApiFetch(`/guilds/${guildId}/roles`, 'POST', { name: 'Kayıtsız', color: 0x7f8c8d });
        }
        settings.unverifiedRoleId = unverified.id;
        settings.autoRoleId = unverified.id;

        let memberRole = existingRoles.find(r => r.name === 'Asgard Halkı');
        if (!memberRole) {
          memberRole = await discordApiFetch(`/guilds/${guildId}/roles`, 'POST', { name: 'Asgard Halkı', color: 0x2ecc71 });
        }
        settings.registeredRoleId = memberRole.id;

        let jailRole = existingRoles.find(r => r.name === 'Cezalı / Jail');
        if (!jailRole) {
          jailRole = await discordApiFetch(`/guilds/${guildId}/roles`, 'POST', { name: 'Cezalı / Jail', color: 0x111111 });
        }
        settings.jailRoleId = jailRole.id;

        // 3. Channels & Categories
        let adminCat = existingChannels.find(c => c.type === 4 && c.name === '📜 ASGARD YÖNETİM & KAYIT');
        if (!adminCat) {
          adminCat = await discordApiFetch(`/guilds/${guildId}/channels`, 'POST', { name: '📜 ASGARD YÖNETİM & KAYIT', type: 4 });
        }

        let welcomeCh = existingChannels.find(c => c.name === '💬・hoş-geldin');
        if (!welcomeCh) {
          welcomeCh = await discordApiFetch(`/guilds/${guildId}/channels`, 'POST', {
            name: '💬・hoş-geldin',
            type: 0,
            parent_id: adminCat.id
          });
        }
        settings.welcomeChannelId = welcomeCh.id;

        let approvalCh = existingChannels.find(c => c.name === '👑・developer-onay');
        if (!approvalCh) {
          approvalCh = await discordApiFetch(`/guilds/${guildId}/channels`, 'POST', {
            name: '👑・developer-onay',
            type: 0,
            parent_id: adminCat.id
          });
        }
        settings.approvalChannelId = approvalCh.id;

        let modLogCh = existingChannels.find(c => c.name === '🛡️・mod-log');
        if (!modLogCh) {
          modLogCh = await discordApiFetch(`/guilds/${guildId}/channels`, 'POST', {
            name: '🛡️・mod-log',
            type: 0,
            parent_id: adminCat.id
          });
        }
        settings.modLogChannelId = modLogCh.id;

        let rankLogCh = existingChannels.find(c => c.name === '⚔️・rütbe-log');
        if (!rankLogCh) {
          rankLogCh = await discordApiFetch(`/guilds/${guildId}/channels`, 'POST', {
            name: '⚔️・rütbe-log',
            type: 0,
            parent_id: adminCat.id
          });
        }
        settings.rankLogChannelId = rankLogCh.id;

        let levelLogCh = existingChannels.find(c => c.name === '📊・seviye-log');
        if (!levelLogCh) {
          levelLogCh = await discordApiFetch(`/guilds/${guildId}/channels`, 'POST', {
            name: '📊・seviye-log',
            type: 0,
            parent_id: adminCat.id
          });
        }
        settings.levelLogChannelId = levelLogCh.id;

        // Voice Category & Join-to-Create
        let voiceCat = existingChannels.find(c => c.type === 4 && c.name === '🔊 ASGARD SES ODALARI');
        if (!voiceCat) {
          voiceCat = await discordApiFetch(`/guilds/${guildId}/channels`, 'POST', { name: '🔊 ASGARD SES ODALARI', type: 4 });
        }
        settings.tempVoiceCategoryId = voiceCat.id;

        let j2cCh = existingChannels.find(c => c.type === 2 && c.name === '➕ Ses Odası Oluştur');
        if (!j2cCh) {
          j2cCh = await discordApiFetch(`/guilds/${guildId}/channels`, 'POST', {
            name: '➕ Ses Odası Oluştur',
            type: 2,
            parent_id: voiceCat.id
          });
        }
        settings.joinToCreateChannelId = j2cCh.id;

        await settings.save();

        return sendJson(res, 200, {
          success: true,
          message: 'Tüm Asgard rolleri, 10 rütbe ve kanallar başarıyla kuruldu!',
          settings
        });
      } catch (err) {
        return sendJson(res, 500, { error: `Tam kurulum sırasında hata: ${err.message}` });
      }
    }

    // 9. API: STATS
    if (pathname === '/api/stats' && req.method === 'GET') {
      const guildId = parsedUrl.searchParams.get('guildId') || config.guildId;
      let totalUsers = 0;
      let jailedUsers = 0;
      let ranksCount = {};

      if (mongoose.connection.readyState === 1 && guildId) {
        totalUsers = await UserProfile.countDocuments({ guildId });
        jailedUsers = await UserProfile.countDocuments({ guildId, isJailed: true });
        const rankAgg = await UserProfile.aggregate([
          { $match: { guildId } },
          { $group: { _id: '$currentRank', count: { $sum: 1 } } }
        ]);
        rankAgg.forEach(r => {
          ranksCount[r._id] = r.count;
        });
      }

      return sendJson(res, 200, {
        success: true,
        totalUsers,
        jailedUsers,
        ranksCount
      });
    }

    // 8. SERVE STATIC HTML
    if (pathname === '/' || pathname === '/index.html') {
      const htmlPath = path.join(__dirname, 'public', 'index.html');
      if (fs.existsSync(htmlPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(htmlPath).pipe(res);
        return;
      }
    }

    // Fallback 404
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  } catch (err) {
    console.error('[Dashboard Error]:', err);
    sendJson(res, 500, { error: err.message || 'Sunucu hatası' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`⚡ [ASGARD BOT DASHBOARD] Aktif Edildi!`);
  console.log(`🌐 Local Web Arayüzü: http://localhost:${PORT}`);
  console.log(`🛠️ Bottan bağımsız çalışır, MongoDB ayarlarını anında günceller.`);
  console.log(`====================================================`);
});

