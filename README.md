# Bot de Discord + Panel web

- **Registros totales** en un canal (mensajes, miembros, bans, canales, roles, voz, servidor, invitaciones, hilos, emojis, reacciones, webhooks, comandos y acciones del panel). Indica **quién** hizo cada acción usando el registro de auditoría.
- **Embeds normales y Components V2** enviados por **webhooks que el bot crea solo**, con nombre/icono editables desde el panel e imagen arriba, abajo o al lado.
- **Moderación**: `/clear /ban /unban /kick /timeout /untimeout /warn /warns /clearwarns /slowmode /lock /unlock` + `/ping /panel /avatar /userinfo /serverinfo`.
- **Panel web** con login de Discord.

## 1. Discord Developer Portal
1. Crea una aplicación en https://discord.com/developers/applications
2. **Bot** → copia el **Token** (`DISCORD_TOKEN`) y activa los intents **Server Members** y **Message Content**.
3. **OAuth2** → copia **Client ID** (`CLIENT_ID`) y **Client Secret** (`CLIENT_SECRET`).
4. **OAuth2 → Redirects** → añade `https://TU-APP.onrender.com/auth/callback`.
5. Invita al bot (Administrador, para poder leer la auditoría y gestionar webhooks):
   `https://discord.com/oauth2/authorize?client_id=TU_CLIENT_ID&scope=bot%20applications.commands&permissions=8`

## 2. Base de datos (gratis)
Crea un cluster en MongoDB Atlas, un usuario, y en *Network Access* permite `0.0.0.0/0`. Copia la cadena de conexión (`MONGO_URI`).
Se usa porque el disco de Render se borra en cada reinicio.

## 3. GitHub
```bash
git init && git add . && git commit -m "bot inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```
`.env` está en `.gitignore`: nunca subas el token.

## 4. Render
New → **Web Service** → tu repo.
- Build Command: `npm install`
- Start Command: `npm start`
- Variables de entorno: `DISCORD_TOKEN`, `CLIENT_ID`, `CLIENT_SECRET`, `MONGO_URI`, `SESSION_SECRET` (texto largo aleatorio), `PUBLIC_URL` (`https://TU-APP.onrender.com`, sin `/` final).

> El plan gratuito de Render se **duerme tras 15 min sin visitas** y el bot se desconecta. Crea un monitor en UptimeRobot (o cron-job.org) que haga GET a `https://TU-APP.onrender.com/health` cada 5 min.

## Probar en local
```bash
cp .env.example .env   # rellénalo (PUBLIC_URL=http://localhost:3000 y añade ese redirect en Discord)
npm install && npm start
```
