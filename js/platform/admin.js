import { el, esc, fmt, ago, toast, modal } from './ui.js';
import { avatarSVG, teunSVG } from './art.js';
import { GENRES, genreName } from './games.js';
import { api, configured } from './api.js';

// Rechten die een beheerder kan hebben, en rechten die je een gewone speler kunt geven of afnemen.
export const STAFF_PERMS = [
  ['view_stats', 'Statistieken bekijken', 'Het overzicht met cijfers en grafieken.'],
  ['manage_games', 'Games beheren', 'Games toevoegen, bewerken, verbergen en verwijderen.'],
  ['view_users', 'Gebruikers bekijken', 'De lijst met spelers en hun gegevens.'],
  ['manage_users', 'Gebruikers en rechten beheren', 'Anderen beheerder maken en rechten aanpassen.'],
];
export const USER_PERMS = [
  ['can_play', 'Games spelen', 'Uitgezet: de speler kan geen games starten.'],
  ['can_like', 'Games liken', 'Hartjes geven en favorieten bewaren.'],
  ['can_save_progress', 'Voortgang bewaren', 'Munten, aankopen en records in het account opslaan.'],
  ['can_edit_profile', 'Profiel aanpassen', 'Naam en profielpictogram wijzigen.'],
];

// ISO-tijd omzetten naar de waarde voor een datetime-local veld
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const has = (p, k) => !!p && (p.is_owner || (p.is_admin && p.permissions && p.permissions[k] === true));

const PALETTE = ['#2563eb', '#f97316', '#10b981', '#ec4899', '#8b5cf6', '#eab308', '#06b6d4'];
const GAME_EMOJI = { 'te-un-surfers': '🚆', 'te-un-puzzel': '🧩', 'te-un-x3m': '🏍️', 'te-un-drive': '🚙', 'vuur-water': '🔥', 'te-un-tikkertje': '🏃', 'te-un-robber': '🥷' };

function bars(items) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return `<div class="ad-bars">${items.map((i, n) => `<div class="ad-bar"><span title="${esc(i.label)}">${esc(i.label)}</span><div><i style="width:${(i.value / max) * 100}%;background:linear-gradient(90deg,${PALETTE[n % PALETTE.length]},${PALETTE[(n + 1) % PALETTE.length]})"></i></div><b>${fmt(i.value)}</b></div>`).join('') || '<p class="ad-muted">Nog geen gegevens.</p>'}</div>`;
}
// kleine tegel met het logo (of plaatje) van een game
function gameTile(g, n = 0, cls = '') {
  const c = PALETTE[n % PALETTE.length];
  const inner = g.logo ? `<img src="${esc(g.logo)}" alt="" loading="lazy">` : g.thumb ? `<span style="background-image:url('${esc(g.thumb)}')"></span>` : `<em>${GAME_EMOJI[g.id] || '🎮'}</em>`;
  return `<div class="ad-gt ${cls}" style="--c:${c}">${inner}</div>`;
}

function line(points) {
  const W = 640;
  const H = 170;
  const max = Math.max(1, ...points.map((p) => p.count));
  const step = W / Math.max(1, points.length - 1);
  const xy = points.map((p, i) => [i * step, H - 18 - (p.count / max) * (H - 40)]);
  const d = xy.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  return `<svg class="ad-line" viewBox="0 0 ${W} ${H + 20}" preserveAspectRatio="none" role="img" aria-label="Gespeeld per dag">
    ${[0, 1, 2, 3].map((i) => `<line x1="0" x2="${W}" y1="${10 + i * ((H - 28) / 3)}" y2="${10 + i * ((H - 28) / 3)}" stroke="#e8ecf3"/>`).join('')}
    <defs><linearGradient id="adg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2563eb" stop-opacity=".18"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L${W} ${H - 18} L0 ${H - 18} Z" fill="url(#adg)"/><path d="${d}" fill="none" stroke="#2563eb" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    ${xy.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#fff" stroke="#2563eb" stroke-width="2"><title>${points[i].day}: ${points[i].count}</title></circle>`).join('')}
    <text x="0" y="${H + 14}" class="lt">${points[0] ? points[0].day.slice(5) : ''}</text><text x="${W}" y="${H + 14}" text-anchor="end" class="lt">${points.length ? points[points.length - 1].day.slice(5) : ''}</text></svg>`;
}

export async function renderAdmin(app) {
  const me = app.state.profile;
  const f = document.createDocumentFragment();
  const staff = me && (me.is_owner || me.is_admin);
  if (!staff) {
    f.appendChild(el(`<div class="ad-denied"><div><h1>Geen toegang</h1><p>Dit gedeelte is alleen voor beheerders. Log in met een beheerdersaccount.</p><a class="ad-btn primary" href="/">Naar het platform</a></div></div>`));
    return f;
  }
  const tabs = [
    ['overview', 'Overzicht', has(me, 'view_stats'), '📊'],
    ['games', 'Games', has(me, 'manage_games'), '🎮'],
    ['online', 'Nu online', has(me, 'view_users'), '🟢'],
    ['time', 'Speeltijd', has(me, 'view_users'), '⏱️'],
    ['users', 'Gebruikers', has(me, 'view_users') || has(me, 'manage_users'), '👥'],
  ].filter((t) => t[2]);
  if (!tabs.length) {
    f.appendChild(el(`<div class="ad-denied"><div><h1>Geen rechten</h1><p>Je bent beheerder, maar de eigenaar heeft je nog geen rechten gegeven.</p><a class="ad-btn primary" href="/">Naar het platform</a></div></div>`));
    return f;
  }
  const url = new URL(location.href);
  let tab = url.searchParams.get('tab');
  if (!tabs.some((t) => t[0] === tab)) tab = tabs[0][0];

  const page = el(`<div class="ad">
    <aside class="ad-side">
      <div class="ad-brand"><img src="/assets/logo-wide.png" alt="Te-Un Games"><small>Beheer</small></div>
      <nav>${tabs.map(([id, name, , icon]) => `<a href="/admin?tab=${id}" class="${id === tab ? 'on' : ''}" data-tab="${id}"><i>${icon}</i>${name}</a>`).join('')}</nav>
      <div class="ad-mascot"><div class="ad-mascot-svg">${teunSVG({ cls: 'wave' })}</div><p>Hoi ${esc(me.username || 'beheerder')}!</p></div>
      <a class="ad-back" href="/">&larr; Terug naar het platform</a>
    </aside>
    <main class="ad-main"><div class="ad-load">Laden...</div></main></div>`);
  f.appendChild(page);
  const main = page.querySelector('.ad-main');

  const head = (title, sub = '', right = '') => `<header class="ad-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div>${right}</div></header>`;
  const demo = configured ? '' : '<div class="ad-note">Demo-modus: de gegevens komen uit deze browser. Koppel Supabase voor echte cijfers.</div>';

  async function overview() {
    const [ov, games, users] = await Promise.all([api.adminOverview(), api.adminListGames().catch(() => []), has(me, 'view_users') ? api.adminUsers().catch(() => []) : Promise.resolve([])]);
    const byPlays = [...games].sort((a, b) => b.plays - a.plays);
    const byLikes = [...games].sort((a, b) => b.likes - a.likes);
    const top = byPlays[0];
    const hour = new Date().getHours();
    const greet = hour < 6 ? 'Goedenacht' : hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond';
    main.innerHTML = `${head('Overzicht', 'Kerncijfers van Te-Un Games.', '<button class="ad-btn" id="adRefresh">Vernieuwen</button>')}${demo}
      <section class="ad-hero"><div><h2>${greet}, ${esc(me.username || 'beheerder')}!</h2><p>Dit is wat er gebeurt op jouw Te-Un Games. ${top ? `<b>${esc(top.title)}</b> is nu de populairste game.` : 'Voeg je eerste game toe om te beginnen.'}</p></div><div class="ad-hero-art"><span class="a1">⭐</span><span class="a2">🎮</span><span class="a3">✨</span><div>${teunSVG({ cls: 'wave' })}</div></div></section>
      <div class="ad-kpis">
        <div class="ad-kpi k5" id="adOnline"><i>🟢</i><small>Nu op de site</small><b>...</b><span>even laden</span></div>
        <div class="ad-kpi k1"><i>👥</i><small>Aangemelde spelers</small><b>${fmt(ov.users)}</b><span>${fmt(ov.new_users_7d)} nieuw in 7 dagen</span></div>
        <div class="ad-kpi k2"><i>🎮</i><small>Games</small><b>${fmt(ov.games)}</b><span>${fmt(games.filter((g) => g.published).length)} gepubliceerd</span></div>
        <div class="ad-kpi k3"><i>▶️</i><small>Keer gespeeld</small><b>${fmt(ov.plays)}</b><span>in totaal</span></div>
        <div class="ad-kpi k4"><i>❤️</i><small>Likes</small><b>${fmt(ov.likes)}</b><span>op alle games</span></div>
      </div>
      <section class="ad-strip"><h3>Onze games</h3><div class="ad-strip-row">${byPlays.map((g, n) => `<div class="ad-gcard" style="--c:${PALETTE[n % PALETTE.length]}">${gameTile(g, n, 'lg')}<b>${esc(g.title)}</b><small>${esc(genreName(g.category))}</small><div class="ad-gstats"><span>▶ ${fmt(g.plays)}</span><span>❤ ${fmt(g.likes)}</span></div></div>`).join('')}</div></section>
      <div class="ad-grid">
        <section class="ad-card wide"><h3>Gespeeld per dag</h3><p class="ad-muted">Laatste 14 dagen</p>${line(ov.plays_per_day || [])}</section>
        <section class="ad-card"><h3>Meest gespeelde game</h3>${top ? `<div class="ad-top">${top.logo ? gameTile(top, 0, 'lg') : `<div class="ad-thumb" style="background-image:url('${esc(top.thumb)}')"></div>`}<div><b>${esc(top.title)}</b><p class="ad-muted">${fmt(top.plays)} keer gespeeld, ${fmt(top.likes)} likes</p></div></div>` : '<p class="ad-muted">Nog geen games.</p>'}</section>
        <section class="ad-card"><h3>Meest gespeeld</h3>${bars(byPlays.map((g) => ({ label: g.title, value: g.plays })))}</section>
        <section class="ad-card"><h3>Meeste likes</h3>${bars(byLikes.map((g) => ({ label: g.title, value: g.likes })))}</section>
        ${users.length ? `<section class="ad-card"><h3>Nieuwste spelers</h3><ul class="ad-list">${[...users].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5).map((u) => `<li><span class="ad-av">${avatarSVG(u.avatar)}</span><b>${esc(u.username)}</b><small>${ago(u.created_at)}</small></li>`).join('')}</ul></section>` : ''}
      </div>`;
    main.querySelector('#adRefresh').onclick = () => show();
    // wie is er nu op de site: ververst elke 15 seconden zolang dit overzicht open staat
    const paintOnline = async () => {
      const box = main.querySelector('#adOnline');
      if (!box) return;
      try {
        const r = await fetch('/api/online', { cache: 'no-store' });
        if (!r.ok) throw new Error('geen data');
        const o = await r.json();
        if (typeof o.total !== 'number') throw new Error('oude server');
        box.innerHTML = `<i>🟢</i><small>Nu op de site</small><b>${fmt(o.total)}</b><span>${fmt(o.users)} ingelogd · ${fmt(o.guests)} ${o.guests === 1 ? 'gast' : 'gasten'}${has(me, 'view_users') ? ' · <u>wie?</u>' : ''}</span>`;
        if (has(me, 'view_users')) { box.style.cursor = 'pointer'; box.onclick = () => { tab = 'online'; history.replaceState(null, '', '/admin?tab=online'); show(); }; }
      } catch (e) { box.innerHTML = '<i>🟢</i><small>Nu op de site</small><b>-</b><span>alleen op de echte site te zien</span>'; }
    };
    paintOnline();
    clearInterval(overview.timer);
    overview.timer = setInterval(() => { if (!main.querySelector('#adOnline')) { clearInterval(overview.timer); return; } paintOnline(); }, 15000);
  }

  // een hele pagina met wie er nu is ingelogd (de server geeft de namen alleen aan beheerders met het recht om gebruikers te bekijken)
  async function onlineTab() {
    const where = (p) => {
      const parts = String(p || '/').split('/').filter(Boolean);
      if (!parts.length) return 'Home';
      if (parts[0] === 'g') { const g = (app.state.games || []).find((x) => x.id === parts[1]); return g ? `Speelt of bekijkt ${g.title}` : 'Bekijkt een game'; }
      return ({ games: 'Alle games', favorites: 'Favorieten', profile: 'Eigen profiel', search: 'Zoeken', admin: 'Beheer' })[parts[0]] || 'Op de site';
    };
    const dur = (s) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
    const since = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'net online' : m < 60 ? `${m} min online` : `${Math.floor(m / 60)} uur ${m % 60} min online`; };
    main.innerHTML = `${head('Nu online', 'Wie er op dit moment op de site is. Deze pagina ververst zichzelf elke 10 seconden.', '<button class="ad-btn" id="onRefresh">Vernieuwen</button>')}${demo}
      <div id="onlinePage"><div class="ad-load">Laden...</div></div>`;
    const box = main.querySelector('#onlinePage');
    const paint = async () => {
      if (!main.querySelector('#onlinePage')) { clearInterval(onlineTab.timer); return; }
      try {
        const token = await api.getAccessToken();
        const r = await fetch('/api/online/users', { cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (r.status === 403) throw new Error('Geen toegang: alleen beheerders met het recht "gebruikers bekijken" zien dit.');
        if (!r.ok) throw new Error('Geen verbinding met de server.');
        const o = await r.json();
        if (!Array.isArray(o.users)) throw new Error('De server (Worker) is nog niet bijgewerkt. Zodra de nieuwste versie live staat, werkt deze pagina.');
        // de gebruikersnamen en profielfoto's komen uit de gebruikerslijst, zodat ze altijd kloppen
        if (!onlineTab.users || Date.now() - onlineTab.at > 60000) { onlineTab.users = await api.adminUsers().catch(() => onlineTab.users || []); onlineTab.at = Date.now(); }
        const byId = new Map((onlineTab.users || []).map((u) => [u.id, u]));
        o.users.forEach((u) => { const p = byId.get(u.uid); if (p) { u.name = p.username; u.avatar = p.avatar; } if (!u.name) u.name = 'Onbekend'; });
        const gname = (id) => { const g = (app.state.games || []).find((x) => x.id === id); return g ? g.title : id; };
        onlineTab.fetchedAt = Date.now();
        box.innerHTML = `<div class="ad-kpis">
            <div class="ad-kpi k5"><i>🟢</i><small>Nu op de site</small><b>${fmt(o.total)}</b><span>in totaal</span></div>
            <div class="ad-kpi k1"><i>👤</i><small>Ingelogd</small><b>${fmt(o.users.length)}</b><span>met een account</span></div>
            <div class="ad-kpi k2"><i>👻</i><small>Gasten</small><b>${fmt(o.guests)}</b><span>niet ingelogd</span></div>
            <div class="ad-kpi k3"><i>▶️</i><small>Spelen nu</small><b>${fmt(o.playingNow || 0)}</b><span>met een lopende timer</span></div>
          </div>
          <section class="ad-card"><h3>Ingelogde gebruikers</h3>
            ${o.users.length ? `<ul class="ad-list on-list">${o.users.map((u) => `<li><span class="ad-av">${avatarSVG(u.avatar)}</span><b>${esc(u.name)}</b><small>${u.playing ? `<span class="on-play" data-sess="${u.sess}">&#9654; ${esc(gname(u.playing))} <em>${dur(u.sess)}</em></span>` : esc(where(u.path))}</small><small class="on-since">${since(u.since)}</small></li>`).join('')}</ul>` : '<p class="ad-muted">Er is nu niemand ingelogd.</p>'}
            ${o.guestsPlaying ? `<p class="ad-muted" style="margin-top:10px">En ${fmt(o.guestsPlaying)} ${o.guestsPlaying === 1 ? 'gast speelt' : 'gasten spelen'} nu.</p>` : ''}
          </section>`;
      } catch (e) {
        box.innerHTML = `<div class="ad-note">${esc(configured ? e.message : 'Alleen op de echte site te zien: hier in demo-modus is er geen server die bijhoudt wie er online is.')}</div>`;
      }
    };
    main.querySelector('#onRefresh').onclick = paint;
    await paint();
    clearInterval(onlineTab.timer); clearInterval(onlineTab.tick);
    onlineTab.timer = setInterval(paint, 10000);
    // de timers lopen elke seconde door, ook tussen twee verversingen in
    onlineTab.tick = setInterval(() => {
      if (!main.querySelector('#onlinePage')) { clearInterval(onlineTab.tick); return; }
      const add = (Date.now() - (onlineTab.fetchedAt || Date.now())) / 1000;
      main.querySelectorAll('.on-play').forEach((n) => { const e = n.querySelector('em'); if (e) e.textContent = dur(+n.dataset.sess + add); });
    }, 1000);
  }

  // speeltijd per dag, voor iedereen of voor één speler, een hele maand lang
  async function timeTab() {
    const dur = (s) => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} u ${String(m % 60).padStart(2, '0')} min`; };
    const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    const nowM = new Date();
    let ym = [nowM.getFullYear(), nowM.getMonth() + 1];
    let who = '';
    let data = null;
    const key = () => `${ym[0]}-${String(ym[1]).padStart(2, '0')}`;
    const chart = (vals, color) => {
      const mob = window.innerWidth < 640;
      const n = vals.length, Wd = mob ? 360 : 760, Ht = mob ? 190 : 220, pad = mob ? 30 : 34, bw = (Wd - pad) / n;
      const max = Math.max(60, ...vals.map((v) => v.sec));
      const top = Math.max(1, Math.ceil(max / 3600)); // hele uren op de as
      const scale = Math.max(max, top * 3600);
      const y = (s) => Ht - 24 - (s / scale) * (Ht - 44);
      const ticks = Array.from({ length: Math.min(top, 5) + 1 }, (_, i) => Math.round((top / Math.min(top, 5)) * i));
      return `<svg class="ad-line" viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="Speeltijd per dag">
        ${[...new Set(ticks)].map((h) => `<line x1="${pad}" x2="${Wd}" y1="${y(h * 3600)}" y2="${y(h * 3600)}" stroke="#e8ecf3"/><text x="${pad - 6}" y="${y(h * 3600) + 4}" text-anchor="end" class="lt">${h} u</text>`).join('')}
        ${vals.map((v, i) => { const h = Math.max(0, Ht - 24 - y(v.sec)); const x = pad + i * bw + bw * 0.14; return `<g><rect x="${x.toFixed(1)}" y="${y(v.sec).toFixed(1)}" width="${(bw * 0.72).toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${color}" opacity="${v.sec ? 1 : 0}"><title>${v.label}: ${dur(v.sec)}</title></rect><rect x="${(pad + i * bw).toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${Ht - 24}" fill="transparent"><title>${v.label}: ${dur(v.sec)}</title></rect><text x="${(pad + i * bw + bw / 2).toFixed(1)}" y="${Ht - 6}" text-anchor="middle" class="lt">${mob ? ((i + 1) % 5 === 0 || i === 0 ? v.n : '') : (i % 2 === 0 || n < 20 ? v.n : '')}</text></g>`; }).join('')}
      </svg>`;
    };
    const paint = () => {
      const days = data.days;
      const dim = new Date(ym[0], ym[1], 0).getDate();
      const byDay = Object.fromEntries(days.map((x) => [x.day, x]));
      const names = {};
      const gamesT = {};
      let total = 0;
      for (const x of days) { total += x.total; for (const [k, v] of Object.entries(x.users)) names[k] = (names[k] || 0) + v; for (const [k, v] of Object.entries(x.games)) gamesT[k] = (gamesT[k] || 0) + v; }
      const ranked = Object.entries(names).sort((a, b) => b[1] - a[1]);
      if (who && !names[who]) who = '';
      const vals = Array.from({ length: dim }, (_, i) => {
        const day = `${key()}-${String(i + 1).padStart(2, '0')}`;
        const x = byDay[day];
        return { n: i + 1, label: `${i + 1} ${MONTHS[ym[1] - 1]}`, sec: x ? (who ? x.users[who] || 0 : x.total) : 0 };
      });
      const sel = vals.reduce((a, v) => a + v.sec, 0);
      const best = vals.reduce((a, v) => (v.sec > a.sec ? v : a), { sec: 0 });
      const activeDays = vals.filter((v) => v.sec > 0).length;
      const gname = (id) => { const g = (app.state.games || []).find((x) => x.id === id); return g ? g.title : id; };
      box.innerHTML = `<div class="ad-kpis">
          <div class="ad-kpi k1"><i>⏱️</i><small>${who ? esc(who) : 'Iedereen'}, totaal</small><b>${dur(sel)}</b><span>in ${MONTHS[ym[1] - 1]}</span></div>
          <div class="ad-kpi k3"><i>📅</i><small>Drukste dag</small><b>${best.sec ? best.n + ' ' + MONTHS[ym[1] - 1].slice(0, 3) : '-'}</b><span>${best.sec ? dur(best.sec) : 'nog niets gespeeld'}</span></div>
          <div class="ad-kpi k2"><i>📈</i><small>Gemiddeld per speeldag</small><b>${activeDays ? dur(sel / activeDays) : '-'}</b><span>${activeDays} dagen gespeeld</span></div>
          <div class="ad-kpi k4"><i>👥</i><small>Spelers</small><b>${ranked.length}</b><span>deze maand</span></div>
        </div>
        <section class="ad-card"><div class="tm-top"><h3>Speeltijd per dag</h3><label class="tm-sel">Wie: <select id="tmWho"><option value="">Iedereen</option>${ranked.map(([n]) => `<option value="${esc(n)}" ${n === who ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label></div>${chart(vals, who ? '#8b5cf6' : '#2563eb')}</section>
        <div class="ad-grid">
          <section class="ad-card"><h3>Per speler</h3><p class="ad-muted">Klik op een naam om alleen die speler te zien.</p>${ranked.length ? `<div class="ad-bars tm-people">${(() => { const mx = Math.max(1, ranked[0][1]); return ranked.slice(0, 15).map(([n, s]) => `<button class="ad-bar tm-bar ${n === who ? 'on' : ''}" data-who="${esc(n)}"><span title="${esc(n)}">${esc(n)}</span><div><i style="width:${(s / mx) * 100}%;background:linear-gradient(90deg,#8b5cf6,#6366f1)"></i></div><b>${dur(s)}</b></button>`).join(''); })()}</div>` : '<p class="ad-muted">Nog geen speeltijd gemeten.</p>'}</section>
          <section class="ad-card"><h3>Per game</h3>${Object.keys(gamesT).length ? bars(Object.entries(gamesT).sort((a, b) => b[1] - a[1]).map(([g, s]) => ({ label: gname(g), value: Math.round(s / 60) }))) + '<p class="ad-muted">in minuten</p>' : '<p class="ad-muted">Nog geen speeltijd gemeten.</p>'}</section>
        </div>`;
      box.querySelector('#tmWho').onchange = (e) => { who = e.target.value; paint(); };
      box.querySelectorAll('.tm-bar').forEach((b) => { b.onclick = () => { who = b.dataset.who === who ? '' : b.dataset.who; paint(); }; });
    };
    main.innerHTML = `${head('Speeltijd', 'Hoeveel uur er is gespeeld: per dag, door iedereen of door één speler. Gemeten vanaf het moment dat dit live ging.', `<div class="tm-nav"><button class="ad-btn" id="tmPrev" aria-label="Vorige maand">&lsaquo;</button><b id="tmMonth"></b><button class="ad-btn" id="tmNext" aria-label="Volgende maand">&rsaquo;</button></div>`)}${demo}<div id="timePage"><div class="ad-load">Laden...</div></div>`;
    const box = main.querySelector('#timePage');
    const load = async () => {
      main.querySelector('#tmMonth').textContent = `${MONTHS[ym[1] - 1]} ${ym[0]}`;
      main.querySelector('#tmNext').disabled = ym[0] === nowM.getFullYear() && ym[1] === nowM.getMonth() + 1;
      box.innerHTML = '<div class="ad-load">Laden...</div>';
      try {
        const token = await api.getAccessToken();
        const r = await fetch('/api/playtime?month=' + key(), { cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (r.status === 403) throw new Error('Geen toegang: alleen beheerders met het recht "gebruikers bekijken" zien dit.');
        if (!r.ok) throw new Error('Geen verbinding met de server.');
        data = await r.json();
        if (!Array.isArray(data.days)) throw new Error('De server (Worker) is nog niet bijgewerkt. Zodra de nieuwste versie live staat, werkt deze pagina.');
        paint();
      } catch (e) {
        box.innerHTML = `<div class="ad-note">${esc(configured ? e.message : 'Alleen op de echte site te zien: hier in demo-modus is er geen server die de speeltijd bijhoudt.')}</div>`;
      }
    };
    main.querySelector('#tmPrev').onclick = () => { ym = ym[1] === 1 ? [ym[0] - 1, 12] : [ym[0], ym[1] - 1]; who = ''; load(); };
    main.querySelector('#tmNext').onclick = () => { ym = ym[1] === 12 ? [ym[0] + 1, 1] : [ym[0], ym[1] + 1]; who = ''; load(); };
    await load();
  }

  async function gamesTab() {
    const games = await api.adminListGames();
    main.innerHTML = `${head('Games', 'Beheer alle games op het platform.', '<button class="ad-btn primary" id="gNew">Nieuwe game</button>')}${demo}
      <section class="ad-card flush"><div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Game</th><th>Genre</th><th>Gespeeld</th><th>Likes</th><th>Status</th><th></th></tr></thead>
      <tbody>${games.map((g, n) => `<tr><td><div class="ad-cell">${gameTile(g, n)}<div><b>${esc(g.title)}</b><small>/g/${esc(g.id)}</small></div></div></td>
        <td>${esc(genreName(g.category))}</td><td>${fmt(g.plays)}</td><td>${fmt(g.likes)}</td>
        <td><span class="ad-tag ${g.published ? 'ok' : ''}">${g.published ? 'Gepubliceerd' : 'Verborgen'}</span>${g.featured ? '<span class="ad-tag blue">Uitgelicht</span>' : ''}${g.coming_soon && g.release_at && new Date(g.release_at) > new Date() ? `<span class="ad-tag warn">Binnenkort: ${esc(new Date(g.release_at).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</span>` : ''}</td>
        <td class="ad-actions"><button class="ad-btn sm" data-edit="${esc(g.id)}">Bewerken</button><button class="ad-btn sm" data-toggle="${esc(g.id)}">${g.published ? 'Verbergen' : 'Publiceren'}</button><button class="ad-btn sm danger" data-del="${esc(g.id)}">Verwijderen</button></td></tr>`).join('') || '<tr><td colspan="6" class="ad-muted">Nog geen games.</td></tr>'}</tbody></table></div></section>`;

    const edit = (g) => {
      const isNew = !g;
      const x = g || { id: '', title: '', category: 'actie', tagline: '', description: '', url: '', thumb: '', hero: '', controls: [], published: true, featured: false };
      const m = modal(`<form class="ad-form"><h2>${isNew ? 'Nieuwe game' : 'Game bewerken'}</h2>
        <div class="ad-two"><label>Naam<input name="title" required value="${esc(x.title)}"></label>
        <label>Id (in de link)<input name="id" required pattern="[a-z0-9\\-]+" value="${esc(x.id)}" ${isNew ? '' : 'readonly'}></label></div>
        <label>Genre<select name="category">${GENRES.map((c) => `<option value="${c.toLowerCase()}" ${c.toLowerCase() === x.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <label>Korte tekst<input name="tagline" value="${esc(x.tagline)}"></label>
        <label>Beschrijving<textarea name="description" rows="3">${esc(x.description)}</textarea></label>
        <label>Adres van de game<input name="url" required value="${esc(x.url)}" placeholder="/games/mijn-game/"></label>
        <label>Titel-logo (url, optioneel; vervangt de tekst als titel)<input name="logo" value="${esc(x.logo || '')}" placeholder="/assets/mijn-game-logo.png"></label>
        <div class="ad-two"><label>Plaatje (url)<input name="thumb" value="${esc(x.thumb)}"></label><label>Groot plaatje (url)<input name="hero" value="${esc(x.hero || '')}"></label></div>
        <label>Besturing (per regel: toets | uitleg)<textarea name="controls" rows="3">${esc((x.controls || []).map((c) => c.join(' | ')).join('\n'))}</textarea></label>
        <div class="ad-checks"><label><input type="checkbox" name="published" ${x.published ? 'checked' : ''}> Gepubliceerd</label><label><input type="checkbox" name="featured" ${x.featured ? 'checked' : ''}> Uitgelicht op home</label><label><input type="checkbox" name="coming_soon" id="csCheck" ${x.coming_soon ? 'checked' : ''}> Binnenkort beschikbaar</label></div>
        <div class="ad-soon" id="csBox" ${x.coming_soon ? '' : 'hidden'}><label>Verschijnt op (datum en tijd)<input type="datetime-local" name="release_at" value="${esc(toLocalInput(x.release_at))}"></label><p class="ad-muted">Tot dat moment zien spelers een aftelklok in plaats van de speelknop. Als je ook "Uitgelicht" aanvinkt, komt er een grote aftelklok op home. Beheerders kunnen de game al wel spelen en testen.</p></div>
        <div class="ad-err" id="gErr"></div><div class="ad-foot"><button class="ad-btn primary" type="submit">Opslaan</button></div></form>`, { cls: 'ad-modal' });
      m.body.querySelector('#csCheck').addEventListener('change', (ev) => { m.body.querySelector('#csBox').hidden = !ev.target.checked; });
      m.body.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const soon = !!fd.get('coming_soon');
        const rel = fd.get('release_at');
        if (soon && !rel) { m.body.querySelector('#gErr').textContent = 'Kies een datum en tijd waarop de game uitkomt.'; return; }
        const game = {
          id: fd.get('id').trim(), title: fd.get('title').trim(), category: fd.get('category'), tags: x.tags || [],
          tagline: fd.get('tagline').trim(), description: fd.get('description').trim(), url: fd.get('url').trim(), logo: fd.get('logo').trim(), thumb: fd.get('thumb').trim(), hero: fd.get('hero').trim(),
          controls: fd.get('controls').split('\n').map((l) => l.split('|').map((s) => s.trim())).filter((p) => p[0]).map((p) => [p[0], p[1] || '']),
          published: !!fd.get('published'), featured: !!fd.get('featured'), coming_soon: soon, release_at: soon ? new Date(rel).toISOString() : null, created_at: x.created_at,
        };
        try { await api.adminSaveGame(game); m.close(); await app.reloadGames(); toast('Game opgeslagen'); show(); } catch (err) { m.body.querySelector('#gErr').textContent = err.message; }
      });
    };
    main.querySelector('#gNew').onclick = () => edit(null);
    main.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]');
      const tg = e.target.closest('[data-toggle]');
      const dl = e.target.closest('[data-del]');
      try {
        if (ed) edit(games.find((g) => g.id === ed.dataset.edit));
        else if (tg) { const g = games.find((x) => x.id === tg.dataset.toggle); await api.adminSaveGame({ ...g, published: !g.published }); await app.reloadGames(); show(); }
        else if (dl) {
          const g = games.find((x) => x.id === dl.dataset.del);
          if (confirm(`"${g.title}" definitief verwijderen? Likes en cijfers van deze game verdwijnen.`)) { await api.adminDeleteGame(g.id); await app.reloadGames(); show(); }
        }
      } catch (err) { toast(err.message); }
    };
  }

  async function usersTab() {
    const users = await api.adminUsers();
    const canManage = has(me, 'manage_users');
    const role = (u) => (u.is_owner ? '<span class="ad-tag blue">Eigenaar</span>' : u.is_admin ? '<span class="ad-tag blue">Beheerder</span>' : '<span class="ad-tag">Speler</span>');
    main.innerHTML = `${head('Gebruikers', `${fmt(users.length)} aangemelde spelers.`, '<input class="ad-search" id="uSearch" placeholder="Zoek op naam of e-mail">')}${demo}
      <section class="ad-card flush"><div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Speler</th><th>E-mail</th><th>Rol</th><th>Aangemeld</th><th>Laatst gezien</th><th>Gespeeld</th><th></th></tr></thead><tbody id="uBody"></tbody></table></div></section>`;
    const body = main.querySelector('#uBody');
    const paint = (q = '') => {
      const t = q.toLowerCase();
      const rows = [...users].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).filter((u) => !t || (u.username || '').toLowerCase().includes(t) || (u.email || '').toLowerCase().includes(t));
      body.innerHTML = rows.map((u) => {
        const blocked = u.permissions && Object.values(u.permissions).some((v) => v === false) && !u.is_admin;
        return `<tr><td><div class="ad-cell"><span class="ad-av">${avatarSVG(u.avatar)}</span><b>${esc(u.username)}</b></div></td><td>${esc(u.email)}</td>
        <td>${role(u)}${blocked ? '<span class="ad-tag warn">Beperkt</span>' : ''}</td><td>${ago(u.created_at)}</td><td>${ago(u.last_seen)}</td><td>${fmt(u.plays)}</td>
        <td class="ad-actions">${canManage && !u.is_owner && u.id !== me.id ? `<button class="ad-btn sm" data-user="${esc(u.id)}">Rechten</button>` : ''}</td></tr>`;
      }).join('') || '<tr><td colspan="7" class="ad-muted">Geen spelers gevonden.</td></tr>';
    };
    paint();
    main.querySelector('#uSearch').addEventListener('input', (e) => paint(e.target.value));
    body.onclick = (e) => {
      const b = e.target.closest('[data-user]');
      if (!b) return;
      const u = users.find((x) => x.id === b.dataset.user);
      const perms = { ...(u.permissions || {}) };
      const row = (list, scope) => list.map(([k, name, desc]) => {
        const on = scope === 'staff' ? perms[k] === true : perms[k] !== false;
        return `<label class="ad-perm"><input type="checkbox" data-perm="${k}" ${on ? 'checked' : ''}><span><b>${esc(name)}</b><small>${esc(desc)}</small></span></label>`;
      }).join('');
      const m = modal(`<form class="ad-form"><h2>Rechten van ${esc(u.username)}</h2><p class="ad-muted">${esc(u.email)}</p>
        <div class="ad-section"><h4>Rol</h4><label class="ad-perm"><input type="checkbox" id="isAdmin" ${u.is_admin ? 'checked' : ''}><span><b>Beheerder</b><small>Toegang tot dit dashboard, met de rechten hieronder.</small></span></label></div>
        <div class="ad-section" id="staffBox" ${u.is_admin ? '' : 'hidden'}><h4>Rechten als beheerder</h4>${row(STAFF_PERMS, 'staff')}</div>
        <div class="ad-section"><h4>Wat deze speler mag doen op het platform</h4>${row(USER_PERMS, 'user')}</div>
        <div class="ad-err" id="uErr"></div><div class="ad-foot"><button class="ad-btn" type="button" id="uCancel">Annuleren</button><button class="ad-btn primary" type="submit">Opslaan</button></div></form>`, { cls: 'ad-modal' });
      const form = m.body.querySelector('form');
      form.querySelector('#isAdmin').addEventListener('change', (ev) => { form.querySelector('#staffBox').hidden = !ev.target.checked; });
      form.querySelector('#uCancel').onclick = () => m.close();
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const out = {};
        form.querySelectorAll('[data-perm]').forEach((c) => { out[c.dataset.perm] = c.checked; });
        const isAdmin = form.querySelector('#isAdmin').checked;
        if (!isAdmin) STAFF_PERMS.forEach(([k]) => { out[k] = false; });
        try { await api.adminSetUser(u.id, { is_admin: isAdmin, permissions: out }); m.close(); toast('Rechten opgeslagen'); show(); }
        catch (err) { m.body.querySelector('#uErr').textContent = err.message; }
      });
    };
  }

  async function show() {
    main.innerHTML = '<div class="ad-load">Laden...</div>';
    page.querySelectorAll('.ad-side nav a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
    try {
      if (tab === 'overview') await overview();
      else if (tab === 'games') await gamesTab();
      else if (tab === 'online') await onlineTab();
      else if (tab === 'time') await timeTab();
      else await usersTab();
    } catch (e) {
      main.innerHTML = `<div class="ad-denied"><div><h1>Kon dit niet laden</h1><p>${esc(e.message)}</p></div></div>`;
    }
  }
  page.querySelector('.ad-side nav').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-tab]');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    tab = a.dataset.tab;
    history.replaceState(null, '', `/admin?tab=${tab}`);
    show();
  });
  show();
  return f;
}
