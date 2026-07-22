import { HOT_SPOTS, ZONES, zoneById, formatMinutes, MIXER, VENMO_HANDLE } from '../data.js';
import { getState, activityFeed, timeAgo } from '../store.js';
import { icon, esc, openSheet, closeSheet, toast } from '../ui.js';
import { icons } from '../icons.js';
import { tapHaptic, shareApp } from '../native.js';
import { navigate } from '../main.js';

function initials(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function hotZoneCards() {
  const rows = [];
  const add = (ids, tier) => ids.forEach((id) => {
    const z = zoneById(id);
    if (z) rows.push({ z, tier });
  });
  add(HOT_SPOTS.hottest.ids, HOT_SPOTS.hottest);
  add(HOT_SPOTS.hot.ids, HOT_SPOTS.hot);
  return rows
    .map(({ z, tier }) => `
      <div class="card card--tappable hot-card" data-goto-zone="${z.id}">
        <div class="hot-emoji">${z.emoji}</div>
        <div>
          <div style="font-family:var(--font-display);font-weight:700;font-size:14.5px">${esc(z.name)}</div>
          <div style="font-size:12px;color:var(--warm-gray)">${tier.label} · needs extra hands</div>
        </div>
        <div class="hot-mult">${tier.short}</div>
      </div>`)
    .join('');
}

function feedHtml() {
  return activityFeed()
    .slice(0, 6)
    .map((a) => {
      const what = a.type === 'adopt'
        ? `adopted <b>${esc(a.blockName || a.zoneName)}</b>`
        : `cleaned <b>${esc(a.blockName || a.zoneName)}</b>${a.bags ? ` · ${a.bags} bag${a.bags === 1 ? '' : 's'}` : ''}`;
      return `
        <div class="feed-item">
          <div class="feed-avatar" style="background:${a.color || '#5a6472'}">${a.anonymous ? '🕶️' : esc(initials(a.name || '?')) || '?'}</div>
          <div class="feed-text"><b>${esc(a.isYou && !a.anonymous ? 'You' : a.name)}</b> ${what}</div>
          <div class="feed-time">${timeAgo(a.ts)}</div>
        </div>`;
    })
    .join('');
}

function openDonateSheet() {
  let amount = 25;
  const wrap = openSheet(`
    <h2 class="sheet-title">💚 Support the cleanups</h2>
    <p class="sheet-sub">Donations buy bags, gloves, and grabbers for volunteers. Every dollar stays in the neighborhood.</p>
    <div class="area-chip-row" id="donate-amounts">
      ${[10, 25, 50, 100].map((v) => `<button class="chip ${v === 25 ? 'chip--selected' : ''}" data-amount="${v}">$${v}</button>`).join('')}
    </div>
    <div style="height:14px"></div>
    <button class="btn btn--primary btn--block" id="donate-go">Donate $25 via Venmo</button>
    <p style="font-size:12px;color:var(--warm-gray);text-align:center;margin-top:10px">Opens the Venmo app · @${VENMO_HANDLE}</p>`);

  wrap.querySelectorAll('[data-amount]').forEach((btn) => {
    btn.addEventListener('click', () => {
      tapHaptic();
      amount = Number(btn.dataset.amount);
      wrap.querySelectorAll('[data-amount]').forEach((b) => b.classList.toggle('chip--selected', b === btn));
      wrap.querySelector('#donate-go').textContent = `Donate $${amount} via Venmo`;
    });
  });
  wrap.querySelector('#donate-go').addEventListener('click', () => {
    tapHaptic();
    const note = encodeURIComponent('Deutschtown cleanup supplies 💚');
    window.open(`https://venmo.com/${VENMO_HANDLE}?txn=pay&amount=${amount}&note=${note}`, '_blank');
  });
}

export function renderHome(root) {
  const s = getState();
  const name = s.profile.name || 'Neighbor';
  const hasStats = s.profile.sessions > 0;

  root.innerHTML = `
    <div class="screen">
      <header class="screen-header">
        <div>
          <p class="screen-subtitle" style="margin:0 0 2px">📍 Deutschtown, Pittsburgh</p>
          <h1 class="screen-title">Hi, ${esc(name.split(' ')[0])} 👋</h1>
        </div>
      </header>

      <div class="section">
        <div class="card hero-card">
          <div class="hero-blob" style="width:190px;height:190px;top:-70px;right:-60px"></div>
          <div class="hero-blob" style="width:110px;height:110px;bottom:-45px;left:-35px"></div>
          <div class="eyebrow">This week</div>
          <h2>${hasStats ? 'Keep your streak going.' : 'Keep our streets clean together.'}</h2>
          <p>${hasStats ? 'Every check-in keeps the neighborhood on the map.' : 'Check in when you clean. Earn points. Watch the neighborhood glow up.'}</p>
          <div style="display:flex;gap:10px">
            <button class="btn btn--primary" id="hero-checkin" style="background:var(--green-light);color:var(--charcoal)">${icon('sparkle')} Check in now</button>
            <button class="btn btn--ghost" id="hero-map" style="color:#fff;border-color:rgba(255,255,255,.35)">View map</button>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="stat-row">
          <div class="stat-tile">
            <div class="stat-value">${s.profile.points}</div>
            <div class="stat-label">Your points</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">${esc(formatMinutes(s.profile.minutes))}</div>
            <div class="stat-label">Time cleaned</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">${s.profile.bags % 1 ? s.profile.bags.toFixed(1) : s.profile.bags}</div>
            <div class="stat-label">Bags collected</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">🔥 Hot blocks this week</div>
        ${hotZoneCards()}
      </div>

      <div class="section">
        <div class="section-title">Recent activity</div>
        <div class="card">${feedHtml()}</div>
      </div>

      <div class="section">
        <div class="section-title">Get involved</div>
        <div class="card" style="padding:4px 16px">
          <button class="list-row" id="row-donate">
            <span class="row-icon">${icons.heart}</span>
            <span><b style="font-family:var(--font-display)">Support the cleanups</b><br><span style="font-size:12px;color:var(--warm-gray)">Chip in for bags, gloves &amp; grabbers</span></span>
            <span class="row-chevron">${icons.chevronRight}</span>
          </button>
          <button class="list-row" id="row-share">
            <span class="row-icon">${icons.share}</span>
            <span><b style="font-family:var(--font-display)">Spread the word</b><br><span style="font-size:12px;color:var(--warm-gray)">Invite a neighbor to join in</span></span>
            <span class="row-chevron">${icons.chevronRight}</span>
          </button>
          <button class="list-row" id="row-mixer">
            <span class="row-icon">🥨</span>
            <span><b style="font-family:var(--font-display)">Quarterly mixer</b><br><span style="font-size:12px;color:var(--warm-gray)">You clean? You're invited.</span></span>
            <span class="row-chevron">${icons.chevronRight}</span>
          </button>
        </div>
      </div>
    </div>`;

  root.querySelector('#hero-checkin').addEventListener('click', () => {
    tapHaptic();
    navigate('checkin');
  });
  root.querySelector('#hero-map').addEventListener('click', () => {
    tapHaptic();
    navigate('map');
  });
  root.querySelectorAll('[data-goto-zone]').forEach((el) => {
    el.addEventListener('click', () => {
      tapHaptic();
      navigate('map', { zoneId: el.dataset.gotoZone });
    });
  });
  root.querySelector('#row-donate').addEventListener('click', () => {
    tapHaptic();
    openDonateSheet();
  });
  root.querySelector('#row-share').addEventListener('click', async () => {
    tapHaptic();
    const res = await shareApp();
    if (res === 'copied') toast('Invite link copied to clipboard', { emoji: '🔗' });
  });
  root.querySelector('#row-mixer').addEventListener('click', () => {
    tapHaptic();
    openSheet(`
      <h2 class="sheet-title">🥨 You clean. You're invited.</h2>
      <p class="sheet-sub">${esc(MIXER.blurb)}</p>
      <div class="card" style="background:var(--green-pale);border-color:var(--green-light)">
        <b style="font-family:var(--font-display)">Hosted by ${esc(MIXER.host)}</b>
        <p style="font-size:13px;color:var(--warm-gray);margin-top:4px">Date and venue announced each quarter — check in at least once to get the invite.</p>
      </div>
      <div style="height:12px"></div>
      <button class="btn btn--secondary btn--block" data-close-mixer>Sounds fun</button>`)
      .querySelector('[data-close-mixer]')
      .addEventListener('click', () => closeSheet());
  });
}
