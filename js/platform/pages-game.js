import { el, esc, fmt, toast } from './ui.js';
import { icon, teunSVG, avatarSVG, AVATARS, avatarUnlocked } from './art.js';
import { genreName } from './games.js';
import { gameCard, titleHTML } from './components.js';
import { api } from './api.js';

let cleanup = null;
export function leaveGame() { if (cleanup) { cleanup(); cleanup = null; } }

export async function renderGame(app, id) {
  leaveGame();
  const g = app.state.games.find((x) => x.id === id);
  const f = document.createDocumentFragment();
  if (!g) {
    f.appendChild(el('<div class="empty"><h3>Deze game bestaat niet (meer)</h3><p><a class="btn primary" href="/">Terug naar home</a></p></div>'));
    return f;
  }
  const cat = { name: genreName(g.category) };
  const liked = app.state.likes.has(g.id);
  const page = el(`<div class="game-page">
    <nav class="crumbs"><a href="/">Home</a> &rsaquo; <a href="/games">Games</a> &rsaquo; <b>${esc(g.title)}</b></nav>
    <div class="game-layout">
      <div class="player-col">
        <div class="player" id="player" style="--poster:url('${esc(g.hero || g.thumb)}')">
          <div class="player-poster"><div class="poster-card">
            <div class="poster-teun">${teunSVG({ cls: 'wave' })}</div>
            ${titleHTML(g, 'poster-logo', 'h2')}
            <button class="btn primary big" id="btnStart">${icon('play', 22)} Speel nu</button>
            <small>Gratis, zonder download</small></div></div>
        </div>
        <div class="player-bar">
          <div class="pb-title"><h1>${esc(g.title)} <small>gratis online spelen</small></h1><span class="muted">${esc(cat.name)}</span></div>
          <div class="pb-actions">
            <button class="btn ghost small ${liked ? 'liked' : ''}" id="btnLike">${icon('heart', 18)} <span id="likeCount">${fmt(g.likes)}</span></button>
            <button class="btn ghost small" id="btnShare">${icon('share', 18)} Delen</button>
            <button class="btn ghost small" id="btnFull">${icon('fullscreen', 18)} Volledig scherm</button>
          </div>
        </div>
      </div>
      <aside class="side-col">
        <div class="card info" data-egg-zone>
          <h3>Over deze game</h3>
          <p>${esc(g.description)}</p>
          <div class="stat-row"><span>${icon('play', 16)} <b>${fmt(g.plays)}</b> keer gespeeld</span><span>${icon('heart', 16)} <b id="likeCount2">${fmt(g.likes)}</b> likes</span></div>
          <div class="tags"><span class="pill">${esc(cat.name)}</span></div>
        </div>
        <div class="card" id="rewardCard" hidden></div>
        <div class="card" id="progressCard"></div>
        <div class="card"><h3>Besturing</h3><ul class="controls">${(g.controls || []).map(([k, v]) => `<li><kbd>${esc(k)}</kbd><span>${esc(v)}</span></li>`).join('') || '<li><span>Zie in de game.</span></li>'}</ul></div>
      </aside>
    </div>
  </div>`);
  f.appendChild(page);

  const player = page.querySelector('#player');
  let iframe = null;

  const start = async () => {
    if (iframe) return;
    iframe = el(`<iframe title="${esc(g.title)}" src="${esc(g.url)}" allow="fullscreen; autoplay; gamepad; accelerometer" allowfullscreen></iframe>`);
    player.classList.add('playing');
    player.appendChild(iframe);
    api.recordPlay(g.id).catch(() => {});
    g.plays++;
  };
  page.querySelector('#btnStart').addEventListener('click', start);

  // berichten van het spel: voortgang laden en bewaren
  const onMsg = async (e) => {
    if (e.origin !== location.origin || !iframe || e.source !== iframe.contentWindow) return;
    const m = e.data;
    if (!m || m.game !== g.id) return;
    if (m.type === 'teun:ready') {
      const prog = (await api.getProgress(g.id)) || { updatedAt: 0 };
      iframe.contentWindow.postMessage({ type: 'teun:progress', game: g.id, data: prog }, location.origin);
      if (app.state.profile) iframe.contentWindow.postMessage({ type: 'teun:user', game: g.id, name: app.state.profile.username, force: true }, location.origin);
    } else if (m.type === 'teun:save') {
      if (app.state.user) api.saveProgress(g.id, m.data).catch(() => {});
      paintProgress(m.data);
    }
  };
  window.addEventListener('message', onMsg);

  const paintProgressBox = async (data) => {
    const box = page.querySelector('#progressCard');
    if (!app.state.user) {
      box.innerHTML = `<h3>Jouw voortgang</h3><p class="muted">Maak een account om je munten, voertuigen en record te bewaren, ook op andere apparaten.</p><button class="btn primary small" id="pgSign">Account maken</button>`;
      box.querySelector('#pgSign').onclick = () => app.openAuth('signup');
      return;
    }
    const d = data || (await api.getProgress(g.id));
    if (!d) { box.innerHTML = '<h3>Jouw voortgang</h3><p class="muted">Speel een ronde en je voortgang verschijnt hier.</p>'; return; }
    if (g.id === 'te-un-x3m') {
      const st = d.stars || {};
      const lv = Object.keys(st).length, sum = Object.values(st).reduce((a, b2) => a + b2, 0) + (d.bonus || 0) - (d.spent || 0);
      box.innerHTML = `<h3>Jouw voortgang</h3><div class="prog-grid"><div><b>${lv}/25</b><small>Levels af</small></div><div><b>${sum}</b><small>Sterren (nog te besteden)</small></div><div><b>${Object.keys(d.owned || {}).length}/3</b><small>Voertuigen</small></div></div>`;
      return;
    }
    if (g.id === 'te-un-puzzel') {
      const dn = [1, 2, 3, 4].filter((n) => d.done && d.done[n]).length;
      box.innerHTML = `<h3>Jouw voortgang</h3><div class="prog-grid"><div><b>${dn}/4</b><small>Levels af</small></div><div><b>${[1, 2, 3, 4].filter((n) => d.fast && d.fast[n]).length}/4</b><small>Binnen de tijd</small></div><div><b>${[1, 2, 3, 4].filter((n) => d.slide && d.slide[n]).length}/4</b><small>Schuifpuzzels</small></div></div>`;
      return;
    }
    const veh = Object.keys(d.owned || {}).filter((k) => ['wheelchair', 'cow', 'train'].includes(k)).length;
    box.innerHTML = `<h3>Jouw voortgang</h3><div class="prog-grid">
      <div><b>${fmt(d.best)}</b><small>Record</small></div><div><b>${fmt(d.coins)}</b><small>Munten</small></div>
      <div><b>${veh}/3</b><small>Voertuigen</small></div><div><b>${fmt(d.runs)}</b><small>Rondes</small></div></div>`;
  };
  // profielfoto's die je met deze game vrijspeelt
  const paintRewards = async (data) => {
    const list = AVATARS.filter((a) => a.unlock && a.unlock.game === g.id);
    const box = page.querySelector('#rewardCard');
    if (!list.length) return;
    let d = data || null;
    if (!d && app.state.user) d = await api.getProgress(g.id).catch(() => null);
    box.hidden = false;
    box.innerHTML = `<h3>Profielfoto's vrijspelen</h3>${list.map((a) => {
      const open = avatarUnlocked(a, d);
      return `<div class="reward ${open ? 'open' : ''}"><div class="avatar sm">${avatarSVG(a.id)}</div><div><b>${esc(a.name)}${open ? ' · vrijgespeeld' : ''}</b><small>${esc(a.unlock.how)}</small></div></div>`;
    }).join('')}`;
  };
  const paintProgress = async (data) => { await Promise.all([paintProgressBox(data), paintRewards(data)]); };
  paintProgress();

  page.querySelector('#btnLike').addEventListener('click', async (e) => {
    const btn = e.currentTarget; // na een await bestaat currentTarget niet meer, dus nu vastpakken
    if (!app.can('can_like')) return toast('Je mag geen games liken.');
    try {
      const nowLiked = await api.toggleLike(g.id);
      if (nowLiked) { app.state.likes.add(g.id); g.likes++; } else { app.state.likes.delete(g.id); g.likes = Math.max(0, g.likes - 1); }
      btn.classList.toggle('liked', nowLiked);
      page.querySelector('#likeCount').textContent = fmt(g.likes);
      page.querySelector('#likeCount2').textContent = fmt(g.likes);
      if (nowLiked) toast('Leuk! Opgeslagen bij je favorieten.');
    } catch (err) {
      if (err.message === 'login') app.openAuth('login', 'Log in om een game te liken.');
      else toast(err.message);
    }
  });
  page.querySelector('#btnShare').addEventListener('click', async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: g.title, url });
      else { await navigator.clipboard.writeText(url); toast('Link gekopieerd!'); }
    } catch (e) { /* geannuleerd */ }
  });
  // volledig scherm: de echte Fullscreen API waar die bestaat, anders (iPhone) een scherm-vullende weergave
  const exitBtn = el('<button class="fs-exit" aria-label="Volledig scherm sluiten">&#10005;</button>');
  player.appendChild(exitBtn);
  const nativeFs = () => document.fullscreenElement || document.webkitFullscreenElement;
  const setPseudo = (on) => {
    player.classList.toggle('pfs', on);
    document.body.classList.toggle('pfs-lock', on);
    if (on) window.scrollTo(0, 0);
    try { if (on && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); else if (!on && screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* niet overal mogelijk */ }
  };
  const exitFull = () => {
    if (nativeFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    setPseudo(false);
  };
  const enterFull = async () => {
    const t = player;
    const req = t.requestFullscreen || t.webkitRequestFullscreen;
    if (req) {
      try {
        await req.call(t);
        try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ok */ }
        return;
      } catch (e) { /* val terug op de scherm-vullende weergave */ }
    }
    setPseudo(true);
  };
  page.querySelector('#btnFull').addEventListener('click', () => {
    if (!iframe) start();
    if (nativeFs() || player.classList.contains('pfs')) exitFull(); else enterFull();
  });
  exitBtn.addEventListener('click', exitFull);
  const onFsChange = () => { if (!nativeFs()) try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* ok */ } };
  document.addEventListener('fullscreenchange', onFsChange);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && player.classList.contains('pfs')) exitFull(); });

  // meer games
  const more = app.state.games.filter((x) => x.published && x.id !== g.id);
  if (more.length) {
    const sec = el('<section class="block"><div class="block-head"><h2>Meer games</h2></div><div class="grid-games"></div></section>');
    more.forEach((x) => sec.querySelector('.grid-games').appendChild(gameCard(x)));
    f.appendChild(sec);
  }
  cleanup = () => window.removeEventListener('message', onMsg);
  return f;
}
