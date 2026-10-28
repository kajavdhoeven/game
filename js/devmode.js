// Developer-modus voor alle games: een klein Dev-knopje rechtsboven. Met het wachtwoord opent een paneel met snelle hulpmiddelen.
// Let op: dit is een hulpmiddel om te testen. Het wachtwoord wordt alleen als hash vergeleken, maar echte beveiliging is het niet.
const HASH = '1bffd6c16f6db072a4b5d5f4e247a73f46cac917a891585fc450dedab7554883';
const SKEY = 'teun-dev-open';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const isOpen = () => { try { return sessionStorage.getItem(SKEY) === '1'; } catch (e) { return false; } };
const setOpen = (v) => { try { sessionStorage.setItem(SKEY, v ? '1' : '0'); } catch (e) { /* geen opslag */ } };

// De Dev- en ?-knop zijn alleen in de menu's te zien, niet tijdens het spelen.
export function setDevVisible(v) {
  for (const id of ['teunDevBtn', 'teunHelpBtn']) { const b = document.getElementById(id); if (b) b.style.display = v ? '' : 'none'; }
  if (!v) document.querySelectorAll('.teun-dev-ov').forEach((o) => o.remove());
}

// actions: [{ label, run() -> tekst | undefined }]
export function initDev(actions) {
  if (document.getElementById('teunDevBtn')) return;
  const css = document.createElement('style');
  css.textContent = `
  #teunDevBtn { position: fixed; top: 8px; left: 8px; z-index: 2147483000; font: 700 15px/1 system-ui, sans-serif; padding: 9px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,.45); background: rgba(0,0,0,.5); color: #fff; opacity: .7; cursor: pointer; touch-action: manipulation; }
  #teunDevBtn:hover { opacity: 1; }
  .teun-dev-ov { position: fixed; inset: 0; z-index: 2147483001; display: grid; place-items: center; background: rgba(0,0,0,.6); padding: 16px; font-family: system-ui, sans-serif; user-select: text; -webkit-user-select: text; touch-action: manipulation; }
  .teun-dev-box { width: min(360px, 100%); background: #151a28; color: #fff; border: 1px solid #3a4560; border-radius: 14px; padding: 16px; box-shadow: 0 14px 40px rgba(0,0,0,.6); }
  .teun-dev-box h3 { margin: 0 0 10px; font-size: 17px; }
  .teun-dev-box input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #3a4560; background: #0c101a; color: #fff; font-size: 16px; }
  .teun-dev-box button { font: 600 14px system-ui, sans-serif; padding: 9px 12px; border-radius: 8px; border: 0; background: #2f6fe0; color: #fff; cursor: pointer; }
  .teun-dev-box button.ghost { background: #2a3350; }
  .teun-dev-row { display: flex; gap: 8px; margin-top: 10px; }
  .teun-dev-row button { flex: 1; }
  .teun-dev-list { display: grid; gap: 8px; }
  .teun-dev-msg { min-height: 18px; margin-top: 10px; font-size: 13px; color: #8be3a4; }
  .teun-dev-msg.err { color: #ff8c8c; }`;
  document.head.appendChild(css);
  const btn = document.createElement('button');
  btn.id = 'teunDevBtn'; btn.type = 'button'; btn.textContent = 'Dev'; btn.setAttribute('aria-label', 'Developer-modus');
  document.body.appendChild(btn);

  let ov = null;
  const close = () => { if (ov) { ov.remove(); ov = null; window.dispatchEvent(new Event('teun:resume')); } };
  const mk = (html) => {
    close();
    ov = document.createElement('div');
    ov.className = 'teun-dev-ov';
    ov.innerHTML = `<div class="teun-dev-box">${html}</div>`;
    // toetsen in dit venster horen niet bij het spel
    ['keydown', 'keyup', 'keypress'].forEach((t) => ov.addEventListener(t, (e) => e.stopPropagation()));
    ov.addEventListener('pointerdown', (e) => { if (e.target === ov) close(); e.stopPropagation(); });
    document.body.appendChild(ov);
    return ov;
  };
  const panel = () => {
    const o = mk(`<h3>Developer-modus</h3><div class="teun-dev-list"></div><div class="teun-dev-msg"></div><div class="teun-dev-row"><button class="ghost" data-act="lock">Vergrendelen</button><button class="ghost" data-act="close">Sluiten</button></div>`);
    const list = o.querySelector('.teun-dev-list'), msg = o.querySelector('.teun-dev-msg');
    actions.forEach((a) => {
      const b = document.createElement('button');
      b.textContent = a.label;
      b.addEventListener('click', () => { let r; try { r = a.run(); } catch (e) { r = 'Mislukt: ' + e.message; } msg.className = 'teun-dev-msg'; msg.textContent = r || 'Gedaan'; });
      list.appendChild(b);
    });
    o.querySelector('[data-act=close]').onclick = close;
    o.querySelector('[data-act=lock]').onclick = () => { setOpen(false); close(); };
  };
  const ask = () => {
    const o = mk(`<h3>Developer-wachtwoord</h3><input type="password" autocomplete="off" autocapitalize="off" placeholder="Wachtwoord"><div class="teun-dev-msg err"></div><div class="teun-dev-row"><button class="ghost" data-act="close">Annuleren</button><button data-act="ok">Openen</button></div>`);
    const inp = o.querySelector('input'), msg = o.querySelector('.teun-dev-msg');
    const go = async () => {
      if (!(window.crypto && crypto.subtle)) { msg.textContent = 'Dit werkt alleen via https.'; return; }
      if ((await sha256(inp.value)) === HASH) { setOpen(true); panel(); } else { msg.textContent = 'Verkeerd wachtwoord.'; inp.select(); }
    };
    o.querySelector('[data-act=ok]').onclick = go;
    o.querySelector('[data-act=close]').onclick = close;
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); else if (e.key === 'Escape') close(); });
    setTimeout(() => inp.focus(), 50);
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); window.dispatchEvent(new Event('teun:pause')); if (isOpen()) panel(); else ask(); });
  ['pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach((t) => btn.addEventListener(t, (e) => e.stopPropagation()));
}
