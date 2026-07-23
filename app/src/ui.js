// Small UI primitives: bottom sheets, toasts, celebration overlay.
import { icon } from './icons.js';
import { tapHaptic } from './native.js';

export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Bottom sheet ─────────────────────────────────────────────

let activeSheet = null;

export function openSheet(contentHtml, { onClose, tall = false } = {}) {
  closeSheet();
  const root = document.getElementById('sheet-root');
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `
    <div class="sheet-backdrop"></div>
    <div class="sheet ${tall ? 'sheet--tall' : ''}" role="dialog" aria-modal="true">
      <div class="sheet-grabber"></div>
      <button class="sheet-close" aria-label="Close">${icon('x')}</button>
      <div class="sheet-content">${contentHtml}</div>
    </div>`;
  root.appendChild(wrap);
  activeSheet = { wrap, onClose };

  wrap.querySelector('.sheet-backdrop').addEventListener('click', closeSheet);
  wrap.querySelector('.sheet-close').addEventListener('click', closeSheet);

  // Swipe-down to dismiss
  const sheet = wrap.querySelector('.sheet');
  let startY = null;
  let delta = 0;
  sheet.addEventListener('touchstart', (e) => {
    if (sheet.querySelector('.sheet-content').scrollTop > 0) return;
    startY = e.touches[0].clientY;
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    delta = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = `translateY(${delta}px)`;
    sheet.style.transition = 'none';
  }, { passive: true });
  sheet.addEventListener('touchend', () => {
    sheet.style.transition = '';
    if (delta > 90) closeSheet();
    else sheet.style.transform = '';
    startY = null;
    delta = 0;
  });

  requestAnimationFrame(() => wrap.classList.add('sheet-wrap--open'));
  return wrap;
}

export function closeSheet() {
  if (!activeSheet) return;
  const { wrap, onClose } = activeSheet;
  activeSheet = null;
  wrap.classList.remove('sheet-wrap--open');
  setTimeout(() => wrap.remove(), 250);
  if (onClose) onClose();
}

// ── Toast ────────────────────────────────────────────────────

export function toast(message, { emoji = '', duration = 2600 } = {}) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${emoji ? `<span class="toast-emoji">${emoji}</span>` : ''}<span>${esc(message)}</span>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--show'));
  setTimeout(() => {
    el.classList.remove('toast--show');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ── Celebration (confetti + card) ────────────────────────────

export function celebrate(html, { onClose } = {}) {
  const root = document.getElementById('sheet-root');
  const wrap = document.createElement('div');
  wrap.className = 'celebrate-wrap';
  const confetti = Array.from({ length: 40 }, (_, i) => {
    const colors = ['#2d6a4f', '#85ceac', '#ff934f', '#d6eadf', '#ffd166'];
    const left = (i * 53) % 100;
    const delay = (i % 10) * 0.12;
    const dur = 2 + (i % 5) * 0.4;
    const color = colors[i % colors.length];
    return `<span class="confetti" style="left:${left}%;background:${color};animation-delay:${delay}s;animation-duration:${dur}s"></span>`;
  }).join('');
  wrap.innerHTML = `
    <div class="celebrate-backdrop"></div>
    <div class="confetti-layer">${confetti}</div>
    <div class="celebrate-card">${html}
      <button class="btn btn--primary btn--block" data-close>Keep it up!</button>
    </div>`;
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('celebrate-wrap--open'));
  const close = () => {
    wrap.classList.remove('celebrate-wrap--open');
    setTimeout(() => wrap.remove(), 300);
    if (onClose) onClose();
  };
  wrap.querySelector('[data-close]').addEventListener('click', () => {
    tapHaptic();
    close();
  });
  wrap.querySelector('.celebrate-backdrop').addEventListener('click', close);
}

// ── Misc helpers ─────────────────────────────────────────────

export function header(title, { subtitle = '', action = '' } = {}) {
  return `
    <header class="screen-header">
      <div>
        <h1 class="screen-title">${esc(title)}</h1>
        ${subtitle ? `<p class="screen-subtitle">${esc(subtitle)}</p>` : ''}
      </div>
      ${action}
    </header>`;
}

export function statusDot(color) {
  return `<span class="status-dot" style="background:${color}"></span>`;
}

export { icon };
