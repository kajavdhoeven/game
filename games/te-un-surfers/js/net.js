import { P, save } from './save.js';

const API = '/api';
let online = null;

async function req(path, opts) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(API + path, { ...opts, signal: ctl.signal });
    if (!res.ok) throw new Error('http ' + res.status);
    online = true;
    return await res.json();
  } catch (e) {
    online = false;
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function isOnline() {
  return online;
}

export async function fetchBoard() {
  const data = await req('/leaderboard');
  if (data) return data;
  // offline: toon in elk geval jezelf
  const me = { pid: P.pid, name: P.name || 'Jij', distance: P.bestDist, coins: P.bestCoins, score: P.best, runDist: P.bestDist, runCoins: P.bestCoins };
  return { offline: true, score: P.best ? [me] : [], distance: P.bestDist ? [me] : [], coins: P.bestCoins ? [me] : [] };
}

export async function submitScore(distance, coins) {
  P.bestDist = Math.max(P.bestDist, Math.floor(distance));
  P.bestCoins = Math.max(P.bestCoins, coins);
  save();
  return req('/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pid: P.pid,
      name: P.name || 'Naamloos',
      distance: Math.floor(distance),
      coins,
    }),
  });
}

export function cleanName(n) {
  return String(n || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 14);
}
