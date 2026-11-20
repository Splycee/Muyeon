const { EmbedBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

// Categorías que se pueden activar/desactivar desde el panel
const CATS = {
  messages:  'Mensajes (editados, eliminados, purgas)',
  members:   'Miembros (entradas, salidas, roles, apodos)',
  moderation:'Moderación (bans, unbans, expulsiones, timeouts)',
  channels:  'Canales (crear, borrar, editar)',
  roles:     'Roles (crear, borrar, editar permisos)',
  voice:     'Voz (entrar, salir, mover, mute, stream)',
  server:    'Servidor (nombre, icono, ajustes)',
  invites:   'Invitaciones',
  threads:   'Hilos',
  emojis:    'Emojis y stickers',
  reactions: 'Reacciones',
  webhooks:  'Webhooks',
  commands:  'Comandos usados',
  panel:     'Acciones hechas desde el panel',
};

const cache = new Map();
async function getConfig(guildId) {
  const c = cache.get(guildId);
  if (c && Date.now() - c.t < 10000) return c.v;
  const v = await GuildConfig.findOneAndUpdate({ guildId }, { $setOnInsert: { guildId } }, { upsert: true, new: true }).lean();
  cache.set(guildId, { v, t: Date.now() });
  return v;
}
const invalidate = id => cache.delete(id);

async function log(guild, cat, { title, color = 0x7c8cff, desc, fields = [], user, thumb }) {
  try {
    const cfg = await getConfig(guild.id);
    if (!cfg.logChannelId || cfg.logCategories?.[cat] === false) return;
    const ch = guild.channels.cache.get(cfg.logChannelId);
    if (!ch) return;
    const e = new EmbedBuilder().setColor(color).setTitle(title).setTimestamp().setFooter({ text: `Registro • ${cat}` });
    if (desc) e.setDescription(String(desc).slice(0, 4000));
    const f = fields.filter(Boolean).map(x => ({ name: String(x.name).slice(0, 256), value: String(x.value || '—').slice(0, 1024), inline: !!x.inline }));
    if (f.length) e.addFields(f.slice(0, 25));
    if (user) e.setAuthor({ name: `${user.username} (${user.id})`, iconURL: user.displayAvatarURL?.() });
    if (thumb) e.setThumbnail(thumb);
    await ch.send({ embeds: [e], allowedMentions: { parse: [] } });
  } catch (err) { console.error('[log]', err.message); }
}
module.exports = { log, getConfig, invalidate, CATS };
