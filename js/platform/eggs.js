import { THEMES } from './themes.js';
import { el, $, $$ } from './ui.js';

let found = 0;
try { found = +localStorage.getItem('teun-eggs') || 0; } catch (e) { /* geen opslag */ }
export const eggsFound = () => found;

// Verstopt per thema een paar kleine figuurtjes op de pagina. Klikken = groot in beeld.
export function mountEggs(theme, root = document) {
  $$('.egg', root).forEach((e) => e.remove());
  const t = THEMES[theme];
  if (!t || !t.egg) return;
  const zones = $$('[data-egg-zone]', root);
  if (!zones.length) return;
  const picks = [...zones].sort(() => Math.random() - 0.5).slice(0, Math.min(t.egg.count, zones.length));
  picks.forEach((z) => {
    const b = el(`<button class="egg" aria-label="${t.egg.label}" title="">${t.egg.art()}</button>`);
    b.style.left = (10 + Math.random() * 78) + '%';
    b.style.top = (14 + Math.random() * 62) + '%';
    b.style.setProperty('--rot', (Math.random() * 30 - 15) + 'deg');
    b.style.animationDelay = (Math.random() * 3) + 's';
    b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); showEgg(theme, b); });
    z.appendChild(b);
  });
}

export function showEgg(theme, from) {
  const t = THEMES[theme];
  if (!t || !t.egg) return;
  found++;
  try { localStorage.setItem('teun-eggs', String(found)); } catch (e) { /* geen opslag */ }
  const root = $('#egg-root');
  const text = t.egg.big
    ? `<div class="egg-text">${[...t.egg.big].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</div>`
    : `<div class="egg-caption">Gevonden!</div>`;
  const ov = el(`<div class="egg-overlay" role="dialog" aria-label="Verborgen ding gevonden">
    <div class="egg-big ${t.egg.big ? 'with-text' : ''}">${t.egg.art()}</div>${text}
    <div class="egg-hint">Klik om te sluiten</div></div>`);
  root.appendChild(ov);
  if (from) from.classList.add('found');
  requestAnimationFrame(() => ov.classList.add('in'));
  const close = () => { ov.classList.remove('in'); setTimeout(() => ov.remove(), 250); document.removeEventListener('keydown', onKey); };
  const onKey = () => close();
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', close);
  // confetti in de themakleuren
  const cols = t.swatch;
  for (let i = 0; i < 46; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + '%';
    c.style.background = cols[i % cols.length];
    c.style.animationDelay = Math.random() * 0.6 + 's';
    c.style.animationDuration = 1.6 + Math.random() * 1.6 + 's';
    ov.appendChild(c);
  }
}
