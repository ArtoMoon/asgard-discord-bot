// Bot-Hosting.net & Pterodactyl Panel Entry Point
const { execSync } = require('child_process');

// Auto-pull latest updates from GitHub if git repository exists
try {
  console.log('[ASGARD] GitHub güncellemeleri kontrol ediliyor...');
  execSync('git pull origin main', { stdio: 'inherit', timeout: 8000 });
} catch (err) {
  // Safe fallback if git is not initialized or container lacks git
}

require('./src/index.js');
