// Cloudflare Worker: serveert de statische site en een kleine online ranglijst.
// De ranglijst staat in een Durable Object (SQLite-backed, wordt automatisch aangemaakt bij deploy).

const MAX_DIST = 500000;
const MAX_COINS = 2000000;
const KEEP = 1500;

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
  constructor(state) {
    this.state = state;
    this.last = new Map();
  }

  async load() {
    return (await this.state.storage.get('entries')) || {};
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const entries = Object.values(await this.load());
      const top = (key) => entries
        .filter((e) => e[key] > 0)
        .sort((a, b) => b[key] - a[key])
        .slice(0, 25)
        .map((e) => ({ pid: e.pid.slice(0, 8), name: e.name, distance: e.distance, coins: e.coins }));
      return json({ distance: top('distance'), coins: top('coins') });
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
      e.t = now;
      entries[pid] = e;
      const all = Object.values(entries);
      if (all.length > KEEP) {
        all.sort((a, b2) => (b2.distance + b2.coins) - (a.distance + a.coins));
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
  hero: '/assets/te-un-surfers-hero.jpg', thumb: '/assets/te-un-surfers.jpg', created_at: '2025-01-01T00:00:00Z', controls: [],
}];

const CATS = {
  actie: ['Actie', 'Snel reageren, niet omvallen.'], arcade: ['Arcade', 'Hoge scores jagen.'], avontuur: ['Avontuur', 'Ontdek de wereld van Te-Un.'],
  puzzel: ['Puzzel', 'Hersenkrakers voor jong en oud.'], racen: ['Racen', 'Gas erop.'], sport: ['Sport', 'Scoren, rennen, zwemmen.'],
  denken: ['Denken', 'Strategie en quizzen.'], kinderen: ['Kinderen', 'Lekker eenvoudig en lief.'], multiplayer: ['Multiplayer', 'Samen of tegen elkaar.'],
};

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
    body: `<h1>Te-Un Games: gratis online games met Te-Un de kabouter</h1><p>${esc(base.description)}</p><h2>Games</h2><ul>${games.map((g) => `<li><a href="/g/${esc(g.id)}">${esc(g.title)}</a>: ${esc(g.tagline || '')}</li>`).join('')}</ul><h2>Categorieën</h2><ul>${Object.entries(CATS).map(([id, c]) => `<li><a href="/c/${id}">${c[0]}</a></li>`).join('')}</ul>`,
  });
  if (path === '/') return home();

  let m = path.match(/^\/g\/([a-z0-9-]+)\/?$/);
  if (m) {
    const g = games.find((x) => x.id === m[1]);
    if (!g) return { ...base, title: 'Game niet gevonden | Te-Un Games', path, robots: 'noindex, follow', status: 404, body: '<h1>Game niet gevonden</h1><p><a href="/">Naar de startpagina</a></p>' };
    const desc = `${g.tagline ? g.tagline + ' ' : ''}${(g.description || '').slice(0, 130)}`.trim();
    const cat = CATS[g.category] || [g.category, ''];
    const url = `${site}/g/${g.id}`;
    return {
      ...base, title: `${g.title} - gratis online spelen | Te-Un Games`, description: desc, image: g.hero || g.thumb || base.image, path: `/g/${g.id}`,
      body: `<nav><a href="/">Home</a> &rsaquo; <a href="/c/${esc(g.category)}">${esc(cat[0])}</a> &rsaquo; ${esc(g.title)}</nav><h1>${esc(g.title)} gratis online spelen</h1><p>${esc(g.tagline || '')}</p><p>${esc(g.description || '')}</p>${(g.controls || []).length ? `<h2>Besturing</h2><ul>${g.controls.map((c) => `<li>${esc(c[0])}: ${esc(c[1])}</li>`).join('')}</ul>` : ''}<p><a href="/c/${esc(g.category)}">Meer ${esc(cat[0])} games</a></p>`,
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
  m = path.match(/^\/c\/([a-z]+)\/?$/);
  if (m && CATS[m[1]]) {
    const c = CATS[m[1]];
    const list = games.filter((g) => g.category === m[1] || (g.tags || []).includes(m[1]));
    return {
      ...base, title: `${c[0]} games - gratis online spelen | Te-Un Games`, description: `${c[1]} Speel gratis ${c[0].toLowerCase()} games op Te-Un Games.`, path: `/c/${m[1]}`,
      body: `<nav><a href="/">Home</a> &rsaquo; ${c[0]}</nav><h1>${c[0]} games</h1><p>${esc(c[1])}</p><ul>${list.map((g) => `<li><a href="/g/${esc(g.id)}">${esc(g.title)}</a></li>`).join('') || '<li>Er komen snel games bij!</li>'}</ul>`,
    };
  }
  const pages = {
    '/popular': ['Populaire games', 'De meest gespeelde en geliefde games van Te-Un Games.'],
    '/new': ['Nieuwe games', 'De nieuwste games op Te-Un Games.'],
    '/categories': ['Alle categorieën', 'Bekijk alle game-categorieën van Te-Un Games: actie, arcade, avontuur, puzzel, racen en meer.'],
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
    u('/popular', '0.7', 'daily'), u('/new', '0.7', 'daily'), u('/categories', '0.6', 'weekly'),
    ...Object.keys(CATS).map((id) => u(`/c/${id}`, '0.6', 'weekly')),
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
    if (request.method === 'GET' && /^\/(g\/|c\/|popular|new|categories|favorites|profile|admin|search)/.test(url.pathname) || (request.method === 'GET' && url.pathname === '/')) {
      return servePage(request, env, url);
    }
    return env.ASSETS.fetch(request);
  },
};
