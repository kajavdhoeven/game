// Cloudflare Worker: serveert de statische site en een kleine online ranglijst.
// De ranglijst staat in een Durable Object (SQLite-backed, wordt automatisch aangemaakt bij deploy).

const MAX_DIST = 500000;
const MAX_COINS = 2000000;
const KEEP = 1500;
const TIME_GAMES = new Set(['te-un-puzzel', 'te-un-x3m', 'te-un-drive', 'vuur-water']);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function cleanName(n) {
  return String(n || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 14) || 'Naamloos';
}

export class Leaderboard {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.last = new Map();
    this.online = new Map(); // wie er nu op de site is: bezoeker-id -> { t, auth }
  }

  // controleert met het Supabase-token of de aanvrager beheerder is met het recht "gebruikers bekijken" (en onthoudt dat even)
  async mayViewUsers(request) {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const env = this.env;
    if (!token || token.length > 4000 || !env || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;
    this.okTokens = this.okTokens || new Map();
    const c = this.okTokens.get(token);
    if (c && Date.now() - c.t < 60000) return c.ok;
    let ok = false;
    try {
      const h = { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
      const u = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: h });
      if (u.ok) {
        const { id } = await u.json();
        const p = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?select=is_admin,is_owner,permissions&id=eq.${encodeURIComponent(id)}`, { headers: h });
        const r = p.ok ? (await p.json())[0] : null;
        ok = !!r && (r.is_owner === true || (r.is_admin === true && !!r.permissions && r.permissions.view_users === true));
      }
    } catch (e) { ok = false; }
    if (this.okTokens.size > 50) this.okTokens.clear();
    this.okTokens.set(token, { ok, t: Date.now() });
    return ok;
  }

  async load() {
    return (await this.state.storage.get('entries')) || {};
  }

  async fetch(request) {
    const url = new URL(request.url);
    // ---- wie is er nu op de site? Elke open pagina stuurt elke halve minuut een levensteken; na 75 seconden stilte tellen we hem niet meer mee.
    if (url.pathname === '/api/ping' && request.method === 'POST') {
      let b;
      try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
      const cid = String(b.cid || '').slice(0, 40);
      if (!/^[\w-]{8,40}$/.test(cid)) return json({ error: 'bad id' }, 400);
      if (b.bye) this.online.delete(cid);
      else if (this.online.size < 5000 || this.online.has(cid)) {
        const prev = this.online.get(cid);
        const auth = !!b.auth;
        this.online.set(cid, {
          t: Date.now(), auth, since: prev && prev.auth === auth ? prev.since : Date.now(),
          name: auth ? cleanName(b.name) : '', avatar: auth ? String(b.avatar || '').replace(/[^\w-]/g, '').slice(0, 20) : '',
          path: String(b.path || '/').replace(/[^\w\-/]/g, '').slice(0, 60),
        });
      }
      return json({ ok: true });
    }
    if (url.pathname === '/api/online' && request.method === 'GET') {
      const now = Date.now();
      let users = 0, guests = 0;
      for (const [k, v] of this.online) { if (now - v.t > 75000) this.online.delete(k); else if (v.auth) users++; else guests++; }
      return json({ total: users + guests, users, guests, at: now });
    }
    // de namen van wie er is ingelogd zijn alleen voor beheerders met het recht "gebruikers bekijken"
    if (url.pathname === '/api/online/users' && request.method === 'GET') {
      if (!(await this.mayViewUsers(request))) return json({ error: 'geen toegang' }, 403);
      const now = Date.now();
      const users = [];
      for (const [k, v] of this.online) {
        if (now - v.t > 75000) { this.online.delete(k); continue; }
        if (v.auth) users.push({ name: v.name || 'Naamloos', avatar: v.avatar || 'teun', path: v.path || '/', since: v.since || v.t, seen: v.t });
      }
      users.sort((a, b) => a.since - b.since);
      const guests = [...this.online.values()].filter((v) => !v.auth).length;
      return json({ users, guests, total: users.length + guests, at: now });
    }
    // ---- tijden-ranglijsten voor de levelgames (puzzel, X3M, Drive): per game en level de snelste tijd per speler
    if (url.pathname === '/api/times' && request.method === 'GET') {
      const game = (url.searchParams.get('game') || '').slice(0, 30);
      const level = (url.searchParams.get('level') || '').slice(0, 16);
      if (!TIME_GAMES.has(game) || !level) return json({ error: 'bad request' }, 400);
      const entries = Object.values((await this.state.storage.get(`t:${game}:${level}`)) || {});
      entries.sort((a, b) => a.time - b.time);
      return json({ times: entries.slice(0, 25).map((e) => ({ uid: e.uid.slice(0, 8), name: e.name, time: e.time })) });
    }
    if (url.pathname === '/api/time' && request.method === 'POST') {
      let b;
      try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
      const game = String(b.game || '').slice(0, 30), level = String(b.level || '').slice(0, 16);
      const uid = String(b.uid || '').slice(0, 64);
      const time = Math.round(+b.time * 100) / 100;
      if (!TIME_GAMES.has(game) || !level || !uid || !Number.isFinite(time)) return json({ error: 'bad data' }, 400);
      if (time < 1.5 || time > 7200) return json({ error: 'unrealistic' }, 400);
      const now = Date.now();
      const rl = `${uid}:${game}:${level}`;
      if (now - (this.last.get(rl) || 0) < 1500) return json({ error: 'slow down' }, 429);
      this.last.set(rl, now);
      const key = `t:${game}:${level}`;
      const entries = (await this.state.storage.get(key)) || {};
      const cur = entries[uid];
      if (!cur || time < cur.time) entries[uid] = { uid, name: cleanName(b.name), time, t: now };
      else cur.name = cleanName(b.name);
      const all = Object.values(entries);
      if (all.length > 400) { all.sort((x, y) => x.time - y.time); const keep = {}; all.slice(0, 300).forEach((x) => { keep[x.uid] = x; }); await this.state.storage.put(key, keep); }
      else await this.state.storage.put(key, entries);
      return json({ ok: true });
    }
    if (request.method === 'GET') {
      const entries = Object.values(await this.load());
      const top = (key) => entries
        .filter((e) => (e[key] || 0) > 0)
        .sort((a, b) => b[key] - a[key])
        .slice(0, 25)
        .map((e) => ({ pid: e.pid.slice(0, 8), name: e.name, distance: e.distance, coins: e.coins, score: e.score || 0, runDist: e.sd || 0, runCoins: e.sc || 0 }));
      return json({ score: top('score'), distance: top('distance'), coins: top('coins') });
    }
    if (request.method === 'POST' && url.pathname.endsWith('/score')) {
      let b;
      try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
      const pid = String(b.pid || '').slice(0, 64);
      const distance = Math.floor(+b.distance);
      const coins = Math.floor(+b.coins);
      if (!pid || !Number.isFinite(distance) || !Number.isFinite(coins)) return json({ error: 'bad data' }, 400);
      if (distance < 0 || coins < 0 || distance > MAX_DIST || coins > MAX_COINS) return json({ error: 'unrealistic' }, 400);
      const now = Date.now();
      if (now - (this.last.get(pid) || 0) < 2500) return json({ error: 'slow down' }, 429);
      this.last.set(pid, now);
      const entries = await this.load();
      const e = entries[pid] || { pid, name: '', distance: 0, coins: 0, t: 0 };
      e.name = cleanName(b.name);
      e.distance = Math.max(e.distance, distance);
      e.coins = Math.max(e.coins, coins);
      // de score is precies die van de game: afstand + 10 per munt. We bewaren de beste run als geheel.
      const score = distance + coins * 10;
      if (score > (e.score || 0)) { e.score = score; e.sd = distance; e.sc = coins; }
      e.t = now;
      entries[pid] = e;
      const all = Object.values(entries);
      if (all.length > KEEP) {
        all.sort((a, b2) => (b2.score || 0) - (a.score || 0));
        const keep = {};
        all.slice(0, KEEP).forEach((x) => { keep[x.pid] = x; });
        await this.state.storage.put('entries', keep);
      } else {
        await this.state.storage.put('entries', entries);
      }
      return json({ ok: true });
    }
    return json({ error: 'not found' }, 404);
  }
}

// ------------------------------------------------------------------ SEO
// Google ziet per pagina meteen de juiste titel, beschrijving en gegevens, ook voor games die later
// via het dashboard zijn toegevoegd. De gegevens komen uit Supabase (publieke, leesbare games).

const FALLBACK_GAMES = [{
  id: 'te-un-surfers', title: 'Te-Un Surfers', category: 'actie',
  tagline: 'Ren over het spoor, spring op treinen en spuit treinspotters nat.',
  description: 'Help Te-Un de kabouter ontsnappen aan de boze kabouters. Ren over drie sporen, ontwijk rijdende NS-treinen, spring via schansen op de daken en pak power-ups.',
  logo: '/assets/te-un-surfers-logo.png', hero: '/assets/te-un-surfers-hero.jpg', thumb: '/assets/te-un-surfers.jpg', created_at: '2025-01-01T00:00:00Z', controls: [],
}, {
  id: 'te-un-puzzel', title: 'Te-Un Puzzel', category: 'puzzel',
  tagline: 'Vier legpuzzels en vier schuifpuzzels met Te-Un.',
  description: 'Sleep de door elkaar liggende stukjes naar de juiste plek en maak de afbeelding af. Vier levels, van rustig tot serieus moeilijk, elk met een tijdslimiet.',
  logo: '/assets/te-un-puzzel-logo.png', hero: '/assets/te-un-puzzel-hero.jpg', thumb: '/assets/te-un-puzzel.jpg', created_at: '2025-06-01T00:00:00Z', controls: [],
}, {
  id: 'te-un-x3m', title: 'Te-Un X3M', category: 'racen',
  tagline: 'Spring en stunt met een fatbike, motor of gouden vape door 25 levels.',
  description: 'Rijd door gevaarlijke levels vol lava, spijkers, zagen en vuur. Upgrade van fatbike naar motor en naar de gouden vape waarmee je vliegt, en speel nieuwe personages vrij.',
  logo: '/assets/te-un-x3m-logo.png', hero: '/assets/te-un-x3m-hero.jpg', thumb: '/assets/te-un-x3m.jpg', created_at: '2025-07-01T00:00:00Z', controls: [],
}, {
  id: 'te-un-drive', title: 'Te-Un Drive', category: 'racen',
  tagline: 'Rijd je blokkenauto door 25 levels vol bruggen, gaten en spijkers.',
  description: 'Rijd je blokkenauto over heuvels, trappen, houten bruggen en gaten vol water naar de finish. Pas op voor spijkers! Je begint met Hermano\'s fiets en speelt nieuwe auto\'s vrij: de gele monstertruck na level 5, de gouden monstertruck na level 15 en de tuinkabouterauto na level 20. Let op de veerboten en de knoppen die bruggen laten uitschuiven.',
  logo: '/assets/te-un-drive-logo.png', hero: '/assets/te-un-drive-hero.jpg', thumb: '/assets/te-un-drive.jpg', created_at: '2025-08-01T00:00:00Z', controls: [],
}, {
  id: 'vuur-water', title: 'VuurTe-Un & WaterTe-Un', category: 'puzzel',
  tagline: 'Twee kabouters, twee deuren: kom samen veilig door 32 tempellevels.',
  description: 'Bestuur twee kabouters tegelijk: VuurTe-Un en WaterTe-Un. Breng allebei veilig naar hun eigen deur, zonder dat de één in water en de ander in lava valt. Verzamel rode en blauwe stenen, druk op knoppen en trek aan hendels om poorten te openen. 32 levels in een mossige tempel. Alleen? Speel met één kabouter en wissel met de spatiebalk.',
  logo: '/assets/vuur-water-logo.png', hero: '/assets/vuur-water-hero.jpg', thumb: '/assets/vuur-water.jpg', created_at: '2025-09-01T00:00:00Z', controls: [],
}, {
  id: 'te-un-tikkertje', title: 'Te-Un Tikkertje', category: 'actie',
  tagline: 'Ren, spring en tik: wie de tikker is na een minuut, gaat eruit.',
  description: 'Speel tikkertje met drie andere kabouters op zwevende platforms in een bos, de woestijn of de sneeuw. Ben je de tikker? Dan moet je iemand tikken voordat de minuut om is, anders ga jij eruit. Kies tussen normaal en hardcore, verdien munten als je wint en koop nieuwe Te-Uns met speciale krachten: de tyfus snelle Te-Un, de schaduw Te-Un en de tovenaar Te-Un.',
  logo: '/assets/te-un-tikkertje-logo.png', hero: '/assets/te-un-tikkertje-hero.jpg', thumb: '/assets/te-un-tikkertje.jpg', created_at: '2025-09-15T00:00:00Z', controls: [],
}];

const GENRE = (id) => { const t = String(id || 'game'); return t[0].toUpperCase() + t.slice(1); };

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function loadGames(env) {
  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return FALLBACK_GAMES;
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/games?select=*&published=eq.true&order=created_at.asc`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!r.ok) return FALLBACK_GAMES;
    const rows = await r.json();
    return rows.length ? rows : FALLBACK_GAMES;
  } catch (e) {
    return FALLBACK_GAMES;
  }
}

function pageMeta(path, games, site) {
  const base = {
    title: 'Te-Un Games - gratis online games met Te-Un de kabouter',
    description: 'Speel gratis online games op Te-Un Games. Ren, spring en vlieg samen met Te-Un de kabouter in Te-Un Surfers. Zonder download, op je computer of telefoon.',
    image: '/assets/header.jpg', path: '/', body: '', ld: null, robots: 'index, follow, max-image-preview:large', status: 200,
  };
  const home = () => ({
    ...base,
    body: `<h1>Te-Un Games: gratis online games met Te-Un de kabouter</h1><p>${esc(base.description)}</p><h2>Games</h2><ul>${games.map((g) => `<li><a href="/g/${esc(g.id)}">${esc(g.title)}</a>: ${esc(g.tagline || '')}</li>`).join('')}</ul>`,
  });
  if (path === '/') return home();

  let m = path.match(/^\/g\/([a-z0-9-]+)\/?$/);
  if (m) {
    const g = games.find((x) => x.id === m[1]);
    if (!g) return { ...base, title: 'Game niet gevonden | Te-Un Games', path, robots: 'noindex, follow', status: 404, body: '<h1>Game niet gevonden</h1><p><a href="/">Naar de startpagina</a></p>' };
    const desc = `${g.tagline ? g.tagline + ' ' : ''}${(g.description || '').slice(0, 130)}`.trim();
    const cat = [GENRE(g.category), ''];
    const url = `${site}/g/${g.id}`;
    return {
      ...base, title: `${g.title} - gratis online spelen | Te-Un Games`, description: desc, image: g.hero || g.thumb || base.image, path: `/g/${g.id}`,
      body: `<nav><a href="/">Home</a> &rsaquo; <a href="/games">Games</a> &rsaquo; ${esc(g.title)}</nav><h1>${esc(g.title)} gratis online spelen</h1><p>${esc(g.tagline || '')}</p><p>${esc(g.description || '')}</p>${(g.controls || []).length ? `<h2>Besturing</h2><ul>${g.controls.map((c) => `<li>${esc(c[0])}: ${esc(c[1])}</li>`).join('')}</ul>` : ''}<p><a href="/games">Alle games</a></p>`,
      ld: {
        '@context': 'https://schema.org', '@type': 'VideoGame', name: g.title, url, description: desc, inLanguage: 'nl-NL',
        genre: cat[0], gamePlatform: 'Webbrowser', applicationCategory: 'Game', operatingSystem: 'Alle apparaten met een browser',
        image: (g.hero || g.thumb || '').startsWith('http') ? g.hero || g.thumb : site + (g.hero || g.thumb || base.image),
        isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        publisher: { '@type': 'Organization', name: 'Te-Un Games', url: site },
        datePublished: (g.created_at || '').slice(0, 10) || undefined,
      },
    };
  }
  const pages = {
    '/games': ['Alle games', 'Alle gratis online games van Te-Un Games op een rij.'],
  };
  const clean = path.replace(/\/$/, '');
  if (pages[clean]) {
    return { ...base, title: `${pages[clean][0]} | Te-Un Games`, description: pages[clean][1], path: clean, body: `<h1>${pages[clean][0]}</h1><p>${pages[clean][1]}</p><ul>${games.map((g) => `<li><a href="/g/${esc(g.id)}">${esc(g.title)}</a></li>`).join('')}</ul>` };
  }
  return { ...base, robots: 'noindex, follow', path };
}

async function servePage(request, env, url) {
  const site = env.SITE_URL || url.origin;
  const games = await loadGames(env);
  const meta = pageMeta(url.pathname, games, site);
  const shell = await env.ASSETS.fetch(new Request(new URL('/index.html', url.origin), { headers: { Accept: 'text/html' } }));
  const abs = (p) => (p.startsWith('http') ? p : site + p);
  const title = esc(meta.title);
  const desc = esc(meta.description);
  const rw = new HTMLRewriter()
    .on('title', { element: (e) => e.setInnerContent(meta.title) })
    .on('meta[name="description"]', { element: (e) => e.setAttribute('content', meta.description) })
    .on('meta[name="robots"]', { element: (e) => e.setAttribute('content', meta.robots) })
    .on('link[rel="canonical"]', { element: (e) => e.setAttribute('href', site + (meta.path === '/' ? '/' : meta.path)) })
    .on('meta[property="og:title"]', { element: (e) => e.setAttribute('content', meta.title) })
    .on('meta[property="og:description"]', { element: (e) => e.setAttribute('content', meta.description) })
    .on('meta[property="og:url"]', { element: (e) => e.setAttribute('content', site + meta.path) })
    .on('meta[property="og:image"]', { element: (e) => e.setAttribute('content', abs(meta.image)) })
    .on('meta[name="twitter:title"]', { element: (e) => e.setAttribute('content', meta.title) })
    .on('meta[name="twitter:description"]', { element: (e) => e.setAttribute('content', meta.description) })
    .on('meta[name="twitter:image"]', { element: (e) => e.setAttribute('content', abs(meta.image)) })
    .on('head', { element: (e) => { if (meta.ld) e.append(`<script type="application/ld+json">${JSON.stringify(meta.ld).replace(/</g, '\\u003c')}</script>`, { html: true }); } })
    // leesbare inhoud voor zoekmachines; de app vervangt dit zodra hij laadt
    .on('div#app', { element: (e) => e.setInnerContent(`<main class="seo-static" style="padding:24px;max-width:900px;margin:auto;color:#fff;font-family:sans-serif">${meta.body}</main>`, { html: true }) });
  void title; void desc;
  const res = rw.transform(shell);
  const headers = new Headers(res.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=0, s-maxage=300');
  if (/^\/(admin|profile|favorites|search)/.test(url.pathname)) headers.set('X-Robots-Tag', 'noindex');
  return new Response(res.body, { status: meta.status, headers });
}

async function sitemap(env, url) {
  const site = env.SITE_URL || url.origin;
  const games = await loadGames(env);
  const day = (d) => (d ? String(d).slice(0, 10) : new Date().toISOString().slice(0, 10));
  const today = day();
  const u = (loc, pri, freq, last = today, img) => `<url><loc>${site}${loc}</loc><lastmod>${last}</lastmod><changefreq>${freq}</changefreq><priority>${pri}</priority>${img ? `<image:image><image:loc>${esc(img.startsWith('http') ? img : site + img)}</image:loc></image:image>` : ''}</url>`;
  const body = [
    u('/', '1.0', 'daily'),
    u('/games', '0.8', 'daily'),
    ...games.map((g) => u(`/g/${g.id}`, '0.9', 'weekly', day(g.created_at), g.hero || g.thumb)),
  ].join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${body}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const id = env.LEADERBOARD.idFromName('global');
      return env.LEADERBOARD.get(id).fetch(request);
    }
    // www en oude adressen netjes naar de hoofdsite sturen
    if (env.SITE_URL) {
      const host = new URL(env.SITE_URL).host;
      if (url.host === 'www.' + host) return Response.redirect(env.SITE_URL + url.pathname + url.search, 301);
    }
    if (url.pathname === '/sitemap.xml') return sitemap(env, url);
    // oude categorie-adressen bestaan niet meer
    if (/^\/(c\/|popular|new|categories)/.test(url.pathname)) return Response.redirect((env.SITE_URL || url.origin) + '/games', 301);
    if (request.method === 'GET' && /^\/(g\/|games$|favorites|profile|admin|search)/.test(url.pathname) || (request.method === 'GET' && url.pathname === '/')) {
      return servePage(request, env, url);
    }
    return env.ASSETS.fetch(request);
  },
};
