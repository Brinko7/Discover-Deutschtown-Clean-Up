// Another neighbor's public profile, opened from the leaderboard, the feed or a
// zone's adopters. Everything on it comes from the server's get_public_profile().
import { ZONE_MASCOTS, zoneById, blockById, formatMinutes } from '../data.js';
import { colorFor } from '../store.js';
import { fetchPublicProfile, sendReport } from '../backend.js';
import { levelInfo } from '../levels.js';
import { esc, openSheet, closeSheet, toast, levelCard } from '../ui.js';
import { tapHaptic } from '../native.js';
import { navigate } from '../main.js';

export function initials(name) {
  return String(name || '?').slice(0, 2).toUpperCase();
}

// Names that are not a person's profile: the feed uses these for hidden names.
const NOT_A_PROFILE = ['Anonymous', 'Neighbor'];

// Makes everything with data-username inside root open that neighbor's profile.
// `back` lets the sheet return to where it was opened from.
export function bindUserLinks(root, { back } = {}) {
  root.querySelectorAll('[data-username]').forEach((el) => {
    el.addEventListener('click', () => {
      tapHaptic();
      openUserProfile(el.dataset.username, { back });
    });
  });
}

export function userLinkAttr(username) {
  return username && !NOT_A_PROFILE.includes(username) ? `data-username="${esc(username)}"` : '';
}

function backButton(back) {
  return back ? '<button class="btn btn--ghost btn--sm" data-back style="margin-bottom:10px">← Back</button>' : '';
}

function bindBack(wrap, back) {
  wrap.querySelector('[data-back]')?.addEventListener('click', () => {
    tapHaptic();
    back();
  });
}

function profileHtml(p, back) {
  const info = levelInfo(p.xp);
  const since = new Date(p.member_since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const visited = new Set(p.zones || []);
  const mascots = ZONE_MASCOTS.filter((m) => visited.has(m.zoneId));
  const zones = (p.adopted_zones || []).map(zoneById).filter(Boolean);
  const blocks = (p.adopted_blocks || []).map(blockById).filter(Boolean);
  const streak = Number(p.streak_weeks) || 0;

  return `
    ${backButton(back)}
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <div class="lb-avatar" style="width:52px;height:52px;font-size:19px;background:${colorFor(p.username)}">${esc(initials(p.username))}</div>
      <div style="min-width:0">
        <h2 class="sheet-title" style="margin:0;overflow-wrap:anywhere">${esc(p.username)}</h2>
        <div style="font-size:12.5px;color:var(--warm-gray)">Neighbor since ${esc(since)}${streak >= 2 ? ` · 🔥 ${streak} week streak` : ''}</div>
      </div>
    </div>
    ${levelCard(info, { interactive: false })}
    ${p.is_hidden ? `
      <p class="sheet-sub" style="margin-top:12px">🔒 This neighbor keeps their profile private.</p>` : `
      <div class="stat-row" style="margin-top:12px">
        <div class="stat-tile" style="box-shadow:none"><div class="stat-value" style="font-size:17px">${Number(p.points)}</div><div class="stat-label">Points</div></div>
        <div class="stat-tile" style="box-shadow:none"><div class="stat-value" style="font-size:17px">${esc(formatMinutes(Number(p.minutes)))}</div><div class="stat-label">Cleaned</div></div>
        <div class="stat-tile" style="box-shadow:none"><div class="stat-value" style="font-size:17px">${Number(p.sessions)}</div><div class="stat-label">Cleanups</div></div>
      </div>`}
    ${zones.length ? `
      <div class="section-title" style="margin-top:16px">Adopted zones</div>
      <div class="card" style="padding:4px 16px">
        ${zones.map((z) => `
          <button class="list-row" data-zone="${z.id}">
            <span class="row-icon">${z.emoji}</span>
            <span><b style="font-family:var(--font-display)">${esc(z.name)}</b></span>
          </button>`).join('')}
      </div>` : ''}
    ${blocks.length ? `
      <div class="section-title" style="margin-top:16px">Adopted blocks</div>
      <div class="card" style="padding:4px 16px">
        ${blocks.map((b) => `<div class="list-row" style="cursor:default"><span class="row-icon">🏠</span><span>${esc(b.name)}</span></div>`).join('')}
      </div>` : ''}
    ${mascots.length ? `
      <div class="section-title" style="margin-top:16px">Mascot badges <span style="font-weight:400;font-size:12px;color:var(--warm-gray)">${mascots.length}/${ZONE_MASCOTS.length}</span></div>
      <div class="mascot-grid">
        ${mascots.map((m) => `
          <div class="mascot-tile">
            <div class="mascot-emoji">${m.emoji}</div>
            <div class="mascot-name">${esc(m.name)}</div>
            <div class="mascot-zone">${esc(zoneById(m.zoneId)?.name || '')}</div>
          </div>`).join('')}
      </div>` : ''}
    <button class="onboard-skip" id="user-report" style="color:var(--warm-gray);margin-top:16px;width:100%">Report this neighbor</button>`;
}

function openReportSheet(username, reopen) {
  const reasons = ['Offensive username', 'Harassing or threatening', 'Pretending to be someone else', 'Faking cleanups'];
  const wrap = openSheet(`
    <h2 class="sheet-title">Report ${esc(username)}</h2>
    <p class="sheet-sub">Organizers will take a look. ${esc(username)} won't be told who reported them.</p>
    <div class="card" style="padding:4px 16px">
      ${reasons.map((r) => `<button class="list-row" data-reason="${esc(r)}"><span>${esc(r)}</span></button>`).join('')}
    </div>
    <button class="btn btn--ghost btn--block" id="report-cancel" style="margin-top:10px">Never mind</button>`);
  wrap.querySelector('#report-cancel').addEventListener('click', () => reopen());
  wrap.querySelectorAll('[data-reason]').forEach((el) => {
    el.addEventListener('click', async () => {
      tapHaptic();
      const sent = await sendReport(username, el.dataset.reason);
      closeSheet();
      toast(sent ? 'Thanks. Organizers will take a look.' : 'Could not send that. Check your connection and try again.', { emoji: sent ? '✅' : '📡' });
    });
  });
}

export async function openUserProfile(username, { back } = {}) {
  const wrap = openSheet(`${backButton(back)}<div class="empty-state" style="padding:24px 8px"><p>Loading ${esc(username)}…</p></div>`, { tall: true });
  bindBack(wrap, back);
  const content = wrap.querySelector('.sheet-content');
  const { profile, error } = await fetchPublicProfile(username);
  if (!wrap.isConnected) return; // closed while waiting

  if (profile?.is_you) {
    navigate('profile');
    return;
  }
  if (!profile) {
    content.innerHTML = `${backButton(back)}<div class="empty-state" style="padding:24px 8px"><div class="empty-emoji">${error ? '📡' : '🤷'}</div><p>${error ? 'Could not load this profile. Check your connection and try again.' : "This neighbor's profile isn't available."}</p></div>`;
    bindBack(wrap, back);
    return;
  }

  content.innerHTML = profileHtml(profile, back);
  bindBack(wrap, back);
  content.querySelectorAll('[data-zone]').forEach((el) => {
    el.addEventListener('click', () => {
      tapHaptic();
      navigate('map', { zoneId: el.dataset.zone });
    });
  });
  content.querySelector('#user-report').addEventListener('click', () => {
    tapHaptic();
    openReportSheet(profile.username, () => openUserProfile(profile.username, { back }));
  });
}
