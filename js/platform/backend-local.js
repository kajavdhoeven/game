// Demo-backend: alles in localStorage. Handig om het platform te bekijken voordat Supabase is gekoppeld.
import { DEFAULT_GAMES } from './games.js';

const K = { users: 'teun-p-users', session: 'teun-p-session', likes: 'teun-p-likes', plays: 'teun-p-plays', progress: 'teun-p-progress', games: 'teun-p-games' };
const rd = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* vol */ } };

async function hash(s) {
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('teun:' + s));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  } catch (e) { return 'x' + btoa(s); }
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'u' + Math.random().toString(36).slice(2));
const listeners = new Set();
const emit = () => listeners.forEach((f) => f());

export const local = {
  mode: 'local',
  async init() { return this.getUser(); },
  onAuth(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  getUser() {
    const id = rd(K.session, null);
    const u = rd(K.users, []).find((x) => x.id === id);
    return u ? { id: u.id, email: u.email } : null;
  },
  async signUp({ email, password, username }) {
    const users = rd(K.users, []);
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) throw new Error('Dit e-mailadres heeft al een account.');
    const u = {
      id: uid(), email, pw: await hash(password), username: username || email.split('@')[0], avatar: 'teun', theme: 'smurf',
      is_admin: users.length === 0, is_owner: users.length === 0, permissions: {}, tour_done: false, created_at: new Date().toISOString(), last_seen: new Date().toISOString(),
    };
    users.push(u);
    wr(K.users, users);
    wr(K.session, u.id);
    emit();
    return { needsConfirm: false };
  },
  async signIn({ email, password }) {
    const users = rd(K.users, []);
    const h = await hash(password);
    const u = users.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.pw === h);
    if (!u) throw new Error('E-mail of wachtwoord klopt niet.');
    u.last_seen = new Date().toISOString();
    wr(K.users, users);
    wr(K.session, u.id);
    emit();
  },
  async signOut() { wr(K.session, null); emit(); },
  async getProfile() {
    const u = this.getUser();
    if (!u) return null;
    const p = rd(K.users, []).find((x) => x.id === u.id);
    const { pw, ...rest } = p;
    return rest;
  },
  async updateProfile(patch) {
    const users = rd(K.users, []);
    const u = users.find((x) => x.id === rd(K.session, null));
    if (!u) return;
    Object.assign(u, patch);
    wr(K.users, users);
  },
  async listGames() {
    const extra = rd(K.games, null);
    const base = extra || DEFAULT_GAMES;
    const plays = rd(K.plays, []);
    const likes = rd(K.likes, {});
    return base.map((g) => ({
      ...g,
      plays: plays.filter((p) => p.game === g.id).length,
      likes: Object.values(likes).filter((l) => l.includes(g.id)).length,
    }));
  },
  async myLikes() { return rd(K.likes, {})[rd(K.session, null)] || []; },
  async toggleLike(gameId) {
    const sid = rd(K.session, null);
    if (!sid) throw new Error('login');
    const all = rd(K.likes, {});
    const mine = new Set(all[sid] || []);
    const liked = !mine.has(gameId);
    if (liked) mine.add(gameId); else mine.delete(gameId);
    all[sid] = [...mine];
    wr(K.likes, all);
    return liked;
  },
  async recordPlay(gameId) {
    const plays = rd(K.plays, []);
    plays.push({ game: gameId, user: rd(K.session, null), t: new Date().toISOString() });
    wr(K.plays, plays.slice(-5000));
  },
  async getProgress(gameId) {
    const sid = rd(K.session, null);
    return sid ? (rd(K.progress, {})[sid] || {})[gameId] || null : null;
  },
  async saveProgress(gameId, data) {
    const sid = rd(K.session, null);
    if (!sid) return;
    const all = rd(K.progress, {});
    (all[sid] ||= {})[gameId] = data;
    wr(K.progress, all);
  },
  async allProgress() {
    const sid = rd(K.session, null);
    return sid ? rd(K.progress, {})[sid] || {} : {};
  },
  // ---- beheer
  async adminOverview() {
    const users = rd(K.users, []);
    const plays = rd(K.plays, []);
    const likes = rd(K.likes, {});
    const games = await this.listGames();
    const day = (d) => d.toISOString().slice(0, 10);
    const perDay = {};
    for (let i = 13; i >= 0; i--) perDay[day(new Date(Date.now() - i * 864e5))] = 0;
    plays.forEach((p) => { const k = p.t.slice(0, 10); if (k in perDay) perDay[k]++; });
    return {
      users: users.length, games: games.length, plays: plays.length,
      likes: Object.values(likes).reduce((a, l) => a + l.length, 0),
      new_users_7d: users.filter((u) => Date.now() - new Date(u.created_at) < 7 * 864e5).length,
      plays_per_day: Object.entries(perDay).map(([d, c]) => ({ day: d, count: c })),
    };
  },
  async adminUsers() {
    const plays = rd(K.plays, []);
    return rd(K.users, []).map((u) => ({
      id: u.id, email: u.email, username: u.username, avatar: u.avatar, theme: u.theme, is_admin: u.is_admin, is_owner: !!u.is_owner, permissions: u.permissions || {},
      created_at: u.created_at, last_seen: u.last_seen, plays: plays.filter((p) => p.user === u.id).length,
    }));
  },
  async adminSetUser(id, { is_admin, permissions }) {
    const users = rd(K.users, []);
    const u = users.find((x) => x.id === id);
    const me = users.find((x) => x.id === rd(K.session, null));
    if (!u || !me) throw new Error('Gebruiker niet gevonden.');
    if (!(me.is_owner || (me.is_admin && me.permissions && me.permissions.manage_users === true))) throw new Error('Je mag geen gebruikers beheren.');
    if (u.is_owner) throw new Error('De eigenaar kan niet worden aangepast.');
    if (u.id === me.id) throw new Error('Je kunt je eigen rechten niet aanpassen.');
    u.is_admin = !!is_admin;
    u.permissions = permissions || {};
    wr(K.users, users);
  },
  async adminListGames() { return this.listGames(); },
  async adminSaveGame(g) {
    const games = (rd(K.games, null) || DEFAULT_GAMES).map((x) => ({ ...x }));
    const i = games.findIndex((x) => x.id === g.id);
    const clean = { ...g };
    delete clean.plays; delete clean.likes;
    if (i >= 0) games[i] = { ...games[i], ...clean }; else games.push({ created_at: new Date().toISOString(), tags: [], controls: [], ...clean });
    wr(K.games, games);
  },
  async adminDeleteGame(id) {
    wr(K.games, (rd(K.games, null) || DEFAULT_GAMES).filter((x) => x.id !== id));
  },
};
