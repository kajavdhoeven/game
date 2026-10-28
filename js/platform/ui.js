export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const fmt = (n) => Number(n || 0).toLocaleString('nl-NL');

export function ago(iso) {
  if (!iso) return '-';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'zojuist';
  if (s < 3600) return Math.floor(s / 60) + ' min geleden';
  if (s < 86400) return Math.floor(s / 3600) + ' uur geleden';
  if (s < 86400 * 30) return Math.floor(s / 86400) + ' dagen geleden';
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

let toastT;
export function toast(msg, ms = 2400) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), ms);
}

// eenvoudige modal; geeft een sluit-functie terug
export function modal(html, { cls = '', onClose } = {}) {
  const root = $('#modal-root');
  const wrap = el(`<div class="modal-wrap"><div class="modal ${cls}" role="dialog" aria-modal="true"><button class="modal-x" aria-label="Sluiten">&times;</button><div class="modal-body"></div></div></div>`);
  const body = $('.modal-body', wrap);
  if (typeof html === 'string') body.innerHTML = html; else body.appendChild(html);
  const close = () => {
    wrap.classList.add('out');
    setTimeout(() => wrap.remove(), 180);
    document.removeEventListener('keydown', onKey);
    onClose && onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  $('.modal-x', wrap).addEventListener('click', close);
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('in'));
  return { close, body, wrap };
}
