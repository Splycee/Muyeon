const { AuditLogEvent: A } = require('discord.js');
const { log } = require('../logger');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = u => (u ? `<@${u.id}> (${u.username})` : 'Desconocido');
const trunc = (s, n = 1000) => (s ? (s.length > n ? s.slice(0, n - 1) + '…' : s) : '*(vacío)*');
const CT = { 0: 'Texto', 2: 'Voz', 4: 'Categoría', 5: 'Anuncios', 13: 'Escenario', 15: 'Foro', 16: 'Multimedia' };
const RED = 0xff6b7a, GREEN = 0x62d6a5, BLUE = 0x7c8cff, YELLOW = 0xffc857;

// Quién hizo la acción (Registro de auditoría)
async function who(guild, type, targetId) {
  try {
    await sleep(900);
    const l = await guild.fetchAuditLogs({ type, limit: 6 });
    const e = l.entries.find(x => (!targetId || x.targetId === targetId) && Date.now() - x.createdTimestamp < 15000);
    return e ? { user: e.executor, reason: e.reason } : null;
  } catch { return null; }
}
const by = ex => ({ name: 'Realizado por', value: ex ? tag(ex.user) : 'No disponible', inline: true });
const why = ex => (ex?.reason ? { name: 'Razón', value: ex.reason } : null);
const diff = (a, b, label, fmt = x => String(x ?? '—')) => (a !== b ? { name: label, value: `${fmt(a)} ➜ ${fmt(b)}`, inline: true } : null);
const permSig = ch => JSON.stringify([...ch.permissionOverwrites.cache.values()].map(p => [p.id, String(p.allow.bitfield), String(p.deny.bitfield)]));

module.exports = c => {
  // ---------- MENSAJES ----------
  c.on('messageDelete', async m => {
    if (!m.guild || m.author?.id === c.user.id) return;
    const ex = await who(m.guild, A.MessageDelete, m.author?.id);
    log(m.guild, 'messages', {
      title: '🗑️ Mensaje eliminado', color: RED, user: m.author, desc: trunc(m.content, 3500),
      fields: [
        { name: 'Canal', value: `<#${m.channelId}>`, inline: true },
        { name: 'Eliminado por', value: ex ? tag(ex.user) : 'El autor u otro', inline: true },
        m.attachments?.size ? { name: 'Adjuntos', value: [...m.attachments.values()].map(a => a.url).join('\n') } : null,
      ],
    });
  });
  c.on('messageUpdate', (o, n) => {
    if (!n.guild || n.author?.bot || o.content === n.content) return;
    log(n.guild, 'messages', {
      title: '✏️ Mensaje editado', color: YELLOW, user: n.author,
      fields: [
        { name: 'Antes', value: o.partial ? '*(no estaba en caché)*' : trunc(o.content) },
        { name: 'Después', value: trunc(n.content) },
        { name: 'Canal', value: `<#${n.channelId}> • [Ir al mensaje](${n.url})` },
      ],
    });
  });
  c.on('messageDeleteBulk', (msgs, ch) => {
    log(ch.guild, 'messages', {
      title: '🧹 Purga de mensajes', color: RED,
      desc: `**${msgs.size}** mensajes eliminados en <#${ch.id}>`,
      fields: [{ name: 'Muestra', value: trunc([...msgs.values()].slice(0, 8).map(m => `**${m.author?.username ?? '?'}**: ${trunc(m.content, 80)}`).join('\n')) }],
    });
  });

  // ---------- MIEMBROS ----------
  c.on('guildMemberAdd', m => {
    log(m.guild, 'members', {
      title: '📥 Miembro entró', color: GREEN, user: m.user, thumb: m.user.displayAvatarURL(),
      fields: [
        { name: 'Usuario', value: `<@${m.id}>`, inline: true },
        { name: 'Cuenta creada', value: `<t:${Math.floor(m.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Miembros', value: String(m.guild.memberCount), inline: true },
        m.user.bot ? { name: 'Tipo', value: '🤖 Bot' } : null,
      ],
    });
  });
  c.on('guildMemberRemove', async m => {
    const ex = await who(m.guild, A.MemberKick, m.id);
    log(m.guild, ex ? 'moderation' : 'members', {
      title: ex ? '👢 Miembro expulsado' : '📤 Miembro salió', color: ex ? RED : YELLOW, user: m.user, thumb: m.user.displayAvatarURL(),
      fields: [
        { name: 'Usuario', value: `<@${m.id}>`, inline: true },
        m.joinedTimestamp ? { name: 'Se unió', value: `<t:${Math.floor(m.joinedTimestamp / 1000)}:R>`, inline: true } : null,
        ex ? by(ex) : null, ex ? why(ex) : null,
        m.roles?.cache ? { name: 'Roles', value: trunc(m.roles.cache.filter(r => r.id !== m.guild.id).map(r => `<@&${r.id}>`).join(' ')) } : null,
      ],
    });
  });
  c.on('guildMemberUpdate', async (o, n) => {
    if (o.nickname !== n.nickname) log(n.guild, 'members', { user: n.user, title: '🏷️ Apodo cambiado', fields: [diff(o.nickname, n.nickname, 'Apodo')] });
    const add = n.roles.cache.filter(r => !o.roles.cache.has(r.id)), rem = o.roles.cache.filter(r => !n.roles.cache.has(r.id));
    if (add.size || rem.size) {
      const ex = await who(n.guild, A.MemberRoleUpdate, n.id);
      log(n.guild, 'members', {
        user: n.user, title: '🎭 Roles actualizados', color: BLUE,
        fields: [
          { name: 'Miembro', value: `<@${n.id}>`, inline: true }, by(ex),
          add.size ? { name: 'Añadidos', value: add.map(r => `<@&${r.id}>`).join(' ') } : null,
          rem.size ? { name: 'Quitados', value: rem.map(r => `<@&${r.id}>`).join(' ') } : null,
        ],
      });
    }
    if (o.communicationDisabledUntilTimestamp !== n.communicationDisabledUntilTimestamp) {
      const until = n.communicationDisabledUntilTimestamp;
      const ex = await who(n.guild, A.MemberUpdate, n.id);
      log(n.guild, 'moderation', {
        user: n.user, title: until && until > Date.now() ? '🔇 Timeout aplicado' : '🔊 Timeout retirado', color: YELLOW,
        fields: [{ name: 'Miembro', value: `<@${n.id}>`, inline: true }, until ? { name: 'Hasta', value: `<t:${Math.floor(until / 1000)}:f>`, inline: true } : null, by(ex), why(ex)],
      });
    }
  });
  c.on('guildBanAdd', async b => {
    const ex = await who(b.guild, A.MemberBanAdd, b.user.id);
    log(b.guild, 'moderation', { title: '🔨 Usuario baneado', color: RED, user: b.user, thumb: b.user.displayAvatarURL(), fields: [{ name: 'Usuario', value: `<@${b.user.id}>`, inline: true }, by(ex), { name: 'Razón', value: b.reason || ex?.reason || 'Sin razón' }] });
  });
  c.on('guildBanRemove', async b => {
    const ex = await who(b.guild, A.MemberBanRemove, b.user.id);
    log(b.guild, 'moderation', { title: '♻️ Usuario desbaneado', color: GREEN, user: b.user, fields: [{ name: 'Usuario', value: `<@${b.user.id}>`, inline: true }, by(ex)] });
  });

  // ---------- CANALES ----------
  c.on('channelCreate', async ch => {
    if (!ch.guild) return; const ex = await who(ch.guild, A.ChannelCreate, ch.id);
    log(ch.guild, 'channels', { title: '📁 Canal creado', color: GREEN, fields: [{ name: 'Canal', value: `<#${ch.id}> (${ch.name})`, inline: true }, { name: 'Tipo', value: CT[ch.type] || String(ch.type), inline: true }, by(ex)] });
  });
  c.on('channelDelete', async ch => {
    if (!ch.guild) return; const ex = await who(ch.guild, A.ChannelDelete, ch.id);
    log(ch.guild, 'channels', { title: '🗑️ Canal eliminado', color: RED, fields: [{ name: 'Canal', value: `#${ch.name}`, inline: true }, { name: 'Tipo', value: CT[ch.type] || String(ch.type), inline: true }, by(ex)] });
  });
  c.on('channelUpdate', async (o, n) => {
    if (!n.guild) return;
    const f = [diff(o.name, n.name, 'Nombre'), diff(o.topic, n.topic, 'Tema'), diff(o.nsfw, n.nsfw, 'NSFW'), diff(o.rateLimitPerUser, n.rateLimitPerUser, 'Modo lento (s)'), diff(o.parentId, n.parentId, 'Categoría', x => (x ? `<#${x}>` : 'ninguna')), diff(o.bitrate, n.bitrate, 'Bitrate'), diff(o.userLimit, n.userLimit, 'Límite usuarios')].filter(Boolean);
    if (o.permissionOverwrites && permSig(o) !== permSig(n)) f.push({ name: 'Permisos', value: 'Se modificaron los permisos del canal' });
    if (!f.length) return;
    const ex = await who(n.guild, A.ChannelUpdate, n.id);
    log(n.guild, 'channels', { title: '🔧 Canal editado', color: YELLOW, fields: [{ name: 'Canal', value: `<#${n.id}>`, inline: true }, by(ex), ...f] });
  });

  // ---------- ROLES ----------
  c.on('roleCreate', async r => { const ex = await who(r.guild, A.RoleCreate, r.id); log(r.guild, 'roles', { title: '🎭 Rol creado', color: GREEN, fields: [{ name: 'Rol', value: `<@&${r.id}> (${r.name})`, inline: true }, by(ex)] }); });
  c.on('roleDelete', async r => { const ex = await who(r.guild, A.RoleDelete, r.id); log(r.guild, 'roles', { title: '🗑️ Rol eliminado', color: RED, fields: [{ name: 'Rol', value: r.name, inline: true }, by(ex)] }); });
  c.on('roleUpdate', async (o, n) => {
    const f = [diff(o.name, n.name, 'Nombre'), diff(o.hexColor, n.hexColor, 'Color'), diff(o.hoist, n.hoist, 'Separado'), diff(o.mentionable, n.mentionable, 'Mencionable')].filter(Boolean);
    if (o.permissions.bitfield !== n.permissions.bitfield) {
      const a = n.permissions.missing(o.permissions), b = o.permissions.missing(n.permissions);
      if (a.length) f.push({ name: '➕ Permisos añadidos', value: a.join(', ') });
      if (b.length) f.push({ name: '➖ Permisos quitados', value: b.join(', ') });
    }
    if (!f.length) return; const ex = await who(n.guild, A.RoleUpdate, n.id);
    log(n.guild, 'roles', { title: '🔧 Rol editado', color: YELLOW, fields: [{ name: 'Rol', value: `<@&${n.id}>`, inline: true }, by(ex), ...f] });
  });

  // ---------- VOZ ----------
  c.on('voiceStateUpdate', (o, n) => {
    const g = n.guild, u = n.member?.user; if (!u) return;
    const row = (title, color, extra = []) => log(g, 'voice', { title, color, user: u, fields: [{ name: 'Usuario', value: `<@${u.id}>`, inline: true }, ...extra] });
    if (!o.channelId && n.channelId) return row('🎙️ Entró a voz', GREEN, [{ name: 'Canal', value: `<#${n.channelId}>`, inline: true }]);
    if (o.channelId && !n.channelId) return row('🚪 Salió de voz', RED, [{ name: 'Canal', value: `<#${o.channelId}>`, inline: true }]);
    if (o.channelId !== n.channelId) return row('🔀 Cambió de canal de voz', BLUE, [{ name: 'De', value: `<#${o.channelId}>`, inline: true }, { name: 'A', value: `<#${n.channelId}>`, inline: true }]);
    const f = [diff(o.serverMute, n.serverMute, 'Mute del servidor'), diff(o.serverDeaf, n.serverDeaf, 'Ensordecido por servidor'), diff(o.selfMute, n.selfMute, 'Automute'), diff(o.selfDeaf, n.selfDeaf, 'Autoensordecido'), diff(o.streaming, n.streaming, 'Stream'), diff(o.selfVideo, n.selfVideo, 'Cámara')].filter(Boolean);
    if (f.length) row('🎚️ Estado de voz', YELLOW, [{ name: 'Canal', value: `<#${n.channelId}>`, inline: true }, ...f]);
  });

  // ---------- SERVIDOR / EMOJIS / INVITES / HILOS ----------
  c.on('guildUpdate', async (o, n) => {
    const f = [diff(o.name, n.name, 'Nombre'), diff(o.icon, n.icon, 'Icono'), diff(o.banner, n.banner, 'Banner'), diff(o.ownerId, n.ownerId, 'Dueño', x => `<@${x}>`), diff(o.verificationLevel, n.verificationLevel, 'Verificación'), diff(o.afkChannelId, n.afkChannelId, 'Canal AFK', x => (x ? `<#${x}>` : 'ninguno')), diff(o.systemChannelId, n.systemChannelId, 'Canal sistema', x => (x ? `<#${x}>` : 'ninguno')), diff(o.vanityURLCode, n.vanityURLCode, 'URL personalizada')].filter(Boolean);
    if (!f.length) return; const ex = await who(n, A.GuildUpdate);
    log(n, 'server', { title: '⚙️ Servidor actualizado', color: YELLOW, fields: [by(ex), ...f] });
  });
  c.on('emojiCreate', async e => { const ex = await who(e.guild, A.EmojiCreate, e.id); log(e.guild, 'emojis', { title: '😀 Emoji creado', color: GREEN, thumb: e.imageURL(), fields: [{ name: 'Emoji', value: `${e} \`:${e.name}:\``, inline: true }, by(ex)] }); });
  c.on('emojiDelete', async e => { const ex = await who(e.guild, A.EmojiDelete, e.id); log(e.guild, 'emojis', { title: '🗑️ Emoji eliminado', color: RED, fields: [{ name: 'Nombre', value: e.name, inline: true }, by(ex)] }); });
  c.on('emojiUpdate', (o, n) => o.name !== n.name && log(n.guild, 'emojis', { title: '✏️ Emoji renombrado', fields: [diff(o.name, n.name, 'Nombre')] }));
  c.on('stickerCreate', s => s.guild && log(s.guild, 'emojis', { title: '🏷️ Sticker creado', color: GREEN, fields: [{ name: 'Nombre', value: s.name }] }));
  c.on('stickerDelete', s => s.guild && log(s.guild, 'emojis', { title: '🗑️ Sticker eliminado', color: RED, fields: [{ name: 'Nombre', value: s.name }] }));
  c.on('inviteCreate', i => i.guild && log(i.guild, 'invites', { title: '🔗 Invitación creada', color: GREEN, user: i.inviter, fields: [{ name: 'Código', value: i.code, inline: true }, { name: 'Canal', value: `<#${i.channelId}>`, inline: true }, { name: 'Usos máx.', value: String(i.maxUses || '∞'), inline: true }, { name: 'Expira', value: i.expiresTimestamp ? `<t:${Math.floor(i.expiresTimestamp / 1000)}:R>` : 'Nunca', inline: true }] }));
  c.on('inviteDelete', i => i.guild && log(i.guild, 'invites', { title: '❌ Invitación eliminada', color: RED, fields: [{ name: 'Código', value: i.code }] }));
  c.on('threadCreate', t => t.guild && log(t.guild, 'threads', { title: '🧵 Hilo creado', color: GREEN, fields: [{ name: 'Hilo', value: `<#${t.id}> (${t.name})`, inline: true }, { name: 'Padre', value: `<#${t.parentId}>`, inline: true }] }));
  c.on('threadDelete', t => t.guild && log(t.guild, 'threads', { title: '🗑️ Hilo eliminado', color: RED, fields: [{ name: 'Hilo', value: t.name }] }));
  c.on('threadUpdate', (o, n) => { const f = [diff(o.name, n.name, 'Nombre'), diff(o.archived, n.archived, 'Archivado'), diff(o.locked, n.locked, 'Bloqueado')].filter(Boolean); if (f.length) log(n.guild, 'threads', { title: '🔧 Hilo editado', color: YELLOW, fields: [{ name: 'Hilo', value: `<#${n.id}>` }, ...f] }); });

  // ---------- REACCIONES / WEBHOOKS ----------
  c.on('messageReactionAdd', (r, u) => { if (!r.message.guild || u.bot) return; log(r.message.guild, 'reactions', { title: '➕ Reacción añadida', color: GREEN, user: u, fields: [{ name: 'Emoji', value: String(r.emoji), inline: true }, { name: 'Mensaje', value: `[Ir al mensaje](${r.message.url})`, inline: true }] }); });
  c.on('messageReactionRemove', (r, u) => { if (!r.message.guild || u.bot) return; log(r.message.guild, 'reactions', { title: '➖ Reacción quitada', color: RED, user: u, fields: [{ name: 'Emoji', value: String(r.emoji), inline: true }, { name: 'Mensaje', value: `[Ir al mensaje](${r.message.url})`, inline: true }] }); });
  c.on('webhooksUpdate', ch => ch.guild && log(ch.guild, 'webhooks', { title: '🪝 Webhooks modificados', color: YELLOW, fields: [{ name: 'Canal', value: `<#${ch.id}>` }] }));
};
