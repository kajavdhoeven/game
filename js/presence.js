// Laat de server weten dat deze bezoeker op de site is (zonder naam of andere gegevens), zodat de beheerder kan zien hoeveel mensen er nu zijn.
// Alleen een willekeurig nummer van dit apparaat en of je bent ingelogd.
let cid = '';
try { cid = localStorage.getItem('teun-cid') || ''; } catch (e) { /* geen opslag */ }
if (!/^[\w-]{8,40}$/.test(cid)) {
  cid = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^\w-]/g, '').slice(0, 36);
  try { localStorage.setItem('teun-cid', cid); } catch (e) { /* geen opslag */ }
}
let isAuth = () => false;
const send = (extra = {}) => {
  try { fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cid, auth: !!isAuth(), ...extra }), keepalive: true }).catch(() => {}); } catch (e) { /* offline */ }
};
export function startPresence(authFn) {
  isAuth = authFn;
  const tick = () => { if (!document.hidden) send(); };
  send();
  setInterval(tick, 30000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) send({ bye: true }); else send(); });
  window.addEventListener('pagehide', () => send({ bye: true }));
}
