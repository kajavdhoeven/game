// Toetsenbord, swipe (touch en muis) en pauzeren.
const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  ArrowDown: 'roll', KeyS: 'roll',
  KeyP: 'pause', Escape: 'pause',
  Enter: 'confirm',
};

export function initInput(el, onAction) {
  window.addEventListener('keydown', (e) => {
    const a = KEYS[e.code];
    if (!a) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (e.repeat && a !== 'left' && a !== 'right') return;
    if (e.repeat) return;
    onAction(a);
  });

  let sx = 0;
  let sy = 0;
  let active = false;
  let pid = -1;
  const TH = 28;

  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    active = true;
    pid = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
  });
  el.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== pid) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;
    if (Math.abs(dx) > Math.abs(dy)) onAction(dx > 0 ? 'right' : 'left');
    else onAction(dy > 0 ? 'roll' : 'jump');
    sx = e.clientX;
    sy = e.clientY;
  });
  const end = (e) => {
    if (e.pointerId === pid) active = false;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
