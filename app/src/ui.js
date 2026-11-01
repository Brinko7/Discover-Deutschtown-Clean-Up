// Small UI primitives: bottom sheets, toasts, celebration overlay.
import { icon } from './icons.js';
import { tapHaptic } from './native.js';
import { LEVEL_TITLES, XP_RULES, levelInfo, xpForLevel } from './levels.js';

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

// ── Levels ───────────────────────────────────────────────────

// Level badge, title, XP bar. Pass the result of levelInfo(). `onDark` is for the green profile hero.
export function levelCard(info, { onDark = false, interactive = true } = {}) {
  const tag = interactive ? 'button' : 'div';
  return `
    <${tag} class="level-card ${onDark ? 'level-card--dark' : ''}" ${interactive ? `data-levels aria-label="Level ${info.level}, ${esc(info.title)}. How levels work"` : ''}>
      <span class="level-badge"><small>LV</small>${info.level}</span>
      <span class="level-main">
        <span class="level-title">${esc(info.title)}</span>
        <span class="level-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${info.span}" aria-valuenow="${info.into}"><span style="width:${info.pct}%"></span></span>
        <span class="level-sub">${info.into} / ${info.span} XP · ${info.toNext} to level ${info.level + 1}</span>
      </span>
    </${tag}>`;
}

// Wires every level card inside `root` to the "how levels work" sheet.
export function bindLevelCards(root, getXp) {
  root.querySelectorAll('[data-levels]').forEach((el) => {
    el.addEventListener('click', () => {
      tapHaptic();
      openLevelsSheet(levelInfo(getXp()));
    });
  });
}

export function openLevelsSheet(info) {
  const ways = [
    [`1 XP per minute`, `up to ${XP_RULES.dailyTimeCap} XP a day from time`],
    [`+${XP_RULES.showUp} XP for showing up`, `your first ${XP_RULES.showUpMinMinutes}+ minute cleanup of the day`],
    [`+${XP_RULES.newZone} XP new zone`, 'the first time you clean in a zone'],
    [`+${XP_RULES.newBlock} XP new block`, 'each block you have not cleaned before'],
    [`+${XP_RULES.hotZone} XP hot zone`, 'cleaning in a hot zone'],
  ];
  const rungs = LEVEL_TITLES.map(([lv, name]) => `
    <div class="list-row" style="cursor:default;${info.level >= lv ? '' : 'opacity:.55'}">
      <span class="row-icon">${info.level >= lv ? '✅' : '🔒'}</span>
      <span><b style="font-family:var(--font-display)">${esc(name)}</b><br><span style="font-size:12px;color:var(--warm-gray)">Level ${lv} · ${xpForLevel(lv).toLocaleString()} XP</span></span>
    </div>`).join('');
  return openSheet(`
    <h2 class="sheet-title">Level ${info.level} · ${esc(info.title)}</h2>
    <p class="sheet-sub">${info.xp.toLocaleString()} XP total. XP is separate from your points, so it only ever goes up.</p>
    ${levelCard(info, { interactive: false })}
    <div class="section-title" style="margin-top:16px">How to earn XP</div>
    <div class="card" style="padding:4px 16px">
      ${ways.map(([a, b]) => `<div class="list-row" style="cursor:default"><span><b style="font-family:var(--font-display)">${esc(a)}</b><br><span style="font-size:12px;color:var(--warm-gray)">${esc(b)}</span></span></div>`).join('')}
    </div>
    <div class="section-title" style="margin-top:16px">Titles</div>
    <div class="card" style="padding:4px 16px">${rungs}</div>`, { tall: true });
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
