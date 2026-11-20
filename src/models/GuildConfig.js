const { Schema, model } = require('mongoose');
module.exports = model('GuildConfig', new Schema({
  guildId: { type: String, unique: true, index: true },
  logChannelId: { type: String, default: '' },
  logCategories: { type: Object, default: {} },
  webhookProfile: { name: { type: String, default: '' }, avatar: { type: String, default: '' } },
}, { minimize: false }));
