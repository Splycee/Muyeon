const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const crypto = require('crypto');
const path = require('path');
const { ChannelType } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const Warn = require('../models/Warn');
const { CATS, log, invalidate, getConfig } = require('../bot/logger');
const { build, url, str } = require('../utils/builders');
const { sendViaWebhook } = require('../utils/webhooks');

const DISCORD = 'https://discord.com/api/v10';

function startWeb(client) {
  const app = express();
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '200kb' }));
  app.use(session({
    secret: process.env.SESSION_SECRET || 'cambia-esto',
    resave: false, saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { maxAge: 7 * 864e5, httpOnly: true, secure: 'auto', sameSite: 'lax' },
  }));
  app.get('/health', (_, res) => res.send('ok'));   // para UptimeRobot
  app.use(express.static(path.join(__dirname, 'public')));

  // ---------- OAuth2 ----------
  app.get('/auth/login', (req, res) => {
    req.session.state = crypto.randomBytes(16).toString('hex');
    const q = new URLSearchParams({ client_id: process.env.CLIENT_ID, redirect_uri: `${base}/auth/callback`, response_type: 'code', scope: 'identify guilds', state: req.session.state });
    res.redirect(`https://discord.com/oauth2/authorize?${q}`);
  });
  app.get('/auth/callback', async (req, res) => {
    try {
      if (!req.query.code || req.query.state !== req.session.state) return res.status(400).send('Estado inválido. Vuelve a iniciar sesión.');
      const tr = await fetch(`${DISCORD}/oauth2/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: process.env.CLIENT_ID, client_secret: process.env.CLIENT_SECRET, grant_type: 'authorization_code', code: req.query.code, redirect_uri: `${base}/auth/callback` }),
      });
      const tok = await tr.json();
      if (!tok.access_token) return res.status(400).send('No se pudo iniciar sesión.');
      const H = { Authorization: `Bearer ${tok.access_token}` };
      const user = await (await fetch(`${DISCORD}/users/@me`, { headers: H })).json();
      req.session.user = { id: user.id, username: user.global_name || user.username, avatar: user.avatar };
      req.session.token = tok.access_token;
      req.session.guilds = await (await fetch(`${DISCORD}/users/@me/guilds`, { headers: H })).json();
      res.redirect('/');
    } catch (e) { console.error(e); res.status(500).send('Error en el login'); }
  });
  app.get('/auth/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

  // ---------- Middlewares ----------
  const auth = (req, res, next) => (req.session.user ? next() : res.status(401).json({ error: 'No has iniciado sesión' }));
  const canManage = g => g.owner || (BigInt(g.permissions) & 0x28n) !== 0n; // Administrador o Gestionar servidor
  const access = (req, res, next) => {
    const g = req.session.guilds?.find(x => x.id === req.params.id);
    const guild = client.guilds.cache.get(req.params.id);
    if (!g || !canManage(g) || !guild) return res.status(403).json({ error: 'Sin acceso a este servidor' });
    req.guild = guild; next();
  };
  const hits = new Map();
  const limit = (req, res, next) => {
    const k = req.session.user.id, now = Date.now(), arr = (hits.get(k) || []).filter(t => now - t < 60000);
    if (arr.length >= 20) return res.status(429).json({ error: 'Demasiados envíos, espera un minuto.' });
    arr.push(now); hits.set(k, arr); next();
  };
  const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(400).json({ error: e.message || 'Error' }); });
  const api = express.Router();
  api.use(auth);

  // ---------- API ----------
  api.get('/me', (req, res) => res.json({ user: req.session.user, categories: CATS, clientId: process.env.CLIENT_ID }));

  api.get('/guilds', wrap(async (req, res) => {
    try {
      const r = await fetch(`${DISCORD}/users/@me/guilds`, { headers: { Authorization: `Bearer ${req.session.token}` } });
      if (r.ok) req.session.guilds = await r.json();
    } catch {}
    res.json((req.session.guilds || []).filter(canManage).map(g => ({
      id: g.id, name: g.name, botIn: client.guilds.cache.has(g.id),
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null,
    })));
  }));

  api.get('/guilds/:id', access, wrap(async (req, res) => {
    const g = req.guild, cfg = await getConfig(g.id);
    const channels = g.channels.cache.filter(c => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type))
      .sort((a, b) => a.rawPosition - b.rawPosition).map(c => ({ id: c.id, name: c.name, category: c.parent?.name || '' }));
    res.json({ id: g.id, name: g.name, members: g.memberCount, channels, config: { logChannelId: cfg.logChannelId, logCategories: cfg.logCategories || {}, webhookProfile: cfg.webhookProfile || {} } });
  }));

  api.put('/guilds/:id/config', access, wrap(async (req, res) => {
    const b = req.body, g = req.guild, set = {};
    if ('logChannelId' in b) {
      if (b.logChannelId && !g.channels.cache.has(b.logChannelId)) throw new Error('Canal de logs inválido');
      set.logChannelId = b.logChannelId || '';
    }
    if (b.logCategories) { const lc = {}; for (const k of Object.keys(CATS)) lc[k] = b.logCategories[k] !== false; set.logCategories = lc; }
    if (b.webhookProfile) set.webhookProfile = { name: str(b.webhookProfile.name, 80), avatar: url(b.webhookProfile.avatar) || '' };
    await GuildConfig.updateOne({ guildId: g.id }, { $set: set }, { upsert: true });
    invalidate(g.id);
    log(g, 'panel', { title: '🛠️ Configuración cambiada desde el panel', fields: [{ name: 'Por', value: `<@${req.session.user.id}> (${req.session.user.username})` }, { name: 'Cambios', value: Object.keys(set).join(', ') || '—' }] });
    res.json({ ok: true });
  }));

  api.post('/guilds/:id/send', access, limit, wrap(async (req, res) => {
    const b = req.body, g = req.guild, cfg = await getConfig(g.id);
    const payload = build(b);
    const msg = await sendViaWebhook(g, String(b.channelId), {
      profile: cfg.webhookProfile || {}, override: { name: str(b.username, 80), avatar: url(b.avatarUrl) },
      payload, allowMentions: !!b.allowMentions,
    });
    log(g, 'panel', { title: '📨 Mensaje enviado desde el panel', fields: [{ name: 'Por', value: `<@${req.session.user.id}> (${req.session.user.username})`, inline: true }, { name: 'Canal', value: `<#${b.channelId}>`, inline: true }, { name: 'Tipo', value: b.mode === 'v2' ? 'Components V2' : 'Embed normal', inline: true }, { name: 'Mensaje', value: `[Ir al mensaje](https://discord.com/channels/${g.id}/${b.channelId}/${msg.id})` }] });
    res.json({ ok: true, id: msg.id });
  }));

  // Moderación
  api.get('/guilds/:id/warns', access, wrap(async (req, res) => res.json(await Warn.find({ guildId: req.guild.id }).sort({ date: -1 }).limit(100).lean())));
  api.delete('/guilds/:id/warns/:wid', access, wrap(async (req, res) => { await Warn.deleteOne({ _id: req.params.wid, guildId: req.guild.id }); res.json({ ok: true }); }));
  api.get('/guilds/:id/bans', access, wrap(async (req, res) => {
    const bans = await req.guild.bans.fetch({ limit: 100 });
    res.json([...bans.values()].map(b => ({ id: b.user.id, name: b.user.username, reason: b.reason })));
  }));
  api.delete('/guilds/:id/bans/:uid', access, wrap(async (req, res) => {
    await req.guild.members.unban(req.params.uid, `Panel: ${req.session.user.username}`);
    res.json({ ok: true });
  }));

  app.use('/api', api);
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`🌐 Panel en puerto ${port}`));
}
module.exports = { startWeb };
