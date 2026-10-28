// Echte backend: Supabase (accounts, profielen, likes, plays, voortgang, beheer).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let client = null;
let user = null;
const listeners = new Set();

function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.supabase) return res();
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('Supabase kon niet laden'));
    document.head.appendChild(s);
  });
}

const fail = (error) => { if (error) throw new Error(nl(error.message || String(error))); };
function nl(m) {
  if (/Invalid login/i.test(m)) return 'E-mail of wachtwoord klopt niet.';
  if (/already registered|already been registered/i.test(m)) return 'Dit e-mailadres heeft al een account.';
  if (/Password should be/i.test(m)) return 'Kies een wachtwoord van minstens 6 tekens.';
  if (/Email not confirmed/i.test(m)) return 'Bevestig eerst je e-mail via de link die we je stuurden.';
  if (/rate limit/i.test(m)) return 'Even rustig aan, probeer het zo nog eens.';
  return m;
}

export const remote = {
  mode: 'supabase',
  async init() {
    await loadScript('/vendor/supabase.js');
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await client.auth.getSession();
    user = data.session ? { id: data.session.user.id, email: data.session.user.email } : null;
    client.auth.onAuthStateChange((_e, session) => {
      user = session ? { id: session.user.id, email: session.user.email } : null;
      listeners.forEach((f) => f());
    });
    return user;
  },
  onAuth(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  getUser() { return user; },
  async signUp({ email, password, username }) {
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: location.origin } });
    fail(error);
    if (data.session) return { needsConfirm: false };
    // geen sessie terug (e-mailbevestiging staat aan in Supabase): meteen zelf inloggen
    const r = await client.auth.signInWithPassword({ email, password });
    if (r.error) return { needsConfirm: true };
    return { needsConfirm: false };
  },
  async signIn({ email, password }) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    fail(error);
  },
  async signOut() { await client.auth.signOut(); },
  async getProfile() {
    if (!user) return null;
    for (let i = 0; i < 4; i++) { // het profiel wordt door een trigger gemaakt; heel even wachten kan nodig zijn
      const { data } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (data) return { ...data, email: user.email };
      await new Promise((r) => setTimeout(r, 400));
    }
    return null;
  },
  async updateProfile(patch) {
    if (!user) return;
    const { error } = await client.from('profiles').update(patch).eq('id', user.id);
    fail(error);
  },
  async listGames() {
    const { data, error } = await client.from('game_stats').select('*').order('created_at', { ascending: true });
    fail(error);
    return (data || []).map((g) => ({ ...g, tags: g.tags || [], controls: g.controls || [], plays: Number(g.plays || 0), likes: Number(g.likes || 0) }));
  },
  async myLikes() {
    if (!user) return [];
    const { data } = await client.from('likes').select('game_id').eq('user_id', user.id);
    return (data || []).map((r) => r.game_id);
  },
  async toggleLike(gameId) {
    if (!user) throw new Error('login');
    const { data } = await client.from('likes').select('game_id').eq('user_id', user.id).eq('game_id', gameId).maybeSingle();
    if (data) {
      fail((await client.from('likes').delete().eq('user_id', user.id).eq('game_id', gameId)).error);
      return false;
    }
    fail((await client.from('likes').insert({ user_id: user.id, game_id: gameId })).error);
    return true;
  },
  async recordPlay(gameId) { await client.rpc('record_play', { p_game: gameId }); },
  async getProgress(gameId) {
    if (!user) return null;
    const { data } = await client.from('progress').select('data').eq('user_id', user.id).eq('game_id', gameId).maybeSingle();
    return data ? data.data : null;
  },
  async saveProgress(gameId, data) {
    if (!user) return;
    await client.from('progress').upsert({ user_id: user.id, game_id: gameId, data, updated_at: new Date().toISOString() });
  },
  async allProgress() {
    if (!user) return {};
    const { data } = await client.from('progress').select('game_id,data').eq('user_id', user.id);
    const out = {};
    (data || []).forEach((r) => { out[r.game_id] = r.data; });
    return out;
  },
  async adminOverview() {
    const { data, error } = await client.rpc('admin_overview');
    fail(error);
    return data;
  },
  async adminUsers() {
    const { data, error } = await client.rpc('admin_users');
    fail(error);
    return data || [];
  },
  async adminListGames() { return this.listGames(); },
  async adminSaveGame(g) {
    const row = {
      id: g.id, title: g.title, category: g.category, tags: g.tags || [], tagline: g.tagline || '', description: g.description || '',
      controls: g.controls || [], thumb: g.thumb || '', hero: g.hero || g.thumb || '', url: g.url, published: !!g.published, featured: !!g.featured,
    };
    fail((await client.from('games').upsert(row)).error);
  },
  async adminDeleteGame(id) { fail((await client.from('games').delete().eq('id', id)).error); },
};
