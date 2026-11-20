const url = s => (typeof s === 'string' && /^https?:\/\/\S+$/.test(s.trim()) ? s.trim() : undefined);
const str = (s, n) => (typeof s === 'string' ? s.slice(0, n) : '');
const color = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); return m ? parseInt(m[1], 16) : 0x7c8cff; };
const imgs = (b, max) => (Array.isArray(b.images) ? b.images : []).map(url).filter(Boolean).slice(0, max);
const cleanFields = b => (Array.isArray(b.fields) ? b.fields : []).map(f => ({ name: str(f.name, 256), value: str(f.value, 1024), inline: !!f.inline })).filter(f => f.name && f.value).slice(0, 25);
function buttonsRow(b) {
  const list = (Array.isArray(b.buttons) ? b.buttons : []).map(x => ({ label: str(x.label, 80), url: url(x.url) })).filter(x => x.label && x.url).slice(0, 5);
  return list.length ? { type: 1, components: list.map(x => ({ type: 2, style: 5, label: x.label, url: x.url })) } : null;
}

// ---- Embed clásico ----
function normal(b) {
  const [img] = imgs(b, 1), pos = b.imagePosition;
  const e = { color: color(b.color) };
  const t = str(b.title, 256), d = str(b.description, 4000), f = cleanFields(b);
  if (t) e.title = t;
  if (d) e.description = d;
  if (url(b.url)) e.url = url(b.url);
  if (b.authorName) e.author = { name: str(b.authorName, 256), icon_url: url(b.authorIcon) };
  if (b.footerText) e.footer = { text: str(b.footerText, 2048), icon_url: url(b.footerIcon) };
  if (b.timestamp) e.timestamp = new Date().toISOString();
  if (f.length) e.fields = f;
  const embeds = [];
  const hasBody = t || d || f.length || e.author || e.footer;
  if (img) {
    if (pos === 'side') e.thumbnail = { url: img };
    else if (pos === 'top') embeds.push({ color: e.color, image: { url: img } }); // embed de solo imagen encima
    else e.image = { url: img };
  }
  if (hasBody || (img && pos !== 'top')) embeds.push(e);
  const content = str(b.content, 2000);
  if (!content && !embeds.length) throw new Error('El embed está vacío: añade texto, título o imagen.');
  const row = buttonsRow(b);
  return { content: content || undefined, embeds, components: row ? [row] : undefined };
}

// ---- Components V2 ----
function v2(b) {
  const list = imgs(b, 10), pos = b.imagePosition, spoiler = !!b.spoiler;
  const gallery = () => ({ type: 12, items: list.map(u => ({ media: { url: u }, spoiler })) });
  const t = str(b.title, 256), d = str(b.description, 3500), f = cleanFields(b), c = [];
  const head = t ? `## ${url(b.url) ? `[${t}](${url(b.url)})` : t}` : '';
  const text = [b.authorName ? `-# ${str(b.authorName, 100)}` : '', head, d].filter(Boolean).join('\n');

  if (list.length && pos === 'top') c.push(gallery());
  if (list.length && pos === 'side' && text) c.push({ type: 9, components: [{ type: 10, content: text }], accessory: { type: 11, media: { url: list[0] }, spoiler } });
  else if (text) c.push({ type: 10, content: text });
  for (const x of f) {
    if (b.divider) c.push({ type: 14, divider: true, spacing: 1 });
    c.push({ type: 10, content: `**${x.name}**\n${x.value}` });
  }
  if (list.length && (pos === 'bottom' || (pos === 'side' && !text))) c.push(gallery());
  const row = buttonsRow(b);
  if (row) c.push(row);
  const foot = [b.footerText ? str(b.footerText, 200) : '', b.timestamp ? `<t:${Math.floor(Date.now() / 1000)}:f>` : ''].filter(Boolean).join(' • ');
  if (foot) { c.push({ type: 14, divider: true, spacing: 1 }); c.push({ type: 10, content: `-# ${foot}` }); }
  if (!c.length) throw new Error('El mensaje V2 está vacío: añade texto o imagen.');
  return { flags: 1 << 15, components: [{ type: 17, accent_color: color(b.color), components: c.slice(0, 38) }] };
}

module.exports = { build: b => (b.mode === 'v2' ? v2(b) : normal(b)), url, str };
