// Uitleg per game: een stappenkaart die bij het eerste bezoek vanzelf opent en altijd opnieuw te openen is met de ?-knop.
// steps: [{ icon, title, lines: ['tekst', ...] }]
export function initTutorial({ id, title, steps }) {
  if (document.getElementById('teunHelpBtn')) return { open() {} };
  const css = document.createElement('style');
  css.textContent = `
  #teunHelpBtn { position: fixed; top: 8px; left: 72px; z-index: 2147483000; width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(255,255,255,.5); background: rgba(255,200,40,.9); color: #1b2440; font: 800 19px/1 system-ui, sans-serif; cursor: pointer; opacity: .92; touch-action: manipulation; box-shadow: 0 3px 10px rgba(0,0,0,.35); }
  .teun-tut-ov { position: fixed; inset: 0; z-index: 2147483002; display: grid; place-items: center; background: rgba(5,12,34,.72); padding: 14px; font-family: 'Fredoka', 'Outfit', system-ui, sans-serif; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
  .teun-tut { width: min(460px, 100%); background: linear-gradient(180deg, #ffffff, #eaf2ff); color: #14224a; border-radius: 22px; border: 4px solid #1d4ed8; box-shadow: 0 16px 0 rgba(0,0,0,.18), 0 22px 60px rgba(0,0,0,.5); padding: 20px 22px 18px; text-align: center; animation: teunTut .3s ease-out; }
  @keyframes teunTut { from { transform: translateY(18px) scale(.96); opacity: 0; } }
  .teun-tut .ic { font-size: 62px; line-height: 1.1; margin-bottom: 4px; animation: teunBob 2s ease-in-out infinite; }
  @keyframes teunBob { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-5px) rotate(3deg); } }
  .teun-tut small.t { display: inline-block; background: #1d4ed8; color: #fff; padding: 2px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .teun-tut h3 { margin: 8px 0 6px; font-size: 26px; font-weight: 700; color: #0b3a9e; }
  .teun-tut p { margin: 6px 0; font-size: 17px; line-height: 1.4; font-weight: 500; }
  .teun-tut kbd { display: inline-block; background: #fff; border: 2px solid #1d4ed8; border-bottom-width: 4px; border-radius: 8px; padding: 0 8px; font: 700 14px/22px system-ui, sans-serif; color: #0b3a9e; }
  .teun-tut b { color: #d9480f; }
  .teun-tut .dots { display: flex; justify-content: center; gap: 7px; margin: 12px 0 10px; }
  .teun-tut .dots i { width: 10px; height: 10px; border-radius: 50%; background: #c0d2f5; }
  .teun-tut .dots i.on { background: #1d4ed8; transform: scale(1.25); }
  .teun-tut .row { display: flex; gap: 10px; justify-content: center; }
  .teun-tut button { font: 700 17px 'Fredoka', system-ui, sans-serif; border-radius: 14px; padding: 10px 20px; border: 3px solid #0b3a9e; cursor: pointer; color: #0b3a9e; background: #fff; box-shadow: 0 4px 0 #0b3a9e; }
  .teun-tut button.go { background: linear-gradient(#ffe27a, #ffb81c); }
  .teun-tut button:active { transform: translateY(3px); box-shadow: 0 1px 0 #0b3a9e; }
  .teun-tut .skip { display: block; margin: 10px auto 0; background: none; border: 0; box-shadow: none; font-size: 14px; color: #5a6b99; text-decoration: underline; padding: 2px; }`;
  document.head.appendChild(css);
  const key = 'teun-tut-' + id;
  const seen = () => { try { return localStorage.getItem(key) === '1'; } catch (e) { return false; } };
  const mark = () => { try { localStorage.setItem(key, '1'); } catch (e) { /* geen opslag */ } };
  let ov = null;
  const close = () => { if (ov) { ov.remove(); ov = null; } mark(); window.dispatchEvent(new Event('teun:resume')); };
  const open = () => {
    if (ov) return;
    window.dispatchEvent(new Event('teun:pause'));
    let i = 0;
    ov = document.createElement('div');
    ov.className = 'teun-tut-ov';
    ['keydown', 'keyup', 'keypress'].forEach((t) => ov.addEventListener(t, (e) => { e.stopPropagation(); if (t === 'keydown') { if (e.key === 'ArrowRight' || e.key === 'Enter') next(); else if (e.key === 'ArrowLeft') back(); else if (e.key === 'Escape') close(); } }));
    ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click'].forEach((t) => ov.addEventListener(t, (e) => e.stopPropagation()));
    document.body.appendChild(ov);
    const paint = () => {
      const s = steps[i], last = i === steps.length - 1;
      ov.innerHTML = `<div class="teun-tut" role="dialog" aria-label="Uitleg ${title}"><small class="t">${title} · ${i + 1} van ${steps.length}</small><div class="ic">${s.icon}</div><h3>${s.title}</h3>${s.lines.map((l) => `<p>${l}</p>`).join('')}<div class="dots">${steps.map((_, n) => `<i class="${n === i ? 'on' : ''}"></i>`).join('')}</div><div class="row">${i > 0 ? '<button data-a="back">Terug</button>' : ''}<button class="go" data-a="next">${last ? 'Begrepen, laten we spelen!' : 'Volgende'}</button></div>${last ? '' : '<button class="skip" data-a="skip">Overslaan</button>'}</div>`;
      ov.querySelector('[data-a=next]').onclick = next;
      const b = ov.querySelector('[data-a=back]'); if (b) b.onclick = back;
      const sk = ov.querySelector('[data-a=skip]'); if (sk) sk.onclick = close;
    };
    function next() { if (i >= steps.length - 1) close(); else { i++; paint(); } }
    function back() { if (i > 0) { i--; paint(); } }
    paint();
  };
  const btn = document.createElement('button');
  btn.id = 'teunHelpBtn'; btn.type = 'button'; btn.textContent = '?'; btn.setAttribute('aria-label', 'Uitleg: hoe werkt het?');
  btn.addEventListener('click', (e) => { e.stopPropagation(); open(); });
  ['pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach((t) => btn.addEventListener(t, (e) => e.stopPropagation()));
  document.body.appendChild(btn);
  if (!seen()) setTimeout(open, 700);
  return { open };
}
