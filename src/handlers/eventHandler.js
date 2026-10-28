const fs = require('fs');
const path = require('path');
const Logger = require('../utils/logger');

module.exports = function loadEvents(client) {
  const eventsPath = path.join(__dirname, '../events');
  if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath, { recursive: true });
  }

  let eventCount = 0;
  const eventFolders = fs.readdirSync(eventsPath);

  for (const folder of eventFolders) {
    const folderPath = path.join(eventsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const eventFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
      const filePath = path.join(folderPath, file);
      try {
        const event = require(filePath);
        const eventName = event.name || file.split('.')[0];

        if (event.once) {
          client.once(eventName, (...args) => event.execute(client, ...args));
        } else {
          client.on(eventName, (...args) => event.execute(client, ...args));
        }

        eventCount++;
        Logger.info(`Event dinleyicisi yüklendi: ${eventName} (${folder}/${file})`);
      } catch (err) {
        Logger.error(`Event yüklenirken hata (${file}):`, err);
      }
    }
  }

  Logger.success(`Toplam ${eventCount} event başarıyla bağlandı.`);
};
