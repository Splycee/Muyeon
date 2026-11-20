// Almacenamiento simple en archivo JSON (sin base de datos externa)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const file = path.join(dir, 'db.json');
let db = { configs: {}, warns: [] };
try { db = { ...db, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}

let t;
function save() {
  clearTimeout(t);
  t = setTimeout(() => {
    try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(db)); fs.renameSync(file + '.tmp', file); }
    catch (e) { console.error('[store]', e.message); }
  }, 500);
}

const defaults = () => ({ logChannelId: '', logCategories: {}, webhookProfile: { name: '', avatar: '' } });
module.exports = {
  getConfig: id => ({ ...defaults(), ...(db.configs[id] || {}), guildId: id }),
  setConfig(id, set) { db.configs[id] = { ...defaults(), ...(db.configs[id] || {}), ...set }; save(); },
  addWarn(w) { db.warns.push({ _id: crypto.randomUUID(), date: Date.now(), ...w }); save(); },
  listWarns: (guildId, userId, limit = 100) => db.warns.filter(w => w.guildId === guildId && (!userId || w.userId === userId)).sort((a, b) => b.date - a.date).slice(0, limit),
  countWarns: (guildId, userId) => db.warns.filter(w => w.guildId === guildId && w.userId === userId).length,
  deleteWarn(guildId, id) { db.warns = db.warns.filter(w => !(w.guildId === guildId && w._id === id)); save(); },
  clearWarns(guildId, userId) { const n = db.warns.length; db.warns = db.warns.filter(w => !(w.guildId === guildId && w.userId === userId)); save(); return n - db.warns.length; },
};
