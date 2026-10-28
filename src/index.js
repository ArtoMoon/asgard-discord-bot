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

// 2. Global Error Handling to prevent unexpected shutdowns
process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Yakalanmamış Promise Reddi (Unhandled Rejection):', reason);
});

process.on('uncaughtException', (err, origin) => {
  Logger.error('Yakalanmamış İstisna (Uncaught Exception):', err);
});

// 3. Connect to MongoDB and Boot Bot
async function startBot() {
  try {
    Logger.system('MongoDB veri tabanına bağlanılıyor...');
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    Logger.success('MongoDB bağlantısı başarıyla kuruldu!');
  } catch (err) {
    Logger.error('MongoDB bağlantı hatası! Lütfen MongoDB servisinin çalıştığından ve URI adresinin doğru olduğundan emin olun.');
    Logger.error(err.message);
  }

  // Load Handlers
  await loadCommands(client);
  loadEvents(client);

  // Validate Token before login
  if (!config.token) {
    Logger.warn('⚠️ DİKKAT: .env dosyasında DISCORD_TOKEN tanımlanmamış!');
    Logger.warn('Lütfen .env dosyanızı açıp bot tokenınızı ve MongoDB adresinizi girin.');
    return;
  }

  try {
    await client.login(config.token);
  } catch (err) {
    Logger.error('Discord botuna giriş yapılırken hata:', err.message);
  }
}

startBot();
