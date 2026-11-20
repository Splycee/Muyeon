const { SlashCommandBuilder: S, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = [
  {
    data: new S().setName('ping').setDescription('Latencia del bot'),
    async run(i) { await i.reply(`🏓 Pong! **${i.client.ws.ping}ms**`); },
  },
  {
    data: new S().setName('panel').setDescription('Enlace al panel web'),
    async run(i) { await i.reply({ content: `🖥️ Panel: ${process.env.PUBLIC_URL}`, flags: MessageFlags.Ephemeral }); },
  },
  {
    data: new S().setName('avatar').setDescription('Muestra el avatar de un usuario')
      .addUserOption(o => o.setName('usuario').setDescription('Usuario')),
    async run(i) {
      const u = i.options.getUser('usuario') || i.user;
      await i.reply({ embeds: [new EmbedBuilder().setColor(0x7c8cff).setTitle(`Avatar de ${u.username}`).setImage(u.displayAvatarURL({ size: 1024 }))] });
    },
  },
  {
    data: new S().setName('userinfo').setDescription('Información de un usuario')
      .addUserOption(o => o.setName('usuario').setDescription('Usuario')).setContexts(0),
    async run(i) {
      const u = i.options.getUser('usuario') || i.user, m = await i.guild.members.fetch(u.id).catch(() => null);
      const e = new EmbedBuilder().setColor(m?.displayColor || 0x7c8cff).setTitle(u.username).setThumbnail(u.displayAvatarURL({ size: 256 }))
        .addFields({ name: 'ID', value: u.id, inline: true }, { name: 'Cuenta creada', value: `<t:${Math.floor(u.createdTimestamp / 1000)}:R>`, inline: true });
      if (m) e.addFields({ name: 'Se unió', value: `<t:${Math.floor(m.joinedTimestamp / 1000)}:R>`, inline: true }, { name: 'Roles', value: m.roles.cache.filter(r => r.id !== i.guild.id).map(r => `<@&${r.id}>`).join(' ').slice(0, 1000) || 'Ninguno' });
      await i.reply({ embeds: [e] });
    },
  },
  {
    data: new S().setName('serverinfo').setDescription('Información del servidor').setContexts(0),
    async run(i) {
      const g = i.guild, o = await g.fetchOwner();
      await i.reply({ embeds: [new EmbedBuilder().setColor(0x7c8cff).setTitle(g.name).setThumbnail(g.iconURL({ size: 256 }))
        .addFields({ name: 'Dueño', value: `<@${o.id}>`, inline: true }, { name: 'Miembros', value: String(g.memberCount), inline: true }, { name: 'Canales', value: String(g.channels.cache.size), inline: true }, { name: 'Roles', value: String(g.roles.cache.size), inline: true }, { name: 'Creado', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true }, { name: 'Boosts', value: String(g.premiumSubscriptionCount || 0), inline: true })] });
    },
  },
];
