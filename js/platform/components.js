import { esc, el, fmt } from './ui.js';
import { icon, teunSVG, categoryIcon } from './art.js';
import { catById } from './games.js';

const isNew = (g) => Date.now() - new Date(g.created_at || 0).getTime() < 45 * 864e5;

export function gameTile(g, { wide = false } = {}) {
  const cat = catById(g.category);
  if (g.soon) {
    const [c1, c2] = cat.color;
    return el(`<div class="tile soon ${wide ? 'wide' : ''}" tabindex="0" role="button" aria-label="${esc(g.title)} (binnenkort)" style="--c1:${c1};--c2:${c2}">
      <div class="tile-img soon-art"><span class="soon-emoji">${categoryIcon(g.category)}</span><div class="tile-teun">${teunSVG({ crop: 'face' })}</div></div>
      <span class="badge soon">Binnenkort</span>
      <div class="tile-over"><b>${esc(g.title)}</b><span>${esc(cat.name)}</span></div>
    </div>`);
  }
  return el(`<a class="tile ${wide ? 'wide' : ''}" href="#/g/${esc(g.id)}" aria-label="${esc(g.title)}">
    <div class="tile-img" style="background-image:url('${esc(g.thumb)}')"></div>
    ${isNew(g) ? '<span class="badge new">Nieuw</span>' : ''}
    <div class="tile-over"><b>${esc(g.title)}</b><span>${esc(cat.name)}</span></div>
    <div class="tile-meta"><span>${icon('heart', 14)} ${fmt(g.likes)}</span><span>${icon('play', 14)} ${fmt(g.plays)}</span></div>
  </a>`);
}

export function sectionRow(title, items, { sub = '', href = '', zone = true } = {}) {
  const sec = el(`<section class="row" ${zone ? 'data-egg-zone' : ''}>
    <div class="row-head"><h2>${title}</h2>${sub ? `<span class="muted">${sub}</span>` : ''}${href ? `<a class="more" href="${href}">Alles bekijken</a>` : ''}</div>
    <div class="scroller"></div></section>`);
  const sc = sec.querySelector('.scroller');
  items.forEach((g) => sc.appendChild(gameTile(g)));
  return sec;
}

export function hero(g, state) {
  const cat = catById(g.category);
  return el(`<section class="hero" data-egg-zone style="--hero:url('${esc(g.hero || g.thumb)}')">
    <div class="hero-bg"></div><div class="hero-shade"></div>
    <div class="hero-body">
      <span class="chip">${categoryIcon(g.category)} ${esc(cat.name)}</span>
      <h1>${esc(g.title)}</h1>
      <p>${esc(g.tagline || g.description)}</p>
      <div class="hero-actions">
        <a class="btn primary big" href="#/g/${esc(g.id)}">${icon('play', 20)} Speel nu</a>
        <span class="hero-stats"><b>${icon('heart', 16)} ${fmt(g.likes)}</b><b>${icon('play', 16)} ${fmt(g.plays)}x gespeeld</b></span>
      </div>
    </div>
    <div class="hero-teun">${teunSVG({ cls: 'wave' })}</div>
  </section>`);
}

export function emptyState(title, text) {
  return el(`<div class="empty"><div class="empty-teun">${teunSVG({ cls: 'idle' })}</div><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`);
}
