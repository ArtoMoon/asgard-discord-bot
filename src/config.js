require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  guildId: process.env.GUILD_ID || '',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/asgard_bot',
  defaultPrefix: process.env.PREFIX || '!',
  developerIds: (process.env.DEVELOPER_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
  colors: {
    primary: 0x5865F2,
    success: 0x57F287,
    warning: 0xFEE75C,
    error: 0xED4245,
    gold: 0xF1C40F,
    asgard: 0x9B59B6
  }
};
