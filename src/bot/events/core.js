const { MessageFlags } = require('discord.js');
const { log } = require('../logger');

module.exports = client => {
  client.once('clientReady', async () => {
    console.log(`🤖 Conectado como ${client.user.tag}`);
    await client.application.commands.set([...client.commands.values()].map(c => c.data.toJSON()));
    console.log(`✅ ${client.commands.size} comandos registrados`);
  });

  client.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    const cmd = client.commands.get(i.commandName);
    if (!cmd) return;
    try {
      await cmd.run(i);
      if (i.guild) log(i.guild, 'commands', {
        title: '⌨️ Comando usado', user: i.user,
        fields: [{ name: 'Comando', value: `\`${i.toString()}\``.slice(0, 1000) }, { name: 'Canal', value: `<#${i.channelId}>`, inline: true }],
      });
    } catch (e) {
      console.error(`[/${i.commandName}]`, e);
      const msg = { content: `❌ Error: ${e.message}`, flags: MessageFlags.Ephemeral };
      (i.deferred || i.replied ? i.followUp(msg) : i.reply(msg)).catch(() => {});
    }
  });
};
