import { MOCK_LEADERS, ZONE_MASCOTS, zoneById, blockById, formatMinutes, ADOPTION_RULES } from '../data.js';
import { getState, setProfileName, timeAgo } from '../store.js';
import { icon, esc, openSheet, closeSheet, toast } from '../ui.js';
import { icons } from '../icons.js';
import { tapHaptic, shareApp } from '../native.js';

function initials(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '🙂';
}

function leaderboardData() {
  const s = getState();
  const you = {
    id: 'you',
    full_name: s.profile.name || 'You',
    points: s.profile.points,
    isYou: true,
    _color: '#2d6a4f',
  };
  return [...MOCK_LEADERS, you].sort((a, b) => b.points - a.points);
}

function podiumHtml(top3) {
  const order = [top3[1], top3[0], top3[2]]; // 2nd | 1st | 3rd
  const medals = ['🥈', '🥇', '🥉'];
  const cls = ['podium-2', 'podium-1', 'podium-3'];
  return `
    <div class="podium">
      ${order.map((p, i) => p ? `
        <div class="podium-col ${cls[i]}">
          <div class="podium-avatar" style="background:${p._color}">
            ${i === 1 ? '<span class="crown">👑</span>' : ''}
            ${esc(initials(p.full_name))}
          </div>
          <div class="podium-name">${medals[i]} ${esc(p.isYou ? 'You' : p.full_name.split(' ')[0])}</div>
          <div class="podium-pts">${p.points} pts</div>
        </div>` : '').join('')}
    </div>`;
}

function historySheet() {
  const s = getState();
  const rows = s.checkins.length
    ? s.checkins.map((c) => {
        const zone = zoneById(c.zoneIds[0]);
        return `
          <div class="feed-item">
            <div class="feed-avatar" style="background:var(--green-pale);color:var(--green-dark)">${zone?.emoji || '🧹'}</div>
            <div class="feed-text">
              <b>${esc(zone?.name || 'Cleanup')}</b>${c.blockNames?.length ? ' · ' + esc(c.blockNames.join(', ')) : ''}<br>
              <span style="color:var(--warm-gray);font-size:12px">${c.minutes} min · ${c.bags || 0} bags · +${c.points} pts${c.multiplier > 1 ? ` (${c.multiplier}×)` : ''}</span>
              ${c.photos?.length ? `<div class="photo-strip" style="margin-top:6px">${c.photos.map((p) => `<img class="photo-thumb" src="${p}" style="width:56px;height:56px" alt="Cleanup photo" />`).join('')}</div>` : ''}
            </div>
            <div class="feed-time">${timeAgo(c.ts)}</div>
          </div>`;
      }).join('')
    : `<div class="empty-state"><div class="empty-emoji">🧹</div><p>No check-ins yet — your history will show up here.</p></div>`;
  openSheet(`<h2 class="sheet-title">Your cleanups</h2><div class="card" style="margin-top:8px">${rows}</div>`, { tall: s.checkins.length > 3 });
}

function editNameSheet(rerender) {
  const s = getState();
  const wrap = openSheet(`
    <h2 class="sheet-title">Your name</h2>
    <p class="sheet-sub">Shown on the leaderboard and activity feed.</p>
    <input class="text-input" id="name-input" value="${esc(s.profile.name)}" maxlength="30" placeholder="Your name" />
    <div style="height:12px"></div>
    <button class="btn btn--primary btn--block" id="name-save">Save</button>`);
  const save = () => {
    const v = wrap.querySelector('#name-input').value.trim();
    if (!v) return toast('Enter a name first');
    setProfileName(v);
    closeSheet();
    toast('Name updated', { emoji: '✅' });
    rerender();
  };
  wrap.querySelector('#name-save').addEventListener('click', save);
  wrap.querySelector('#name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
  });
}

export function renderProfile(root) {
  const s = getState();
  const leaders = leaderboardData();
  const youRank = leaders.findIndex((l) => l.isYou) + 1;
  const unlocked = new Set(s.mascots);

  const rerender = () => renderProfile(root);

  root.innerHTML = `
    <div class="screen">
      <header class="screen-header">
        <div>
          <h1 class="screen-title">You</h1>
        </div>
        <button class="btn btn--ghost btn--sm" id="btn-edit-name">${icon('edit')} Edit</button>
      </header>

      <div class="section">
        <div class="card profile-hero">
          <div class="profile-avatar">${esc(initials(s.profile.name || ''))}</div>
          <div class="profile-name">${esc(s.profile.name || 'Neighbor')}</div>
          <div style="font-size:12.5px;opacity:.8;margin-top:2px">Deutschtown · Rank #${youRank} on the board</div>
          <div class="profile-stats">
            <div><div class="stat-value">${s.profile.points}</div><div class="stat-label">Points</div></div>
            <div><div class="stat-value">${esc(formatMinutes(s.profile.minutes))}</div><div class="stat-label">Cleaned</div></div>
            <div><div class="stat-value">${s.profile.bags % 1 ? s.profile.bags.toFixed(1) : s.profile.bags}</div><div class="stat-label">Bags</div></div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">🏆 Leaderboard</div>
        <div class="card">
          ${podiumHtml(leaders.slice(0, 3))}
          <div style="margin-top:8px">
            ${leaders.slice(3, 11).map((p, i) => `
              <div class="lb-row ${p.isYou ? 'lb-row--you' : ''}">
                <div class="lb-rank">${i + 4}</div>
                <div class="lb-avatar" style="background:${p._color}">${esc(initials(p.full_name))}</div>
                <div class="lb-name">${esc(p.isYou ? (p.full_name === 'You' ? 'You' : p.full_name + ' (you)') : p.full_name)}</div>
                ${p.streak_weeks >= 3 ? '<span class="badge badge--hot">🔥</span>' : ''}
                <div class="lb-pts">${p.points}</div>
              </div>`).join('')}
            ${youRank > 11 ? (() => {
              const you = leaders[youRank - 1];
              return `
                <div class="lb-row lb-row--you" style="margin-top:6px">
                  <div class="lb-rank">${youRank}</div>
                  <div class="lb-avatar" style="background:${you._color}">${esc(initials(you.full_name))}</div>
                  <div class="lb-name">${esc(you.full_name === 'You' ? 'You' : you.full_name + ' (you)')}</div>
                  <div class="lb-pts">${you.points}</div>
                </div>`;
            })() : ''}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Mascot badges <span style="font-weight:400;font-size:12px;color:var(--warm-gray)">${unlocked.size}/${ZONE_MASCOTS.length}</span></div>
        <div class="mascot-grid">
          ${ZONE_MASCOTS.map((m) => {
            const has = unlocked.has(m.zoneId);
            const zone = zoneById(m.zoneId);
            return `
              <div class="mascot-tile ${has ? '' : 'mascot-tile--locked'}">
                <div class="mascot-emoji">${has ? m.emoji : '🔒'}</div>
                <div class="mascot-name">${esc(has ? m.name : '???')}</div>
                <div class="mascot-zone">${esc(zone?.name || '')}</div>
              </div>`;
          }).join('')}
        </div>
        <p style="font-size:12px;color:var(--warm-gray);margin-top:8px;text-align:center">Clean a zone once to meet its mascot.</p>
      </div>

      ${s.adoptions.length ? `
        <div class="section">
          <div class="section-title">🏠 Your adopted blocks</div>
          <div class="card" style="padding:4px 16px">
            ${s.adoptions.map((a) => {
              const b = blockById(a.blockId);
              return `<div class="list-row" style="cursor:default"><span class="row-icon">🏠</span><span><b style="font-family:var(--font-display)">${esc(b?.name || a.blockId)}</b><br><span style="font-size:12px;color:var(--warm-gray)">${ADOPTION_RULES.pointsMultiplier}× points here · adopted ${timeAgo(a.adoptedAt)}</span></span></div>`;
            }).join('')}
          </div>
        </div>` : ''}

      <div class="section">
        <div class="card" style="padding:4px 16px">
          <button class="list-row" id="row-history">
            <span class="row-icon">${icons.clock}</span>
            <span><b style="font-family:var(--font-display)">Cleanup history</b><br><span style="font-size:12px;color:var(--warm-gray)">${s.profile.sessions} session${s.profile.sessions === 1 ? '' : 's'} logged</span></span>
            <span class="row-chevron">${icons.chevronRight}</span>
          </button>
          <button class="list-row" id="row-invite">
            <span class="row-icon">${icons.share}</span>
            <span><b style="font-family:var(--font-display)">Invite a neighbor</b><br><span style="font-size:12px;color:var(--warm-gray)">More hands, cleaner blocks</span></span>
            <span class="row-chevron">${icons.chevronRight}</span>
          </button>
          <button class="list-row" id="row-about">
            <span class="row-icon">${icons.info}</span>
            <span><b style="font-family:var(--font-display)">About Mind Your Block</b></span>
            <span class="row-chevron">${icons.chevronRight}</span>
          </button>
        </div>
      </div>
    </div>`;

  root.querySelector('#btn-edit-name').addEventListener('click', () => {
    tapHaptic();
    editNameSheet(rerender);
  });
  root.querySelector('#row-history').addEventListener('click', () => {
    tapHaptic();
    historySheet();
  });
  root.querySelector('#row-invite').addEventListener('click', async () => {
    tapHaptic();
    const res = await shareApp();
    if (res === 'copied') toast('Invite link copied', { emoji: '🔗' });
  });
  root.querySelector('#row-about').addEventListener('click', () => {
    tapHaptic();
    openSheet(`
      <h2 class="sheet-title">🌿 Mind Your Block</h2>
      <p class="sheet-sub">A neighborhood cleanup platform for Deutschtown / East Allegheny, Pittsburgh.</p>
      <div class="card" style="margin-bottom:10px">
        <b style="font-family:var(--font-display)">What we do</b>
        <p style="font-size:13.5px;color:var(--warm-gray);margin-top:4px;line-height:1.5">Neighbors check in when they clean, earn points for their time, and adopt the blocks they love. Local businesses sponsor events, and everyone who pitches in gets invited to the quarterly mixer.</p>
      </div>
      <div class="card">
        <b style="font-family:var(--font-display)">Why it matters</b>
        <p style="font-size:13.5px;color:var(--warm-gray);margin-top:4px;line-height:1.5">Clean blocks feel safer, bring neighbors together, and show off the best of the North Side. Small, steady effort — multiplied by a whole neighborhood.</p>
      </div>
      <p style="font-size:12px;color:var(--warm-gray);text-align:center;margin-top:14px">Questions or ideas? hello@mindyourblock.org</p>`);
  });
}
