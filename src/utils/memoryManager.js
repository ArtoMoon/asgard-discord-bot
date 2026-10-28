const { Options, Sweepers } = require('discord.js');
const Logger = require('./logger');

/**
 * Optimized cache & memory management configuration for Discord.js
 */
const clientOptions = {
  // Limiting message caches to avoid memory leaks
  makeCache: Options.cacheWithLimits({
    MessageManager: 50, // Keep only 50 messages per channel
    UserManager: 100,   // Keep only active users
    GuildMemberManager: 200,
    ThreadManager: 20,
    ReactionManager: 0,
    GuildBanManager: 0,
    StageInstanceManager: 0
  }),
  // Automatic memory sweepers running periodically
  sweepers: {
    ...Sweepers.filterByLifetime({
      messages: {
        lifetime: 1800, // Sweep messages older than 30 minutes
        sweepInterval: 300 // Run every 5 minutes
      },
      users: {
        lifetime: 3600, // Sweep users not in active cache for 1 hour
        sweepInterval: 600
      },
      threads: {
        lifetime: 3600,
        sweepInterval: 600
      }
    })
  }
};

/**
 * Rate limit tracker with self-cleaning TTL to prevent memory leaks
 */
class MemoryRateLimiter {
  constructor(defaultTtlMs = 60000) {
    this.cache = new Map();
    this.defaultTtl = defaultTtlMs;

    // Periodic sweep every 5 minutes to remove expired keys
    setInterval(() => {
      const now = Date.now();
      for (const [key, expiresAt] of this.cache.entries()) {
        if (now >= expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 5 * 60 * 1000).unref();
  }

  isRateLimited(key, ttlMs = this.defaultTtl) {
    const now = Date.now();
    const expiresAt = this.cache.get(key);
    if (expiresAt && now < expiresAt) {
      return true;
    }
    this.cache.set(key, now + ttlMs);
    return false;
  }

  getRemainingTime(key) {
    const now = Date.now();
    const expiresAt = this.cache.get(key);
    if (!expiresAt || now >= expiresAt) return 0;
    return Math.ceil((expiresAt - now) / 1000);
  }
}

function logMemoryUsage() {
  const usage = process.memoryUsage();
  const formatMb = (bytes) => (bytes / 1024 / 1024).toFixed(2);
  Logger.info(`[Bellek Durumu] RSS: ${formatMb(usage.rss)} MB | Heap: ${formatMb(usage.heapUsed)} / ${formatMb(usage.heapTotal)} MB`);
}

module.exports = {
  clientOptions,
  MemoryRateLimiter,
  logMemoryUsage
};
