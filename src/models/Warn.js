const { Schema, model } = require('mongoose');
module.exports = model('Warn', new Schema({
  guildId: { type: String, index: true },
  userId: String, userTag: String, modId: String, modTag: String,
  reason: String, date: { type: Date, default: Date.now },
}));
