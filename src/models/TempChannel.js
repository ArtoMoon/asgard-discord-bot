const mongoose = require('mongoose');

const TempChannelSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true, unique: true },
  ownerId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TempChannel', TempChannelSchema);
