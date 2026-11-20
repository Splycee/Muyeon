const { SlashCommandBuilder: S, PermissionFlagsBits: P, EmbedBuilder, MessageFlags, ChannelType } = require('discord.js');
const store = require('../../store');
const eph = { flags: MessageFlags.Ephemeral };
const noDM = b => b.setContexts(0);

const ok = (t, d) => ({ embeds: [new EmbedBuilder().setColor(0x62d6a5).setTitle(t).setDescription(d)] });
async function target(i, name = 'usuario') {
  const m = await i.guild.members.fetch(i.options.getUser(name).id).catch(() => null);
  return m;
}
function canAct(i, m) {
  if (!m) return 'Ese usuario no está en el servidor.';
  if (m.id === i.user.id) return 'No puedes hacerlo contigo mismo.';
  if (m.id === i.guild.ownerId) return 'No puedes moderar al dueño.';
  if (i.guild.ownerId !== i.user.id && i.member.roles.highest.comparePositionTo(m.roles.highest) <= 0) return 'Su rol es igual o superior al tuyo.';
  return null;
}

module.exports = [
  {
    data: noDM(new S().setName('clear').setDescription('Borra mensajes del canal')
      .addIntegerOption(o => o.setName('cantidad').setDescription('1-100').setMinValue(1).setMaxValue(100).setRequired(true))
      .addUserOption(o => o.setName('usuario').setDescription('Solo mensajes de este usuario'))
      .setDefaultMemberPermissions(P.ManageMessages)),
    async run(i) {
      await i.deferReply(eph);
      const n = i.options.getInteger('cantidad'), u = i.options.getUser('usuario');
      let msgs = await i.channel.messages.fetch({ limit: 100 });
      if (u) msgs = msgs.filter(m => m.author.id === u.id);
      const del = await i.channel.bulkDelete([...msgs.values()].slice(0, n), true);
      await i.editReply(`🧹 Se borraron **${del.size}** mensajes${u ? ` de ${u.username}` : ''}. (Discord no permite borrar mensajes de más de 14 días)`);
    },
  },
  {
    data: noDM(new S().setName('ban').setDescription('Banea a un usuario')
      .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
      .addStringOption(o => o.setName('razon').setDescription('Razón'))
      .addIntegerOption(o => o.setName('borrar_dias').setDescription('Días de mensajes a borrar (0-7)').setMinValue(0).setMaxValue(7))
      .setDefaultMemberPermissions(P.BanMembers)),
    async run(i) {
      const u = i.options.getUser('usuario'), m = await target(i);
      if (m) { const e = canAct(i, m); if (e) return i.reply({ content: `❌ ${e}`, ...eph }); if (!m.bannable) return i.reply({ content: '❌ No puedo banear a ese usuario (jerarquía).', ...eph }); }
      const r = i.options.getString('razon') || 'Sin razón';
      await i.guild.members.ban(u.id, { reason: `${r} | por ${i.user.username}`, deleteMessageSeconds: (i.options.getInteger('borrar_dias') || 0) * 86400 });
      await i.reply(ok('🔨 Usuario baneado', `**${u.username}** fue baneado.\n**Razón:** ${r}`));
    },
  },
  {
    data: noDM(new S().setName('unban').setDescription('Desbanea a un usuario por ID')
      .addStringOption(o => o.setName('id').setDescription('ID del usuario').setRequired(true))
      .addStringOption(o => o.setName('razon').setDescription('Razón'))
      .setDefaultMemberPermissions(P.BanMembers)),
    async run(i) {
      const id = i.options.getString('id').trim();
      await i.guild.members.unban(id, `${i.options.getString('razon') || 'Sin razón'} | por ${i.user.username}`);
      await i.reply(ok('♻️ Usuario desbaneado', `<@${id}> fue desbaneado.`));
    },
  },
  {
    data: noDM(new S().setName('kick').setDescription('Expulsa a un usuario')
      .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
      .addStringOption(o => o.setName('razon').setDescription('Razón'))
      .setDefaultMemberPermissions(P.KickMembers)),
    async run(i) {
      const m = await target(i), e = canAct(i, m);
      if (e) return i.reply({ content: `❌ ${e}`, ...eph });
      if (!m.kickable) return i.reply({ content: '❌ No puedo expulsar a ese usuario (jerarquía).', ...eph });
      const r = i.options.getString('razon') || 'Sin razón';
      await m.kick(`${r} | por ${i.user.username}`);
      await i.reply(ok('👢 Usuario expulsado', `**${m.user.username}** fue expulsado.\n**Razón:** ${r}`));
    },
  },
  {
    data: noDM(new S().setName('timeout').setDescription('Silencia temporalmente a un usuario')
      .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
      .addIntegerOption(o => o.setName('minutos').setDescription('Duración en minutos (máx. 40320 = 28 días)').setMinValue(1).setMaxValue(40320).setRequired(true))
      .addStringOption(o => o.setName('razon').setDescription('Razón'))
      .setDefaultMemberPermissions(P.ModerateMembers)),
    async run(i) {
      const m = await target(i), e = canAct(i, m);
      if (e) return i.reply({ content: `❌ ${e}`, ...eph });
      if (!m.moderatable) return i.reply({ content: '❌ No puedo silenciar a ese usuario (jerarquía).', ...eph });
      const min = i.options.getInteger('minutos'), r = i.options.getString('razon') || 'Sin razón';
      await m.timeout(min * 60000, `${r} | por ${i.user.username}`);
      await i.reply(ok('🔇 Timeout aplicado', `**${m.user.username}** silenciado **${min} min**.\n**Razón:** ${r}`));
    },
  },
  {
    data: noDM(new S().setName('untimeout').setDescription('Quita el timeout a un usuario')
      .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
      .setDefaultMemberPermissions(P.ModerateMembers)),
    async run(i) {
      const m = await target(i);
      if (!m) return i.reply({ content: '❌ Usuario no encontrado.', ...eph });
      await m.timeout(null, `por ${i.user.username}`);
      await i.reply(ok('🔊 Timeout retirado', `**${m.user.username}** ya puede hablar.`));
    },
  },
  {
    data: noDM(new S().setName('warn').setDescription('Advierte a un usuario')
      .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
      .addStringOption(o => o.setName('razon').setDescription('Razón').setRequired(true))
      .setDefaultMemberPermissions(P.ModerateMembers)),
    async run(i) {
      const u = i.options.getUser('usuario'), r = i.options.getString('razon');
      store.addWarn({ guildId: i.guildId, userId: u.id, userTag: u.username, modId: i.user.id, modTag: i.user.username, reason: r });
      const total = store.countWarns(i.guildId, u.id);
      u.send(`⚠️ Recibiste una advertencia en **${i.guild.name}**\n**Razón:** ${r}`).catch(() => {});
      await i.reply(ok('⚠️ Advertencia registrada', `**${u.username}** ahora tiene **${total}** advertencia(s).\n**Razón:** ${r}`));
    },
  },
  {
    data: noDM(new S().setName('warns').setDescription('Ver advertencias de un usuario')
      .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
      .setDefaultMemberPermissions(P.ModerateMembers)),
    async run(i) {
      const u = i.options.getUser('usuario');
      const w = store.listWarns(i.guildId, u.id, 15);
      await i.reply({ ...ok(`Advertencias de ${u.username}`, w.length ? w.map((x, n) => `**${n + 1}.** ${x.reason} — <t:${Math.floor(x.date / 1000)}:d> por ${x.modTag}`).join('\n') : 'Sin advertencias.'), ...eph });
    },
  },
  {
    data: noDM(new S().setName('clearwarns').setDescription('Borra todas las advertencias de un usuario')
      .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
      .setDefaultMemberPermissions(P.ModerateMembers)),
    async run(i) {
      const u = i.options.getUser('usuario');
      const n = store.clearWarns(i.guildId, u.id);
      await i.reply(ok('🧽 Advertencias borradas', `Se borraron **${n}** de ${u.username}.`));
    },
  },
  {
    data: noDM(new S().setName('slowmode').setDescription('Cambia el modo lento del canal')
      .addIntegerOption(o => o.setName('segundos').setDescription('0 para desactivar (máx. 21600)').setMinValue(0).setMaxValue(21600).setRequired(true))
      .setDefaultMemberPermissions(P.ManageChannels)),
    async run(i) {
      const s = i.options.getInteger('segundos');
      await i.channel.setRateLimitPerUser(s, `por ${i.user.username}`);
      await i.reply(ok('🐌 Modo lento', s ? `Ahora es de **${s}s**.` : 'Desactivado.'));
    },
  },
  {
    data: noDM(new S().setName('lock').setDescription('Bloquea el canal para @everyone')
      .setDefaultMemberPermissions(P.ManageChannels)),
    async run(i) {
      await i.channel.permissionOverwrites.edit(i.guild.id, { SendMessages: false }, { reason: `Lock por ${i.user.username}` });
      await i.reply(ok('🔒 Canal bloqueado', 'Nadie sin permisos especiales puede escribir aquí.'));
    },
  },
  {
    data: noDM(new S().setName('unlock').setDescription('Desbloquea el canal')
      .setDefaultMemberPermissions(P.ManageChannels)),
    async run(i) {
      await i.channel.permissionOverwrites.edit(i.guild.id, { SendMessages: null }, { reason: `Unlock por ${i.user.username}` });
      await i.reply(ok('🔓 Canal desbloqueado', 'Se restauraron los permisos.'));
    },
  },
];
