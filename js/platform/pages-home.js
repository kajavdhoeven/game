import { el } from './ui.js';
import { featured, gameCard, emptyState } from './components.js';
import { bigLogo, teunSVG } from './art.js';

export function renderHome(app) {
  const { games, user } = app.state;
  const f = document.createDocumentFragment();
  const live = games.filter((g) => g.published);
  const top = live.find((g) => g.featured) || live[0];

  f.appendChild(el(`<section class="brand" aria-label="Te-Un Games">
    <h1 class="brand-logo">${bigLogo()}<span class="sr-only">Te-Un Games: gratis online games met Te-Un de kabouter</span></h1>
    <p class="brand-sub">Gratis online games met Te-Un de kabouter. Direct spelen, zonder download.</p>
  </section>`));

  if (top) f.appendChild(featured(top));

  const sec = el('<section class="block"><div class="block-head"><h2>Onze games</h2></div><div class="grid-games"></div></section>');
  live.forEach((g) => sec.querySelector('.grid-games').appendChild(gameCard(g)));
  if (!live.length) sec.querySelector('.grid-games').appendChild(emptyState('Nog geen games', 'Kom snel terug!'));
  f.appendChild(sec);

  const about = el(`<section class="about">
    <div class="about-teun">${teunSVG({ cls: 'idle' })}</div>
    <div class="about-text">
      <span class="eyebrow">Maak kennis</span>
      <h2>Wie is Te-Un?</h2>
      <p>Te-Un is een kleine kabouter met een rood puntmutsje en een ronde zwarte bril. Hij rent, springt en vliegt door elke game op dit platform. Zoek hem maar: hij zit overal.</p>
      <div class="about-actions">${user ? '' : '<button class="btn primary" data-act="signup">Gratis account maken</button>'}<button class="btn ghost" data-act="tour">Rondleiding met Te-Un</button></div>
    </div></section>`);
  about.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'signup') app.openAuth('signup'); else app.startTour();
  });
  f.appendChild(about);
  return f;
}

export function renderGames(app, title = 'Alle games', items = null, empty = ['Nog geen games', 'Kom snel terug!']) {
  const f = document.createDocumentFragment();
  f.appendChild(el(`<div class="page-title"><h1>${title}</h1></div>`));
  const g = el('<section class="grid-games"></section>');
  const list = items || app.state.games.filter((x) => x.published);
  list.forEach((x) => g.appendChild(gameCard(x)));
  if (!list.length) g.appendChild(emptyState(empty[0], empty[1]));
  f.appendChild(g);
  return f;
}
