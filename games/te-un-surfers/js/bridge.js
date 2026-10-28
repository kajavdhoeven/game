import { P, save, hooks, VEHICLE_ORDER } from './save.js';

// Verbinding met het Te-Un Games platform: laadt en bewaart je voortgang in je account.
// Werkt alleen als het spel in een iframe op hetzelfde domein draait.
export function initBridge({ onProgress }) {
  if (window.parent === window) return;
  const origin = location.origin;
  let timer = null;
  const post = (type, extra = {}) => {
    try { window.parent.postMessage({ type, game: 'te-un-surfers', ...extra }, origin); } catch (e) { /* geen ouder */ }
  };

  hooks.onSave = () => {
    clearTimeout(timer);
    timer = setTimeout(() => post('teun:save', { data: { ...P } }), 700);
  };

  window.addEventListener('message', (e) => {
    if (e.origin !== origin) return;
    const m = e.data;
    if (!m || typeof m !== 'object') return;
    if (m.type === 'teun:progress' && m.data) {
      const d = m.data;
      if ((d.updatedAt || 0) > (P.updatedAt || 0)) {
        const pid = P.pid;
        Object.assign(P, d, { pid });
        if (P.vehicle && !P.owned[P.vehicle]) P.vehicle = VEHICLE_ORDER.find((v) => P.owned[v]) || null;
        save(true);
        onProgress && onProgress();
      } else if ((d.updatedAt || 0) < (P.updatedAt || 0)) {
        post('teun:save', { data: { ...P } }); // lokaal is nieuwer: naar de cloud
      }
    } else if (m.type === 'teun:user' && m.name) {
      if (!P.name || m.force) { P.name = m.name; save(true); onProgress && onProgress(); }
    }
  });
  post('teun:ready');
}
