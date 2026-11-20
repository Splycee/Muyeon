const { Client, GatewayIntentBits: I, Partials: P, Collection } = require('discord.js');
const fs = require('fs'), path = require('path');

const client = new Client({
  intents: [I.Guilds, I.GuildMembers, I.GuildModeration, I.GuildExpressions, I.GuildInvites, I.GuildWebhooks,
    I.GuildVoiceStates, I.GuildMessages, I.GuildMessageReactions, I.MessageContent],
  partials: [P.Message, P.Channel, P.Reaction, P.GuildMember, P.User],
});

client.commands = new Collection();
const dir = path.join(__dirname, 'commands');
for (const f of fs.readdirSync(dir)) for (const cmd of require(path.join(dir, f))) client.commands.set(cmd.data.name, cmd);

require('./events/core')(client);
require('./events/logs')(client);

module.exports = { client, startBot: () => client.login(process.env.DISCORD_TOKEN) };
