// Games die "binnenkort" uitkomen: aftelklok, en beheerders mogen al spelen en testen.
import { esc } from './ui.js';

export const isUpcoming = (g) => !!g && !!g.coming_soon && !!g.release_at && new Date(g.release_at).getTime() > Date.now();
export const canPreview = (profile) => !!profile && !!(profile.is_owner || profile.is_admin);

export function parts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
export function whenText(g) {
  const d = new Date(g.release_at);
  const day = d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  return `${day} om ${time}`;
}
// korte tekst voor in een kaartje: "over 3 d 4 u"
export function shortLeft(g) {
  const p = parts(new Date(g.release_at).getTime() - Date.now());
  if (p.d > 0) return `over ${p.d} d ${p.h} u`;
  if (p.h > 0) return `over ${p.h} u ${p.m} min`;
  return `over ${p.m} min`;
}
export function countdownHTML(g, big = false) {
  const box = (k, label) => `<div class="cd-box"><b data-cd="${k}">00</b><span>${label}</span></div>`;
  return `<div class="cd ${big ? 'big' : ''}" data-release="${esc(g.release_at)}">${box('d', 'dagen')}${box('h', 'uren')}${box('m', 'minuten')}${box('s', 'seconden')}</div>`;
}
// laat elke aftelklok in 'root' tikken; als de tijd om is, roept hij onDone aan
let timer = null;
export function startCountdowns(root, onDone) {
  clearInterval(timer);
  const tick = () => {
    const els = [...root.querySelectorAll('[data-release]')];
    if (!els.length || !root.isConnected) { clearInterval(timer); return; }
    let done = false;
    for (const el of els) {
      const left = new Date(el.dataset.release).getTime() - Date.now();
      const p = parts(left);
      for (const k of ['d', 'h', 'm', 's']) { const n = el.querySelector(`[data-cd=${k}]`); if (n) n.textContent = String(p[k]).padStart(2, '0'); }
      if (left <= 0) done = true;
    }
    if (done) { clearInterval(timer); onDone && onDone(); }
  };
  tick();
  timer = setInterval(tick, 1000);
}
export const stopCountdowns = () => clearInterval(timer);
