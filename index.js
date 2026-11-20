require('dotenv').config();
const mongoose = require('mongoose');
const { client, startBot } = require('./src/bot/client');
const { startWeb } = require('./src/web/server');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB conectado');
  startWeb(client);      // primero la web, Render necesita ver el puerto abierto
  await startBot();
})().catch(e => { console.error(e); process.exit(1); });
