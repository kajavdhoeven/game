import { teunSVG } from './art.js';
import { el, $ } from './ui.js';

// De rondleiding: Te-Un loopt over het scherm naar het volgende onderwerp en vertelt er iets over.
const STEPS = [
  { at: 'center', pose: 'wave', title: 'Hoi, ik ben Te-Un!', text: 'Welkom bij Te-Un Games! Dit is mijn eigen speelplek. Ik loop even met je mee en laat zien hoe alles werkt.' },
  { at: '#search', side: 'below', title: 'Zoek je spel', text: 'Hier typ je de naam van een game. Zo vind je altijd wat je zoekt.' },
  { at: '.rail', fallback: '.bottom-nav', side: 'right', title: 'Onze games', text: 'In dit menu staan al onze games. Er komen steeds meer spellen bij!' },
  { at: '.featured, .card-game', side: 'below', title: 'Mijn eigen game', text: 'Dit is Te-Un Surfers! Ik ren over het spoor, spring op treinen en spuit treinspotters nat. Probeer het maar eens.' },
  { at: '#btnAccount', side: 'below', title: 'Maak een account', text: 'Met een account bewaar ik je voortgang, je munten en je gekochte voertuigen. Je kiest ook je eigen profielpictogram: mij of een NS-trein!' },
  { at: 'center', pose: 'wave', title: 'Veel speelplezier!', text: 'Dat was het! Zin om te spelen? Dan zie ik je bij Te-Un Surfers. Tot zo!', last: true },
];

export function startTour({ onDone }) {
  const root = $('#tour-root');
  root.innerHTML = '';
  document.body.classList.add('touring');
  const dim = el('<div class="tour-dim"></div>');
  const spot = el('<div class="tour-spot" hidden></div>');
  const bubble = el('<div class="tour-bubble" role="dialog" aria-live="polite"><div class="tb-title"></div><div class="tb-text"></div><div class="tb-actions"><button class="btn ghost small" data-act="skip">Overslaan</button><span class="tb-dots"></span><button class="btn primary small" data-act="next">Volgende</button></div></div>');
  const walker = el(`<div class="tour-teun">${teunSVG({ cls: 'walkable' })}</div>`);
  root.append(dim, spot, bubble, walker);

  let i = -1;
  let curX = -160;
  const W = () => window.innerWidth;
  const H = () => window.innerHeight;
  const size = () => (W() < 560 ? 104 : 150);

  function target(step) {
    if (step.at === 'center') return null;
    let node = document.querySelector(step.at);
    if (!node || node.offsetParent === null) node = step.fallback ? document.querySelector(step.fallback) : null;
    if (!node || node.offsetParent === null) return null;
    node.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    return node.getBoundingClientRect();
  }

  function place(step) {
    const r = target(step);
    const s = size();
    walker.style.setProperty('--s', s + 'px');
    let x;
    let y;
    spot.hidden = !r;
    if (r) {
      const pad = 8;
      Object.assign(spot.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
      if (step.side === 'right' && W() > 700) { x = r.right + 24; y = r.top + Math.min(r.height * 0.4, H() * 0.3); }
      else { x = Math.min(W() - s - 12, Math.max(12, r.left + r.width / 2 - s / 2)); y = Math.min(H() - s - 12, r.bottom + 20); if (y + s + 12 > H()) y = Math.max(12, r.top - s - 20); }
    } else {
      x = W() / 2 - s / 2 - (W() > 800 ? 220 : 0);
      y = H() - s - 40;
    }
    return { x, y, s };
  }

  function bubbleAt(p, step) {
    const bw = Math.min(360, W() - 24);
    bubble.style.width = bw + 'px';
    let bx = p.x + p.s + 14;
    let by = p.y - 10;
    if (bx + bw > W() - 12) bx = Math.max(12, p.x - bw - 14);
    if (bx < 12 || W() < 700) { bx = Math.max(12, Math.min(W() - bw - 12, p.x + p.s / 2 - bw / 2)); by = p.y - bubble.offsetHeight - 14; }
    if (by < 12) by = Math.min(H() - bubble.offsetHeight - 12, p.y + p.s + 14);
    bubble.style.left = bx + 'px';
    bubble.style.top = Math.max(12, by) + 'px';
  }

  function go(n) {
    i = n;
    if (i >= STEPS.length) return finish();
    const step = STEPS[i];
    bubble.classList.remove('show');
    const p = place(step);
    const dx = p.x - curX;
    walker.classList.remove('wave', 'point', 'talking');
    walker.classList.add('walking');
    walker.style.transform = `translate(${p.x}px, ${p.y}px)`;
    walker.querySelector('svg').style.transform = dx < -4 ? 'scaleX(-1)' : 'scaleX(1)';
    const dur = Math.min(2.4, Math.max(0.5, Math.abs(dx) / 480 + 0.4));
    walker.style.transitionDuration = dur + 's';
    curX = p.x;
    clearTimeout(go.t);
    go.t = setTimeout(() => {
      walker.classList.remove('walking');
      walker.classList.add('talking');
      if (step.pose) walker.classList.add(step.pose);
      walker.querySelector('svg').style.transform = 'scaleX(1)';
      $('.tb-title', bubble).textContent = step.title;
      $('.tb-text', bubble).textContent = step.text;
      $('.tb-dots', bubble).innerHTML = STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
      $('[data-act=next]', bubble).textContent = step.last ? 'Naar de games!' : 'Volgende';
      bubbleAt(p, step);
      bubble.classList.add('show');
    }, dur * 1000 + 60);
  }

  function finish() {
    clearTimeout(go.t);
    bubble.classList.remove('show');
    spot.hidden = true;
    walker.classList.remove('talking', 'wave', 'point');
    walker.classList.add('walking');
    walker.querySelector('svg').style.transform = 'scaleX(1)';
    walker.style.transitionDuration = '1.6s';
    walker.style.transform = `translate(${W() + 200}px, ${H() - size() - 40}px)`;
    dim.classList.add('out');
    setTimeout(() => {
      root.innerHTML = '';
      document.body.classList.remove('touring');
      window.removeEventListener('resize', onResize);
      onDone && onDone();
    }, 1700);
  }

  bubble.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'skip') finish();
    else go(i + 1);
  });
  const onResize = () => { if (i >= 0 && i < STEPS.length) go(i); };
  window.addEventListener('resize', onResize);

  // begin buiten beeld en loop het scherm in
  walker.style.transition = 'none';
  walker.style.transform = `translate(-200px, ${H() - size() - 40}px)`;
  curX = -200;
  requestAnimationFrame(() => requestAnimationFrame(() => { walker.style.transition = ''; go(0); }));
}
