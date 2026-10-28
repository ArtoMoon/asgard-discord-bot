const http = require('http');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const mongoose = require('mongoose');
const config = require('./config');
const Logger = require('./utils/logger');
const { clientOptions } = require('./utils/memoryManager');
const loadCommands = require('./handlers/commandHandler');
const loadEvents = require('./handlers/eventHandler');

// 1. Initialize Discord Client with memory-optimized sweepers and necessary intents
const client = new Client({
  ...clientOptions,
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User]
});

// 2. HTTP Health-Check / Keep-Alive Server (Essential for bot-hosting.net & 24/7 Uptime)
const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    status: 'ONLINE',
    bot: client.user ? client.user.tag : 'Connecting...',
    uptime: Math.floor(process.uptime()),
    guilds: client.guilds ? client.guilds.cache.size : 0,
    ping: client.ws ? `${client.ws.ping}ms` : 'N/A',
    service: 'Asgard Discord Bot',
    hosting: 'bot-hosting.net Ready'
  }, null, 2));
});

server.listen(PORT, '0.0.0.0', () => {
  Logger.success(`[Web Server] HTTP Uptime sunucusu 0.0.0.0:${PORT} adresinde aktif edildi (bot-hosting.net uyumlu).`);
});

// 3. Global Error Handling to prevent unexpected shutdowns
process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Yakalanmamış Promise Reddi (Unhandled Rejection):', reason);
});

process.on('uncaughtException', (err, origin) => {
  Logger.error('Yakalanmamış İstisna (Uncaught Exception):', err);
});

// 4. Connect to MongoDB and Boot Bot
async function startBot() {
  try {
    Logger.system('MongoDB veri tabanına bağlanılıyor...');
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 8000
    });
    Logger.success('MongoDB bağlantısı başarıyla kuruldu!');
  } catch (err) {
    Logger.error('====================================================');
    Logger.error('❌ MONGODB BAĞLANTI HATASI!');
    Logger.error('bot-hosting.net veya harici sunucularda yerel 127.0.0.1 MongoDB bulunmaz.');
    Logger.error('Lütfen ücretsiz https://mongodb.com/atlas üzerinden bir bağlantı URI (mongodb+srv://...) alıp');
    Logger.error('bot-hosting.net Panel > "Startup" veya ".env" bölümüne MONGODB_URI olarak giriniz.');
    Logger.error(`Hata Detayı: ${err.message}`);
    Logger.error('====================================================');
  }

  // Load Handlers
  await loadCommands(client);
  loadEvents(client);

  // Validate Token before login
  if (!config.token) {
    Logger.warn('⚠️ DİKKAT: DISCORD_TOKEN tanımlanmamış!');
    Logger.warn('Lütfen bot-hosting.net Startup sekmesinden veya .env dosyasından DISCORD_TOKEN değişkenini girin.');
    return;
  }

  try {
    await client.login(config.token);
  } catch (err) {
    Logger.error('Discord botuna giriş yapılırken hata:', err.message);
  }
}

startBot();
