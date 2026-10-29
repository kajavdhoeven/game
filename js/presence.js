// Laat de server weten dat deze bezoeker op de site is (zonder naam of andere gegevens), zodat de beheerder kan zien hoeveel mensen er nu zijn.
// Alleen een willekeurig nummer van dit apparaat, of je bent ingelogd en (als je bent ingelogd) je gebruikersnaam en op welke pagina je bent. De namen zijn alleen voor beheerders te zien.
let cid = '';
try { cid = localStorage.getItem('teun-cid') || ''; } catch (e) { /* geen opslag */ }
if (!/^[\w-]{8,40}$/.test(cid)) {
  cid = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^\w-]/g, '').slice(0, 36);
  try { localStorage.setItem('teun-cid', cid); } catch (e) { /* geen opslag */ }
}
let info = () => ({});
// speelt hij nu? Dat is zo als hij op een gamepagina staat en de game is gestart
const playingNow = () => {
  const m = location.pathname.match(/^\/g\/([\w-]+)/);
  return m && document.querySelector('#player.playing') ? m[1] : '';
};
const send = (extra = {}) => {
  try { fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cid, ...info(), path: location.pathname, playing: playingNow(), ...extra }), keepalive: true }).catch(() => {}); } catch (e) { /* offline */ }
};
export const pingNow = () => { if (!document.hidden) send(); };
export function startPresence(infoFn) {
  info = infoFn;
  const tick = () => { if (!document.hidden) send(); };
  send();
  setInterval(tick, 30000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) send({ bye: true }); else send(); });
  window.addEventListener('pagehide', () => send({ bye: true }));
}
