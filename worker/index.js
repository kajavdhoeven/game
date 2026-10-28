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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const id = env.LEADERBOARD.idFromName('global');
      return env.LEADERBOARD.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
