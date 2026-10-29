import { esc, el, fmt } from './ui.js';
import { icon, teunSVG } from './art.js';
import { genreName } from './games.js';
import { isUpcoming, shortLeft, countdownHTML, whenText } from './soon.js';

// De titel van een game: het logo als die er is, anders gewone tekst. De tekst blijft voor zoekmachines en schermlezers staan.
export function titleHTML(g, cls, tag = 'h2') {
  return g.logo
    ? `<${tag} class="${cls}-wrap"><img class="${cls}" src="${esc(g.logo)}" alt="${esc(g.title)}" loading="lazy" decoding="async"><span class="sr-only">${esc(g.title)}</span></${tag}>`
    : `<${tag} class="${cls}-wrap">${esc(g.title)}</${tag}>`;
}

const isNew = (g) => Date.now() - new Date(g.created_at || 0).getTime() < 45 * 864e5;

export function gameCard(g) {
  return el(`<a class="card-game" href="/g/${esc(g.id)}" aria-label="${esc(g.title)}">
    <div class="cg-img" style="background-image:url('${esc(g.thumb)}')">
      ${isUpcoming(g) ? `<span class="badge soon">Binnenkort</span><span class="cg-left">${esc(shortLeft(g))}</span>` : isNew(g) ? '<span class="badge">Nieuw</span>' : ''}
      <span class="cg-play" aria-hidden="true">${icon('play', 26)}</span>
    </div>
    <div class="cg-body">${titleHTML(g, 'cg-logo', 'b')}<span>${esc(genreName(g.category))}</span>
      <div class="cg-meta"><span>${icon('heart', 14)} ${fmt(g.likes)}</span><span>${icon('play', 13)} ${fmt(g.plays)}</span></div></div>
  </a>`);
}

// een banner bovenaan de uitgelichte game (per game in te stellen)
const FEATURE_BANNER = { 'te-un-robber': 'Ons meest geavanceerde spel tot nu toe!' };
export function featured(g) {
  const banner = FEATURE_BANNER[g.id];
  return el(`<section class="featured${banner ? ' has-banner' : ''}">
    ${banner ? `<div class="feat-banner"><span>\u2605</span> ${esc(banner)} <span>\u2605</span></div>` : ''}
    <div class="feat-img" style="background-image:url('${esc(g.hero || g.thumb)}')"></div>
    <div class="feat-body">
      <span class="eyebrow">Uitgelicht</span>
      ${titleHTML(g, 'feat-logo', 'h2')}
      <p>${esc(g.tagline || g.description)}</p>
      <div class="feat-actions">
        <a class="btn primary big" href="/g/${esc(g.id)}">${icon('play', 20)} Speel nu</a>
        <span class="feat-stats"><span>${icon('heart', 16)} ${fmt(g.likes)}</span><span>${icon('play', 15)} ${fmt(g.plays)}x gespeeld</span></span>
      </div>
    </div>
  </section>`);
}

// grote "binnenkort"-banner met aftelklok (voor een uitgelichte game die nog niet is uitgekomen)
export function soonHero(g, canTest) {
  return el(`<section class="soon-hero">
    <div class="soon-bg" style="background-image:url('${esc(g.hero || g.thumb)}')"></div>
    <div class="soon-in">
      <span class="soon-tag">Binnenkort</span>
      ${titleHTML(g, 'soon-logo', 'h2')}
      <p class="soon-tagline">${esc(g.tagline || g.description)}</p>
      ${countdownHTML(g, true)}
      <p class="soon-when">Uit op ${esc(whenText(g))}</p>
      <a class="btn ${canTest ? 'primary' : 'ghost'} big" href="/g/${esc(g.id)}">${canTest ? 'Testen als beheerder' : 'Meer over deze game'}</a>
    </div>
  </section>`);
}

export function emptyState(title, text) {
  return el(`<div class="empty"><div class="empty-teun">${teunSVG({ cls: 'idle' })}</div><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`);
}
