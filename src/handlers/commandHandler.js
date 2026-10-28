const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const Logger = require('../utils/logger');
const config = require('../config');

module.exports = async function loadCommands(client) {
  client.commands = new Map();
  client.aliases = new Map();
  client.slashCommands = [];

  const commandsPath = path.join(__dirname, '../commands');
  if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath, { recursive: true });
  }

  const commandFolders = fs.readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      try {
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);

        if (!command.name || !command.execute) {
          Logger.warn(`[Komut Atlandı] ${file} geçerli bir komut nesnesi (name & execute) içermiyor.`);
          continue;
        }

        command.category = folder;
        client.commands.set(command.name.toLowerCase(), command);

        if (command.aliases && Array.isArray(command.aliases)) {
          command.aliases.forEach(alias => client.aliases.set(alias.toLowerCase(), command.name.toLowerCase()));
        }

        if (command.data) {
          client.slashCommands.push(typeof command.data.toJSON === 'function' ? command.data.toJSON() : command.data);
        }

        Logger.info(`Komut yüklendi: ${command.name} (${folder})`);
      } catch (err) {
        Logger.error(`Komut yüklenirken hata (${file}):`, err);
      }
    }
  }

  Logger.success(`Toplam ${client.commands.size} komut hafızaya alındı.`);
};

module.exports.registerSlashCommands = async function registerSlashCommands(client) {
  if (!client.slashCommands || client.slashCommands.length === 0) return;

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    Logger.info(`Slash (/) komutları Discord API'ye kaydediliyor... (${client.slashCommands.length} komut)`);

    if (config.guildId) {
      // Faster sync for specified server
      await rest.put(
        Routes.applicationGuildCommands(config.clientId || client.user.id, config.guildId),
        { body: client.slashCommands }
      );
      Logger.success(`Slash komutları başarıyla sunucuya (${config.guildId}) kaydedildi!`);
    } else {
      // Global registration
      await rest.put(
        Routes.applicationCommands(config.clientId || client.user.id),
        { body: client.slashCommands }
      );
      Logger.success('Slash komutları başarıyla genel (global) olarak kaydedildi!');
    }
  } catch (err) {
    Logger.error('Slash komutları kaydedilirken hata oluştu:', err);
  }
};
