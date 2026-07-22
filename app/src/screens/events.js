import { SCHEDULE, PAST_EVENTS, zoneById, getHotSpot } from '../data.js';
import { getState, toggleRsvp } from '../store.js';
import { icon, esc, openSheet, closeSheet, toast } from '../ui.js';
import { icons } from '../icons.js';
import { tapHaptic, successHaptic, shareApp } from '../native.js';
import { navigate } from '../main.js';

let activeSeg = 'upcoming';

function eventCard(ev, rsvped) {
  return `
    <div class="card card--tappable" data-event="${ev.id}">
      <div class="event-card">
        <div class="event-date">
          <div class="ed-month">${ev.month}</div>
          <div class="ed-day">${ev.day}</div>
        </div>
        <div class="event-info">
          <div class="event-name">${esc(ev.zone)}</div>
          <div class="event-meta">
            <span>🕘 ${ev.time} · ${ev.duration}</span>
            <span>👥 ${ev.spots} spots</span>
          </div>
          <div style="margin-top:7px;display:flex;gap:6px;flex-wrap:wrap">
            ${ev.sponsored ? '<span class="badge badge--sponsored">⭐ Sponsored</span>' : ''}
            ${ev.recurring ? '<span class="badge badge--rsvp">🔁 Weekly</span>' : ''}
            ${rsvped ? '<span class="badge badge--rsvp">✓ Going</span>' : ''}
          </div>
        </div>
        <span class="row-chevron" style="align-self:center;color:#b6c3bc">${icons.chevronRight}</span>
      </div>
    </div>`;
}

function pastCard(ev) {
  return `
    <div class="card">
      <div class="event-card">
        <div class="event-date" style="background:#eef1f4;color:var(--warm-gray)">
          <div class="ed-month">${ev.month}</div>
          <div class="ed-day">${ev.day}</div>
        </div>
        <div class="event-info">
          <div class="event-name">${esc(ev.zone)}</div>
          <div class="event-meta">
            <span>👥 ${ev.volunteers} volunteers</span>
            <span>🗑️ ${ev.bags} bags</span>
            <span>🕘 ${ev.duration}</span>
          </div>
        </div>
      </div>
    </div>`;
}

function openEventSheet(ev) {
  const s = getState();
  const rsvped = s.rsvps.includes(ev.id);
  const zone = ev.zoneId ? zoneById(ev.zoneId) : null;
  const hot = ev.zoneId ? getHotSpot(ev.zoneId) : null;

  const wrap = openSheet(`
    <h2 class="sheet-title">${esc(ev.zone)}</h2>
    <p class="sheet-sub">${ev.month} ${ev.day} · ${ev.time} · ${ev.duration}${ev.recurring ? ' · repeats weekly' : ''}</p>

    ${ev.sponsored ? `
      <div class="card" style="background:#fff7f2;border-color:#ffd9c2;margin-bottom:12px">
        <b style="font-family:var(--font-display)">⭐ Sponsored by ${esc(ev.organizer)}</b>
        <p style="font-size:13px;color:var(--warm-gray);margin-top:4px">${esc(ev.prize)}</p>
      </div>` : ''}

    <div class="card" style="padding:4px 16px;margin-bottom:12px">
      <div class="list-row" style="cursor:default">
        <span class="row-icon">${icons.location}</span>
        <span><b style="font-family:var(--font-display);font-size:13.5px">Meeting point</b><br><span style="font-size:13px;color:var(--warm-gray)">${esc(ev.meeting)}</span></span>
      </div>
      <div class="list-row" style="cursor:default">
        <span class="row-icon">${icons.gift}</span>
        <span><b style="font-family:var(--font-display);font-size:13.5px">Supplies provided</b><br><span style="font-size:13px;color:var(--warm-gray)">${esc(ev.supplies)}</span></span>
      </div>
      <div class="list-row" style="cursor:default">
        <span class="row-icon">${icons.users}</span>
        <span><b style="font-family:var(--font-display);font-size:13.5px">${ev.spots} volunteer spots</b>${hot ? `<br><span style="font-size:13px;color:var(--amber)">🔥 This zone pays ${hot.short} right now</span>` : ''}</span>
      </div>
    </div>

    <button class="btn ${rsvped ? 'btn--secondary' : 'btn--primary'} btn--block" id="ev-rsvp">
      ${rsvped ? '✓ You\'re going — tap to cancel' : 'Count me in'}
    </button>
    <div style="height:8px"></div>
    <div style="display:flex;gap:8px">
      ${zone ? `<button class="btn btn--ghost" style="flex:1" id="ev-map">${icon('map')} View zone</button>` : ''}
      <button class="btn btn--ghost" style="flex:1" id="ev-share">${icon('share')} Share</button>
    </div>`);

  wrap.querySelector('#ev-rsvp').addEventListener('click', () => {
    const nowGoing = toggleRsvp(ev.id);
    if (nowGoing) {
      successHaptic();
      toast('See you there! 🎉');
    } else {
      tapHaptic();
      toast('RSVP cancelled');
    }
    closeSheet();
    navigate('events');
  });
  wrap.querySelector('#ev-map')?.addEventListener('click', () => {
    tapHaptic();
    closeSheet();
    navigate('map', { zoneId: ev.zoneId });
  });
  wrap.querySelector('#ev-share').addEventListener('click', async () => {
    tapHaptic();
    const res = await shareApp(`Join me at the ${ev.zone} cleanup on ${ev.month} ${ev.day} at ${ev.time} — meet at ${ev.meeting}.`);
    if (res === 'copied') toast('Event details copied', { emoji: '🔗' });
  });
}

export function renderEvents(root) {
  const s = getState();

  const paint = () => {
    let listHtml = '';
    if (activeSeg === 'upcoming') {
      listHtml = SCHEDULE.map((ev) => eventCard(ev, s.rsvps.includes(ev.id))).join('');
    } else if (activeSeg === 'mine') {
      const mine = SCHEDULE.filter((ev) => s.rsvps.includes(ev.id));
      listHtml = mine.length
        ? mine.map((ev) => eventCard(ev, true)).join('')
        : `<div class="empty-state"><div class="empty-emoji">🗓️</div><p>No RSVPs yet.<br>Tap an event and hit "Count me in".</p></div>`;
    } else {
      listHtml = PAST_EVENTS.map(pastCard).join('');
    }

    root.innerHTML = `
      <div class="screen">
        <header class="screen-header">
          <div>
            <h1 class="screen-title">Events</h1>
            <p class="screen-subtitle">Group cleanups — supplies provided</p>
          </div>
        </header>
        <div class="segmented">
          <button data-seg="upcoming" class="${activeSeg === 'upcoming' ? 'seg--active' : ''}">Upcoming</button>
          <button data-seg="mine" class="${activeSeg === 'mine' ? 'seg--active' : ''}">My events</button>
          <button data-seg="past" class="${activeSeg === 'past' ? 'seg--active' : ''}">Past</button>
        </div>
        <div class="section">${listHtml}</div>
      </div>`;

    root.querySelectorAll('[data-seg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        tapHaptic();
        activeSeg = btn.dataset.seg;
        paint();
      });
    });
    root.querySelectorAll('[data-event]').forEach((el) => {
      el.addEventListener('click', () => {
        tapHaptic();
        const ev = SCHEDULE.find((e) => e.id === el.dataset.event);
        if (ev) openEventSheet(ev);
      });
    });
  };

  paint();
}
