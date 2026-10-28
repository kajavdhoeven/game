import { ravagioEgg, blockEgg, deerEgg } from './art.js';

export const THEMES = {
  smurf: {
    id: 'smurf', name: 'Smurf Blauw', blurb: 'Fris, blauw en vrolijk.',
    swatch: ['#2a9bff', '#0b5bd3', '#ffd23f'], egg: null,
  },
  ravagio: {
    id: 'ravagio', name: 'Ravagio Oranje', blurb: 'Fel oranje. Zoek de shirtjes!',
    swatch: ['#ff8a1f', '#ff5a00', '#fff1c2'],
    egg: { art: ravagioEgg, label: 'Een oranje shirtje met Ravagio', big: 'Ravagiooo', count: 3 },
  },
  sok: {
    id: 'sok', name: 'Minecraft-sok groen', blurb: 'Blokkerig groen. Kijk goed rond.',
    swatch: ['#5ea32a', '#2f6a17', '#ffd75a'],
    egg: { art: blockEgg, label: 'Een blokfiguurtje met oranje haar', big: null, count: 2 },
  },
  bambi: {
    id: 'bambi', name: 'Bambi-trui bruin', blurb: 'Donkerbruin en gezellig. Let op het hertje.',
    swatch: ['#5a3a24', '#2a170d', '#f2c078'], egg: { art: deerEgg, label: 'Een klein hertje', big: null, count: 2 },
  },
};
export const THEME_ORDER = ['smurf', 'ravagio', 'sok', 'bambi'];

export function applyTheme(id) {
  const t = THEMES[id] ? id : 'smurf';
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = THEMES[t].swatch[1];
  try { localStorage.setItem('teun-theme', t); } catch (e) { /* geen opslag */ }
  return t;
}

export function savedTheme() {
  try { return localStorage.getItem('teun-theme') || 'smurf'; } catch (e) { return 'smurf'; }
}
