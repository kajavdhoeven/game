import { api, configured } from './api.js';
import { applyTheme, savedTheme, THEMES, THEME_ORDER } from './themes.js';
import { DEFAULT_GAMES, CATEGORIES, COMING_SOON } from './games.js';
import { logoSVG, icon, teunSVG, avatarSVG, categoryIcon } from './art.js';
import { $, $$, el, esc, toast, modal } from './ui.js';
import { mountEggs } from './eggs.js';
import { startTour } from './tour.js';
import { renderHome, renderCategory, renderList, allSoon } from './pages-home.js';
import { renderGame, leaveGame } from './pages-game.js';
import { renderProfile } from './pages-profile.js';
import { renderAdmin } from './pages-admin.js';
import { gameTile, emptyState } from './components.js';
import { SITE_DOMAIN } from './config.js';

const state = { user: null, profile: null, games: [], likes: new Set() };
const TOUR_KEY = 'teun-tour-done';

export const app = {
  state,
  openAuth, startTour: runTour, setTheme, updateProfile, signOut, reloadGames, route,
};

// ------------------------------------------------------------------ opbouw
function buildShell() {
  $('#app').innerHTML = `
  <header class="top">
    <a class="logo" href="#/" aria-label="Te-Un Games, naar home">${logoSVG()}<span>Te-Un <b>Games</b></span></a>
    <form class="search" id="search" role="search" autocomplete="off">
      ${icon('search', 18)}<input id="searchInput" type="search" placeholder="Zoek een game..." aria-label="Zoek een game" enterkeyhint="search">
    </form>
    <div class="top-actions">
      <div class="pop-wrap"><button id="btnTheme" class="icon-btn" aria-label="Thema kiezen" title="Thema">${icon('palette', 20)}</button><div class="popover" id="themePop" hidden></div></div>
      <div class="pop-wrap" id="accountWrap"></div>
    </div>
  </header>
  <aside class="rail" aria-label="Menu">
    <nav>
      <a href="#/" data-nav="home">${icon('home')}<span>Home</span></a>
      <a href="#/popular" data-nav="popular">${icon('flame')}<span>Populair</span></a>
      <a href="#/new" data-nav="new">${icon('spark')}<span>Nieuw</span></a>
      <a href="#/favorites" data-nav="favorites">${icon('heart')}<span>Favorieten</span></a>
      <div class="rail-sep">Categorieën</div>
      ${CATEGORIES.map((c) => `<a href="#/c/${c.id}" data-nav="c/${c.id}"><i class="em">${categoryIcon(c.id)}</i><span>${esc(c.name)}</span></a>`).join('')}
    </nav>
    <div class="rail-foot"><div class="rail-teun">${teunSVG({ cls: 'idle' })}</div><small>${SITE_DOMAIN}</small></div>
  </aside>
  <main id="view" tabindex="-1"></main>
  <nav class="bottom-nav" aria-label="Snelmenu">
    <a href="#/" data-nav="home">${icon('home', 22)}<span>Home</span></a>
    <a href="#/categories" data-nav="categories">${icon('grid', 22)}<span>Categorieën</span></a>
    <a href="#/favorites" data-nav="favorites">${icon('heart', 22)}<span>Favorieten</span></a>
    <a href="#/profile" data-nav="profile">${icon('user', 22)}<span>Profiel</span></a>
  </nav>`;
  const si = $('#searchInput');
  $('#search').addEventListener('submit', (e) => { e.preventDefault(); location.hash = '#/search/' + encodeURIComponent(si.value.trim()); });
  si.addEventListener('input', () => { if (si.value.trim().length >= 2) location.replace('#/search/' + encodeURIComponent(si.value.trim())); else if (!si.value.trim() && location.hash.startsWith('#/search')) location.replace('#/'); });
  $('#btnTheme').addEventListener('click', (e) => { e.stopPropagation(); togglePop('themePop'); });
  paintThemePop();
  paintAccount();
  document.addEventListener('click', (e) => { if (!e.target.closest('.pop-wrap')) $$('.popover').forEach((p) => { p.hidden = true; }); });
}

function togglePop(id) {
  const p = $('#' + id);
  const open = p.hidden;
  $$('.popover').forEach((x) => { x.hidden = true; });
  p.hidden = !open;
}

function paintThemePop() {
  const cur = document.documentElement.dataset.theme;
  $('#themePop').innerHTML = `<div class="pop-title">Thema</div>${THEME_ORDER.map((id) => {
    const t = THEMES[id];
    return `<button class="pop-item ${cur === id ? 'on' : ''}" data-theme-pick="${id}"><span class="sw" style="background:linear-gradient(135deg,${t.swatch[0]},${t.swatch[1]})"><i style="background:${t.swatch[2]}"></i></span><span><b>${esc(t.name)}</b><small>${esc(t.blurb)}</small></span></button>`;
  }).join('')}`;
  $$('#themePop [data-theme-pick]').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.themePick); $('#themePop').hidden = true; }));
}

function paintAccount() {
  const w = $('#accountWrap');
  if (!state.user) {
    w.innerHTML = '<button id="btnAccount" class="btn primary small">Inloggen</button>';
    $('#btnAccount').addEventListener('click', () => openAuth('login'));
    return;
  }
  const p = state.profile || { username: '...', avatar: 'teun' };
  w.innerHTML = `<button id="btnAccount" class="avatar-btn" aria-label="Mijn account"><span class="avatar sm">${avatarSVG(p.avatar)}</span><span class="an">${esc(p.username)}</span></button>
    <div class="popover right" id="accPop" hidden>
      <a class="pop-item" href="#/profile"><span class="sw plain">${icon('user')}</span><span><b>Mijn profiel</b><small>Pictogram, thema en voortgang</small></span></a>
      <a class="pop-item" href="#/favorites"><span class="sw plain">${icon('heart')}</span><span><b>Favorieten</b><small>Games die je leuk vindt</small></span></a>
      ${p.is_admin ? `<a class="pop-item" href="#/admin"><span class="sw plain">${icon('shield')}</span><span><b>Beheer</b><small>Dashboard</small></span></a>` : ''}
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
}

async function refreshUser() {
  state.user = api.getUser();
  state.profile = null;
  state.likes = new Set();
  if (state.user) {
    try { state.profile = await api.getProfile(); } catch (e) { console.warn(e); }
    try { state.likes = new Set(await api.myLikes()); } catch (e) { /* geen likes */ }
    if (state.profile && state.profile.theme && THEMES[state.profile.theme]) applyTheme(state.profile.theme);
    document.body.classList.toggle('is-admin', !!(state.profile && state.profile.is_admin));
    api.updateProfile({ last_seen: new Date().toISOString() }).catch(() => {});
  } else document.body.classList.remove('is-admin');
  paintAccount();
  paintThemePop();
}

async function updateProfile(patch) {
  await api.updateProfile(patch);
  if (state.profile) Object.assign(state.profile, patch);
  paintAccount();
}

function setTheme(id) {
  applyTheme(id);
  paintThemePop();
  if (state.user) {
    if (state.profile) state.profile.theme = id;
    api.updateProfile({ theme: id }).catch(() => {});
  }
  mountEggs(id, $('#view'));
  const t = THEMES[id];
  toast(`Thema: ${t.name}`);
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
    $('.auth-note', box).textContent = msg || (m === 'signup' ? 'Bewaar je voortgang, kies je profielpictogram en je thema.' : 'Welkom terug! Log in om verder te spelen.');
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
  if (location.hash && !/^#\/?$/.test(location.hash)) location.hash = '#/';
  setTimeout(() => startTour({
    theme: document.documentElement.dataset.theme,
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
  if (!done) setTimeout(runTour, 900);
}

// ------------------------------------------------------------------ routes
const live = () => state.games.filter((g) => g.published);

async function route() {
  leaveGame();
  const view = $('#view');
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, ...rest] = raw.split('/');
  const arg = decodeURIComponent(rest.join('/') || '');
  let nav = 'home';
  let title = 'Te-Un Games';
  let content;
  switch (path) {
    case 'c': { const c = CATEGORIES.find((x) => x.id === arg); nav = 'c/' + arg; title = (c ? c.name : 'Categorie') + ' games'; content = renderCategory(app, arg); break; }
    case 'g': { const g = state.games.find((x) => x.id === arg); nav = 'home'; title = g ? g.title : 'Game'; content = await renderGame(app, arg); break; }
    case 'popular': nav = 'popular'; title = 'Populair'; content = renderList(app, 'Populair', [...live()].sort((a, b) => (b.plays + b.likes * 3) - (a.plays + a.likes * 3)).concat(allSoon().slice(0, 4)), ['Nog geen populaire games', 'Speel een game en like hem!']); break;
    case 'new': nav = 'new'; title = 'Nieuw'; content = renderList(app, 'Nieuw en binnenkort', [...live()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).concat(allSoon()), ['Nog niets nieuws', 'Kom snel terug!']); break;
    case 'favorites':
      nav = 'favorites'; title = 'Favorieten';
      content = state.user
        ? renderList(app, 'Mijn favorieten', live().filter((g) => state.likes.has(g.id)), ['Nog geen favorieten', 'Klik op het hartje bij een game om hem hier te bewaren.'])
        : (() => { const f = document.createDocumentFragment(); const e = emptyState('Log in voor je favorieten', 'Met een account bewaar je je favoriete games.'); const b = el('<button class="btn primary">Inloggen</button>'); b.onclick = () => openAuth('login'); e.appendChild(b); f.appendChild(e); return f; })();
      break;
    case 'categories': nav = 'categories'; title = 'Categorieën'; content = renderCategoryIndex(); break;
    case 'search': nav = 'home'; title = 'Zoeken'; content = renderSearch(arg); break;
    case 'profile': nav = 'profile'; title = 'Mijn profiel'; content = await renderProfile(app); break;
    case 'admin': nav = 'admin'; title = 'Beheer'; content = await renderAdmin(app); break;
    default: content = renderHome(app);
  }
  view.innerHTML = '';
  view.appendChild(content);
  view.appendChild(footer());
  document.title = title === 'Te-Un Games' ? 'Te-Un Games - gratis online games met Te-Un de kabouter' : `${title} | Te-Un Games`;
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === nav));
  const si = $('#searchInput');
  if (path !== 'search' && si.value) si.value = '';
  window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
  if (path !== 'admin') mountEggs(document.documentElement.dataset.theme, view);
}

function renderSearch(q) {
  const t = q.toLowerCase();
  const si = $('#searchInput');
  if (si && si.value !== q) si.value = q;
  const hit = (g) => !t || [g.title, g.tagline, g.category, ...(g.tags || [])].join(' ').toLowerCase().includes(t);
  const items = [...live().filter(hit), ...allSoon().filter(hit)];
  return renderList(app, q ? `Resultaten voor "${esc(q)}"` : 'Zoeken', items, ['Niets gevonden', 'Probeer een andere zoekterm, bijvoorbeeld "trein" of "actie".']);
}

function renderCategoryIndex() {
  const f = document.createDocumentFragment();
  f.appendChild(el('<div class="page-title"><h1>Categorieën</h1></div>'));
  const grid = el('<div class="cat-grid page"></div>');
  CATEGORIES.forEach((c) => {
    const n = live().filter((g) => g.category === c.id || (g.tags || []).includes(c.id)).length;
    grid.appendChild(el(`<a class="cat-card" href="#/c/${c.id}" style="--c1:${c.color[0]};--c2:${c.color[1]}"><span class="cat-emoji">${categoryIcon(c.id)}</span><b>${esc(c.name)}</b><small>${n} game${n === 1 ? '' : 's'} · ${COMING_SOON.filter((s) => s.category === c.id).length} binnenkort</small></a>`));
  });
  f.appendChild(grid);
  void gameTile;
  return f;
}

function footer() {
  return el(`<footer class="foot"><div class="foot-brand">${logoSVG()}<b>Te-Un Games</b></div>
    <p>Gratis online games met Te-Un de kabouter. ${SITE_DOMAIN}</p>
    <p class="muted">${configured ? '' : 'Demo-modus · '}Alle figuren zijn zelf getekend.</p></footer>`);
}

// ------------------------------------------------------------------ start
async function boot() {
  applyTheme(savedTheme());
  buildShell();
  try { await api.init(); } catch (e) { console.warn('Backend start mislukt:', e.message); }
  api.onAuth(async () => { const before = state.user && state.user.id; if ((api.getUser() && api.getUser().id) !== before) { await refreshUser(); route(); } });
  await Promise.all([reloadGames(), refreshUser()]);
  window.addEventListener('hashchange', route);
  await route();
  $('#boot').classList.add('done');
  setTimeout(() => $('#boot').remove(), 600);
  maybeFirstTour();
}

boot();
window.__app = app;
