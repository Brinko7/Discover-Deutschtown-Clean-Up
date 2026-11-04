// The zone clipboard: every zone, who has adopted it, and which are still open.
// Opened from the map and from Home. Adopters come from the server (see store.js).
import { ZONES, ROADWAY_ZONES, ZONE_ADOPTION } from '../data.js';
import { zoneAdopters, refreshRemote, colorFor } from '../store.js';
import { bindUserLinks, initials, userLinkAttr } from './user.js';
import { esc, openSheet, closeSheet } from '../ui.js';
import { tapHaptic } from '../native.js';
import { navigate } from '../main.js';

function adopterChips(list) {
  return list.map((a) => `
    <span class="chip" style="cursor:${a.isYou ? 'default' : 'pointer'};gap:6px" ${a.isYou ? '' : userLinkAttr(a.username)}>
      <span class="lb-avatar" style="width:20px;height:20px;font-size:9px;background:${a.isYou ? '#2d6a4f' : colorFor(a.username)}">${esc(initials(a.username))}</span>
      ${esc(a.isYou ? 'You' : a.username)}
    </span>`).join('');
}

function zoneRow(z) {
  const roadway = ROADWAY_ZONES.includes(z.id);
  const list = roadway ? [] : zoneAdopters(z.id);
  let status;
  let body = '';
  if (roadway) {
    status = '<span class="badge" style="margin-left:auto">Not adoptable</span>';
  } else if (!list) {
    status = '<span class="badge" style="margin-left:auto">…</span>';
  } else if (!list.length) {
    status = '<span class="badge badge--hot" style="margin-left:auto">Open</span>';
  } else {
    status = `<span class="badge badge--rsvp" style="margin-left:auto">${list.length} adopter${list.length === 1 ? '' : 's'}</span>`;
    body = `<div class="area-chip-row" style="margin-top:8px">${adopterChips(list)}</div>`;
  }
  return `
    <div style="padding:12px 0;border-bottom:1px solid var(--line, #eee6d8)">
      <button class="list-row" data-clip-zone="${z.id}" style="padding:0;border:none;width:100%">
        <span class="row-icon">${z.emoji}</span>
        <b style="font-family:var(--font-display)">${esc(z.name)}</b>
        ${status}
      </button>
      ${body}
    </div>`;
}

export function openClipboard({ onZone } = {}) {
  refreshRemote();
  const open = ZONES.filter((z) => !ROADWAY_ZONES.includes(z.id) && zoneAdopters(z.id)?.length === 0).length;
  const known = zoneAdopters('z1') !== null;
  const wrap = openSheet(`
    <h2 class="sheet-title">📋 Zone clipboard</h2>
    <p class="sheet-sub">${known
      ? `${open ? `${open} zone${open === 1 ? ' is' : 's are'} still open.` : 'Every zone has an adopter.'} Anyone can adopt a zone and look after it with a cleanup at least every ${ZONE_ADOPTION.commitmentDays} days. Many neighbors can share one.`
      : 'Could not load who adopted what. Check your connection.'}</p>
    <div class="card" style="padding:0 16px">${ZONES.map(zoneRow).join('')}</div>`, { tall: true });

  const goZone = onZone || ((id) => navigate('map', { zoneId: id }));
  wrap.querySelectorAll('[data-clip-zone]').forEach((el) => {
    el.addEventListener('click', () => {
      tapHaptic();
      closeSheet();
      goZone(el.dataset.clipZone);
    });
  });
  bindUserLinks(wrap, { back: () => openClipboard({ onZone }) });
}
