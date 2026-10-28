const { EmbedBuilder } = require('discord.js');
const config = require('../config');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

function formatTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

class Logger {
  static info(message, ...args) {
    console.log(`${colors.dim}[${formatTimestamp()}]${colors.reset} ${colors.cyan}[INFO]${colors.reset} ${message}`, ...args);
  }

  static success(message, ...args) {
    console.log(`${colors.dim}[${formatTimestamp()}]${colors.reset} ${colors.green}[SUCCESS]${colors.reset} ${message}`, ...args);
  }

  static warn(message, ...args) {
    console.warn(`${colors.dim}[${formatTimestamp()}]${colors.reset} ${colors.yellow}[WARN]${colors.reset} ${message}`, ...args);
  }

  static error(message, ...args) {
    console.error(`${colors.dim}[${formatTimestamp()}]${colors.reset} ${colors.red}[ERROR]${colors.reset} ${message}`, ...args);
  }

  static system(message, ...args) {
    console.log(`${colors.dim}[${formatTimestamp()}]${colors.reset} ${colors.magenta}[ASGARD]${colors.reset} ${message}`, ...args);
  }

  /**
   * Send an embed log to a guild's log channel
   */
  static async sendGuildLog(guild, channelId, embed) {
    if (!guild || !channelId) return;
    try {
      const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        await channel.send({ embeds: [embed] });
      }
    } catch (err) {
      this.error(`Log kanalına mesaj gönderilemedi (${channelId}):`, err.message);
    }
  }
}

module.exports = Logger;
