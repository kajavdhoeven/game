import { el, esc } from './ui.js';
import { hero, sectionRow, gameTile, emptyState } from './components.js';
import { CATEGORIES, COMING_SOON, catById } from './games.js';
import { categoryIcon, teunSVG, icon } from './art.js';

const soonOf = (cat) => COMING_SOON.filter((s) => s.category === cat).map((s) => ({ ...s, soon: true }));

export function renderHome(app) {
  const { games, user } = app.state;
  const f = document.createDocumentFragment();
  const live = games.filter((g) => g.published);
  const featured = live.find((g) => g.featured) || live[0];
  if (featured) f.appendChild(hero(featured, app.state));

  // categorie-kaarten
  const cats = el('<section class="cats" data-egg-zone><div class="row-head"><h2>Categorieën</h2></div><div class="cat-grid"></div></section>');
  const grid = cats.querySelector('.cat-grid');
  CATEGORIES.forEach((c) => {
    const n = live.filter((g) => g.category === c.id || (g.tags || []).includes(c.id)).length;
    const a = el(`<a class="cat-card" href="#/c/${c.id}" style="--c1:${c.color[0]};--c2:${c.color[1]}">
      <span class="cat-emoji">${categoryIcon(c.id)}</span><b>${esc(c.name)}</b><small>${n ? n + ' game' + (n > 1 ? 's' : '') + ' · ' : ''}${soonOf(c.id).length ? soonOf(c.id).length + ' binnenkort' : ''}</small></a>`);
    grid.appendChild(a);
  });

  const popular = [...live].sort((a, b) => (b.plays + b.likes * 3) - (a.plays + a.likes * 3));
  const row1 = [...popular, ...COMING_SOON.slice(0, 5).map((s) => ({ ...s, soon: true }))];
  f.appendChild(sectionRow('Populair bij Te-Un Games', row1, { sub: 'De favorieten van iedereen' }));
  f.appendChild(cats);

  const fresh = [...live].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  f.appendChild(sectionRow('Nieuw', [...fresh, ...COMING_SOON.slice(5).map((s) => ({ ...s, soon: true }))], { sub: 'Net toegevoegd en binnenkort' }));

  CATEGORIES.slice(0, 4).forEach((c) => {
    const items = [...live.filter((g) => g.category === c.id || (g.tags || []).includes(c.id)), ...soonOf(c.id)];
    if (items.length) f.appendChild(sectionRow(`${categoryIcon(c.id)} ${esc(c.name)}`, items, { href: `#/c/${c.id}` }));
  });

  // wie is Te-Un?
  const about = el(`<section class="about" data-egg-zone>
    <div class="about-teun">${teunSVG({ cls: 'idle' })}</div>
    <div class="about-text">
      <span class="chip">Maak kennis</span>
      <h2>Wie is Te-Un?</h2>
      <p>Te-Un is een kleine kabouter met een rood puntmutsje, een ronde zwarte bril en smurfblauwe schoenen. Hij rent, springt en vliegt door elke game op dit platform. Zoek hem maar: hij zit overal!</p>
      <div class="about-actions">${user ? '' : '<button class="btn primary" data-act="signup">Maak een gratis account</button>'}<button class="btn ghost" data-act="tour">Rondleiding met Te-Un</button></div>
    </div></section>`);
  about.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'signup') app.openAuth('signup'); else app.startTour();
  });
  f.appendChild(about);
  return f;
}

export function renderCategory(app, id) {
  const c = catById(id);
  const live = app.state.games.filter((g) => g.published && (g.category === id || (g.tags || []).includes(id)));
  const items = [...live, ...soonOf(id)];
  const wrap = document.createDocumentFragment();
  wrap.appendChild(el(`<section class="cat-hero" data-egg-zone style="--c1:${c.color[0]};--c2:${c.color[1]}">
    <div class="cat-hero-body"><span class="cat-big">${categoryIcon(id)}</span><div><h1>${esc(c.name)}</h1><p>${esc(c.blurb || '')}</p></div></div>
    <div class="cat-hero-teun">${teunSVG({ cls: 'wave' })}</div></section>`));
  const nav = el('<div class="cat-pills"></div>');
  CATEGORIES.forEach((k) => nav.appendChild(el(`<a class="pill ${k.id === id ? 'on' : ''}" href="#/c/${k.id}">${categoryIcon(k.id)} ${esc(k.name)}</a>`)));
  wrap.appendChild(nav);
  const g = el('<section class="grid-games" data-egg-zone></section>');
  items.forEach((x) => g.appendChild(gameTile(x)));
  if (!items.length) g.appendChild(emptyState('Nog niets hier', 'Er komen snel games in deze categorie!'));
  wrap.appendChild(g);
  return wrap;
}

export function renderList(app, title, items, empty) {
  const f = document.createDocumentFragment();
  f.appendChild(el(`<div class="page-title" data-egg-zone><h1>${title}</h1></div>`));
  const g = el('<section class="grid-games"></section>');
  items.forEach((x) => g.appendChild(gameTile(x)));
  if (!items.length) g.appendChild(emptyState(empty[0], empty[1]));
  f.appendChild(g);
  void icon;
  return f;
}

export function allSoon() { return COMING_SOON.map((s) => ({ ...s, soon: true })); }
