require('dotenv').config();
const { client, startBot } = require('./src/bot/client');
const { startWeb } = require('./src/web/server');

(async () => {
  startWeb(client);      // primero la web, Render necesita ver el puerto abierto
  await startBot();
})().catch(e => { console.error(e); process.exit(1); });
