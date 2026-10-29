import { startPresence, pingNow } from '/js/presence.js';
import { api, configured } from './api.js';
import { DEFAULT_GAMES } from './games.js';
import { logoSVG, icon, teunSVG, avatarSVG } from './art.js';
import { $, $$, el, esc, toast, modal } from './ui.js';
import { startTour } from './tour.js';
import { renderHome, renderGames } from './pages-home.js';
import { renderGame, leaveGame } from './pages-game.js';
import { renderProfile } from './pages-profile.js';
import { renderAdmin } from './admin.js';
import { emptyState } from './components.js';
import { SITE_DOMAIN } from './config.js';

const state = { user: null, profile: null, games: [], likes: new Set() };
const TOUR_KEY = 'teun-tour-done';

export const app = {
  state,
  openAuth, startTour: runTour, updateProfile, signOut, reloadGames, route, can, go,
};

// Rechten van een speler. Ontbreekt een recht, dan mag het (standaard staat alles aan).
function can(key) {
  const p = state.profile;
  if (!p) return key === 'can_play'; // gasten mogen spelen, maar niets bewaren
  if (p.is_owner) return true;
  return !p.permissions || p.permissions[key] !== false;
}

// ------------------------------------------------------------------ opbouw
function buildShell() {
  $('#app').innerHTML = `
  <header class="top">
    <a class="logo" href="/" aria-label="Te-Un Games, naar home">${logoSVG()}<span>Te-Un <b>Games</b></span></a>
    <form class="search" id="search" role="search" autocomplete="off">
      ${icon('search', 18)}<input id="searchInput" type="search" placeholder="Zoek een game" aria-label="Zoek een game" enterkeyhint="search">
    </form>
    <div class="top-actions"><div class="pop-wrap" id="accountWrap"></div></div>
  </header>
  <aside class="rail" aria-label="Menu">
    <nav>
      <a href="/" data-nav="home">${icon('home')}<span>Home</span></a>
      <a href="/games" data-nav="games">${icon('grid')}<span>Alle games</span></a>
      <a href="/favorites" data-nav="favorites">${icon('heart')}<span>Favorieten</span></a>
      <div class="rail-sep">Onze games</div>
      <div id="railGames"></div>
    </nav>
    <div class="rail-foot"><div class="rail-teun">${teunSVG({ cls: 'idle' })}</div><small>${SITE_DOMAIN}</small></div>
  </aside>
  <main id="view" tabindex="-1"></main>
  <nav class="bottom-nav" aria-label="Snelmenu">
    <a href="/" data-nav="home">${icon('home', 22)}<span>Home</span></a>
    <a href="/games" data-nav="games">${icon('grid', 22)}<span>Games</span></a>
    <a href="/favorites" data-nav="favorites">${icon('heart', 22)}<span>Favorieten</span></a>
    <a href="/profile" data-nav="profile">${icon('user', 22)}<span>Profiel</span></a>
  </nav>`;
  const si = $('#searchInput');
  $('#search').addEventListener('submit', (e) => { e.preventDefault(); go('/search/' + encodeURIComponent(si.value.trim())); });
  si.addEventListener('input', () => {
    const q = si.value.trim();
    if (q.length >= 2) go('/search/' + encodeURIComponent(q), true);
    else if (!q && location.pathname.startsWith('/search')) go('/', true);
  });
  paintAccount();
  paintRail();
  document.addEventListener('click', (e) => { if (!e.target.closest('.pop-wrap')) $$('.popover').forEach((p) => { p.hidden = true; }); });
}

function paintRail() {
  const box = $('#railGames');
  if (!box) return;
  box.innerHTML = state.games.filter((g) => g.published).map((g) => `<a href="/g/${esc(g.id)}" data-nav="g/${esc(g.id)}" class="rail-game"><span class="rg-img" style="background-image:url('${esc(g.thumb)}')"></span><span>${esc(g.title)}</span></a>`).join('')
    || '<p class="rail-empty">Nog geen games.</p>';
}

function togglePop(id) {
  const p = $('#' + id);
  const open = p.hidden;
  $$('.popover').forEach((x) => { x.hidden = true; });
  p.hidden = !open;
}

function paintAccount() {
  const w = $('#accountWrap');
  if (!w) return;
  if (!state.user) {
    w.innerHTML = '<button id="btnAccount" class="btn primary small">Inloggen</button>';
    $('#btnAccount').addEventListener('click', () => openAuth('login'));
    return;
  }
  const p = state.profile || { username: '...', avatar: 'teun' };
  const staff = p.is_admin || p.is_owner;
  w.innerHTML = `<button id="btnAccount" class="avatar-btn" aria-label="Mijn account"><span class="avatar sm">${avatarSVG(p.avatar)}</span><span class="an">${esc(p.username)}</span></button>
    <div class="popover right" id="accPop" hidden>
      <a class="pop-item" href="/profile"><span class="sw plain">${icon('user')}</span><span><b>Mijn profiel</b><small>Pictogram en voortgang</small></span></a>
      <a class="pop-item" href="/favorites"><span class="sw plain">${icon('heart')}</span><span><b>Favorieten</b><small>Games die je leuk vindt</small></span></a>
      ${staff ? `<a class="pop-item" href="/admin"><span class="sw plain">${icon('shield')}</span><span><b>Beheer</b><small>Dashboard</small></span></a>` : ''}
      <button class="pop-item" id="accTour"><span class="sw plain">${teunSVG({ crop: 'face' })}</span><span><b>Rondleiding</b><small>Met Te-Un</small></span></button>
      <button class="pop-item" id="accOut"><span class="sw plain">${icon('logout')}</span><span><b>Uitloggen</b></span></button>
    </div>`;
  $('#btnAccount').addEventListener('click', (e) => { e.stopPropagation(); togglePop('accPop'); });
  $('#accTour').addEventListener('click', () => { $('#accPop').hidden = true; runTour(); });
  $('#accOut').addEventListener('click', () => signOut());
  $$('#accPop a').forEach((a) => a.addEventListener('click', () => { $('#accPop').hidden = true; }));
}

// ------------------------------------------------------------------ gegevens
async function reloadGames() {
  try {
    const g = await api.listGames();
    state.games = g && g.length ? g : (configured ? [] : DEFAULT_GAMES);
  } catch (e) {
    console.warn('Games laden mislukt, standaardlijst gebruikt:', e.message);
    state.games = DEFAULT_GAMES;
  }
  paintRail();
}

async function refreshUser() {
  state.user = api.getUser();
  state.profile = null;
  state.likes = new Set();
  if (state.user) {
    try { state.profile = await api.getProfile(); } catch (e) { console.warn(e); }
    try { state.likes = new Set(await api.myLikes()); } catch (e) { /* geen likes */ }
    api.updateProfile({ last_seen: new Date().toISOString() }).catch(() => {});
  }
  paintAccount();
}

async function updateProfile(patch) {
  await api.updateProfile(patch);
  if (state.profile) Object.assign(state.profile, patch);
  paintAccount();
}

async function signOut() {
  await api.signOut();
  await refreshUser();
  toast('Je bent uitgelogd. Tot snel!');
  route();
}

// ------------------------------------------------------------------ inloggen
function openAuth(mode = 'login', msg = '') {
  let m = mode;
  const box = el(`<div class="auth"><div class="auth-teun">${teunSVG({ cls: 'wave' })}</div><div class="auth-main">
    <h2>Doe mee met Te-Un Games</h2>
    <div class="tabs"><button data-m="login">Inloggen</button><button data-m="signup">Account maken</button></div>
    <p class="auth-note"></p>
    <form class="form" novalidate>
      <label data-f="username">Gebruikersnaam<input name="username" maxlength="14" autocomplete="nickname" placeholder="Bijv. KabouterKaja"></label>
      <label>E-mailadres<input name="email" type="email" autocomplete="email" placeholder="jij@voorbeeld.nl" required></label>
      <label>Wachtwoord<input name="password" type="password" autocomplete="current-password" placeholder="Minstens 6 tekens" required></label>
      <div class="form-err" role="alert"></div>
      <button class="btn primary big" type="submit"></button>
    </form>
    <p class="auth-foot">Liever eerst rondkijken? <a href="#" data-act="guest">Doorgaan als gast</a></p>
    ${configured ? '' : '<p class="demo-note">Demo-modus: je account blijft in deze browser. Het eerste account is beheerder.</p>'}
  </div></div>`);
  const dlg = modal(box, { cls: 'auth-modal' });
  const form = $('form', box);
  const err = $('.form-err', box);
  const paint = () => {
    $$('.tabs button', box).forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    $('[data-f=username]', box).style.display = m === 'signup' ? '' : 'none';
    $('button[type=submit]', box).textContent = m === 'signup' ? 'Account maken' : 'Inloggen';
    $('input[name=password]', box).autocomplete = m === 'signup' ? 'new-password' : 'current-password';
    $('.auth-note', box).textContent = msg || (m === 'signup' ? 'Bewaar je voortgang en kies je profielpictogram.' : 'Welkom terug! Log in om verder te spelen.');
    err.textContent = '';
  };
  $$('.tabs button', box).forEach((b) => b.addEventListener('click', () => { m = b.dataset.m; msg = ''; paint(); }));
  $('[data-act=guest]', box).addEventListener('click', (e) => { e.preventDefault(); dlg.close(); });
  paint();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get('email')).trim();
    const password = String(fd.get('password'));
    const username = String(fd.get('username')).replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 14);
    err.textContent = '';
    if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Vul een geldig e-mailadres in.'; return; }
    if (password.length < 6) { err.textContent = 'Kies een wachtwoord van minstens 6 tekens.'; return; }
    if (m === 'signup' && username.length < 2) { err.textContent = 'Kies een gebruikersnaam van minstens 2 tekens.'; return; }
    const btn = $('button[type=submit]', box);
    btn.disabled = true;
    try {
      if (m === 'signup') {
        const r = await api.signUp({ email, password, username });
        if (r.needsConfirm) {
          box.querySelector('.auth-main').innerHTML = `<h2>Bijna klaar!</h2><p>We hebben een mail gestuurd naar <b>${esc(email)}</b>. Klik op de link in de mail om je account te bevestigen en log daarna in.</p><button class="btn primary" id="okc">Oké</button>`;
          $('#okc', box).onclick = () => dlg.close();
          return;
        }
        dlg.close();
        await refreshUser();
        toast(`Welkom, ${state.profile ? state.profile.username : username}!`);
        route();
        setTimeout(() => runTour(), 700);
      } else {
        await api.signIn({ email, password });
        dlg.close();
        await refreshUser();
        toast(`Welkom terug${state.profile ? ', ' + state.profile.username : ''}!`);
        route();
      }
    } catch (ex) {
      err.textContent = ex.message;
    } finally { btn.disabled = false; }
  });
  setTimeout(() => $(m === 'signup' ? 'input[name=username]' : 'input[name=email]', box).focus(), 250);
}

// ------------------------------------------------------------------ rondleiding
function runTour() {
  $$('.popover').forEach((p) => { p.hidden = true; });
  if (location.pathname !== '/') go('/');
  setTimeout(() => startTour({
    onDone: async () => {
      try { localStorage.setItem(TOUR_KEY, '1'); } catch (e) { /* geen opslag */ }
      if (state.user) { try { await updateProfile({ tour_done: true }); } catch (e) { /* later */ } }
    },
  }), 400);
}

function maybeFirstTour() {
  let done = false;
  try { done = localStorage.getItem(TOUR_KEY) === '1'; } catch (e) { /* geen opslag */ }
  if (state.profile && state.profile.tour_done) done = true;
  if (state.user && !state.profile) done = true;
  if (location.pathname.startsWith('/admin')) done = true;
  if (!done) setTimeout(runTour, 900);
}

// ------------------------------------------------------------------ routes
// Echte adressen (History API) in plaats van #-links, zodat Google elke pagina apart kan indexeren.
function go(path, replace = false) {
  if (path === location.pathname + location.search) { route(); return; }
  if (replace) history.replaceState(null, '', path); else history.pushState(null, '', path);
  route();
}

function onLinkClick(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin) return;
  if (/^\/(games|assets|api|vendor)\//.test(u.pathname)) return; // echte bestanden en de games zelf
  e.preventDefault();
  go(u.pathname + u.search);
}

// zoekmachine-gegevens per pagina bijwerken
function setMeta({ title, description, path, image, noindex }) {
  const abs = (p) => location.origin + p;
  const set = (sel, attr, val) => { const n = document.querySelector(sel); if (n) n.setAttribute(attr, val); };
  document.title = title;
  set('meta[name="description"]', 'content', description);
  set('link[rel="canonical"]', 'href', abs(path));
  set('meta[property="og:title"]', 'content', title);
  set('meta[property="og:description"]', 'content', description);
  set('meta[property="og:url"]', 'content', abs(path));
  if (image) set('meta[property="og:image"]', 'content', image.startsWith('http') ? image : abs(image));
  set('meta[name="twitter:title"]', 'content', title);
  set('meta[name="twitter:description"]', 'content', description);
  set('meta[name="robots"]', 'content', noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large');
}

function seoFor(path, arg, title) {
  const base = { title: 'Te-Un Games - gratis online games met Te-Un de kabouter', description: 'Speel gratis online games op Te-Un Games. Ren, spring en vlieg samen met Te-Un de kabouter in Te-Un Surfers. Zonder download, op je computer of telefoon.', path: '/', image: '/assets/header.jpg' };
  if (path === 'g') {
    const g = state.games.find((x) => x.id === arg);
    if (g) return setMeta({ title: `${g.title} - gratis online spelen | Te-Un Games`, description: (g.tagline ? g.tagline + ' ' : '') + (g.description || '').slice(0, 130), path: `/g/${g.id}`, image: g.hero || g.thumb || base.image });
    return setMeta({ ...base, title: 'Game niet gevonden | Te-Un Games', path: location.pathname, noindex: true });
  }
  if (path === 'games') return setMeta({ ...base, title: 'Alle games | Te-Un Games', description: 'Alle gratis online games van Te-Un Games op een rij.', path: '/games' });
  if (['search', 'profile', 'admin', 'favorites'].includes(path)) return setMeta({ ...base, title: `${title} | Te-Un Games`, path: location.pathname, noindex: true });
  setMeta(base);
}

const live = () => state.games.filter((g) => g.published);

async function route() {
  leaveGame();
  const view = $('#view');
  const raw = location.pathname.replace(/^\/+|\/+$/g, '');
  const [path, ...rest] = raw.split('/');
  const arg = decodeURIComponent(rest.join('/') || '');
  let nav = 'home';
  let title = 'Te-Un Games';
  let content;
  document.body.classList.toggle('admin-mode', path === 'admin');
  switch (path) {
    case 'g': { const g = state.games.find((x) => x.id === arg); nav = 'g/' + arg; title = g ? g.title : 'Game'; content = await renderGame(app, arg); break; }
    case 'games': nav = 'games'; title = 'Alle games'; content = renderGames(app, 'Alle games'); break;
    case 'popular': case 'new': case 'categories': case 'c': return go('/games', true);
    case 'favorites':
      nav = 'favorites'; title = 'Favorieten';
      content = state.user
        ? renderGames(app, 'Mijn favorieten', live().filter((g) => state.likes.has(g.id)), ['Nog geen favorieten', 'Klik op het hartje bij een game om hem hier te bewaren.'])
        : (() => { const f = document.createDocumentFragment(); const e = emptyState('Log in voor je favorieten', 'Met een account bewaar je je favoriete games.'); const b = el('<button class="btn primary">Inloggen</button>'); b.onclick = () => openAuth('login'); e.appendChild(b); f.appendChild(e); return f; })();
      break;
    case 'search': nav = 'games'; title = 'Zoeken'; content = renderSearch(arg); break;
    case 'profile': nav = 'profile'; title = 'Mijn profiel'; content = await renderProfile(app); break;
    case 'admin': nav = 'admin'; title = 'Beheer'; content = await renderAdmin(app); break;
    default: content = renderHome(app);
  }
  view.innerHTML = '';
  view.appendChild(content);
  if (path !== 'admin') view.appendChild(footer());
  seoFor(path, arg, title);
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === nav));
  const si = $('#searchInput');
  if (path !== 'search' && si && si.value) si.value = '';
  window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
  pingNow();
}

function renderSearch(q) {
  const t = q.toLowerCase();
  const si = $('#searchInput');
  if (si && si.value !== q) si.value = q;
  const hit = (g) => !t || [g.title, g.tagline, g.category].join(' ').toLowerCase().includes(t);
  return renderGames(app, q ? `Resultaten voor "${esc(q)}"` : 'Zoeken', live().filter(hit), ['Niets gevonden', 'Probeer een andere zoekterm, bijvoorbeeld "trein".']);
}

function footer() {
  return el(`<footer class="foot"><div class="foot-brand">${logoSVG()}<b>Te-Un Games</b></div>
    <p>Gratis online games met Te-Un de kabouter. ${SITE_DOMAIN}</p><p class="muted" id="verLine"></p></footer>`);
}

// toont welke versie van de site live staat, handig om te controleren of een nieuwe build klaar is
fetch('/version.json', { cache: 'no-store' }).then((r) => r.json()).then((v) => {
  const n = document.getElementById('verLine');
  if (n) n.textContent = 'Versie ' + v.version;
}).catch(() => {});

// ------------------------------------------------------------------ start
async function boot() {
  buildShell();
  try { await api.init(); } catch (e) { console.warn('Backend start mislukt:', e.message); }
  api.onAuth(async () => { const before = state.user && state.user.id; if ((api.getUser() && api.getUser().id) !== before) { await refreshUser(); route(); } });
  // oude #-links (bijv. #/g/te-un-surfers) netjes omzetten naar echte adressen
  if (/^#\/./.test(location.hash)) history.replaceState(null, '', location.hash.slice(1));
  await Promise.all([reloadGames(), refreshUser()]);
  window.addEventListener('popstate', route);
  document.addEventListener('click', onLinkClick);
  await route();
  $('#boot').classList.add('done');
  setTimeout(() => $('#boot').remove(), 600);
  maybeFirstTour();
  startPresence(() => ({ auth: !!state.user, name: state.user && state.profile ? state.profile.username : '', avatar: state.user && state.profile ? state.profile.avatar : '' }));
}

boot();
window.__app = app;
