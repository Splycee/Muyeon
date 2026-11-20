const { Routes } = require('discord.js');
const cache = new Map(); // channelId -> webhook

async function getHook(guild, ch, name) {
  let hook = cache.get(ch.id);
  if (hook) return hook;
  const hooks = await ch.fetchWebhooks();
  hook = hooks.find(h => h.owner?.id === guild.client.user.id && h.token);
  if (!hook) hook = await ch.createWebhook({ name: (name || 'Panel').slice(0, 80), reason: 'Webhook automático del panel' });
  cache.set(ch.id, hook);
  return hook;
}

async function sendViaWebhook(guild, channelId, { profile = {}, override = {}, payload, allowMentions }) {
  const ch = await guild.channels.fetch(channelId).catch(() => null);
  if (!ch || ![0, 5].includes(ch.type)) throw new Error('Canal inválido (usa un canal de texto o anuncios).');
  const perms = ch.permissionsFor(guild.members.me);
  if (!perms?.has(['ViewChannel', 'ManageWebhooks'])) throw new Error('Al bot le falta el permiso "Gestionar webhooks" en ese canal.');

  const body = {
    ...payload,
    username: (override.name || profile.name || undefined)?.slice(0, 80),
    avatar_url: override.avatar || profile.avatar || undefined,
    allowed_mentions: allowMentions ? { parse: ['users', 'roles'] } : { parse: [] },
  };
  const post = hook => guild.client.rest.post(Routes.webhook(hook.id, hook.token), {
    auth: false, body, query: new URLSearchParams({ wait: 'true', with_components: 'true' }),
  });

  let hook = await getHook(guild, ch, profile.name);
  try { return await post(hook); }
  catch (e) {
    if (e.status !== 404) throw e;        // webhook borrado a mano: lo recreamos
    cache.delete(ch.id);
    hook = await getHook(guild, ch, profile.name);
    return post(hook);
  }
}
module.exports = { sendViaWebhook };
