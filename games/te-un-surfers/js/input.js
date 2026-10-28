// Toetsenbord, swipe (touch en muis), dubbeltik en pauzeren.
const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump',
  ArrowDown: 'roll', KeyS: 'roll',
  Space: 'vehicle',
  KeyF: 'fire', KeyE: 'fire',
  KeyP: 'pause', Escape: 'pause',
  Enter: 'confirm',
};

export function initInput(el, onAction) {
  window.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const a = KEYS[e.code];
    if (!a) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (e.repeat) return;
    onAction(a);
  });

  const TH = 26; // swipe-drempel in pixels
  let sx = 0;
  let sy = 0;
  let st = 0;
  let active = false;
  let fired = false;
  let pid = -1;
  let lastTap = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, input, a, .panel, #leader, #shop, .hud-coins, #teunDevBtn, #teunHelpBtn, .teun-dev-ov, .teun-tut-ov, #vehBox')) return;
    active = true;
    fired = false;
    pid = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    st = e.timeStamp;
  });
  el.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== pid || fired) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;
    // precies één actie per swipe: pas bij een nieuwe aanraking weer mogelijk
    fired = true;
    if (Math.abs(dx) > Math.abs(dy)) onAction(dx > 0 ? 'right' : 'left');
    else onAction(dy > 0 ? 'roll' : 'jump');
  });
  const end = (e) => {
    if (e.pointerId !== pid || !active) return;
    active = false;
    if (fired) return;
    const now = e.timeStamp;
    const moved = Math.hypot(e.clientX - sx, e.clientY - sy);
    if (moved < 14 && now - st < 280) {
      if (now - lastTap < 340 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 60) {
        lastTap = 0;
        onAction('fire');
      } else {
        lastTap = now;
        lastTapX = e.clientX;
        lastTapY = e.clientY;
      }
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', () => { active = false; });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
