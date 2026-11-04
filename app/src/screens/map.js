import L from 'leaflet';
import {
  MAP_CENTER, MAP_ZOOM, TILE_URL, TILE_URL_FALLBACK, TILE_ATTRIBUTION,
  ZONES, ZONE_POLYGONS, ZONE_META, STATUS_STYLE,
  getZoneStatus, getHotSpot, blocksForZone, ZONE_ADOPTION, ROADWAY_ZONES,
} from '../data.js';
import {
  getState, colorFor, refreshRemote, zoneAdopters, myZoneAdoption, zoneAdoptionLapsed, zoneAdoptBlocker, adoptZone, leaveZone,
} from '../store.js';
import { bindUserLinks, initials, userLinkAttr } from './user.js';
import { openClipboard } from './clipboard.js';
import { icon, esc, openSheet, closeSheet, toast } from '../ui.js';
import { icons } from '../icons.js';
import { tapHaptic, getPosition, locateArea } from '../native.js';
import { navigate } from '../main.js';

let map = null;
let userMarker = null;

function adoptersHtml(adopters) {
  if (!adopters) {
    return '<p style="font-size:13px;color:var(--warm-gray);padding:12px 0">Could not load who adopted this zone. Check your connection.</p>';
  }
  if (!adopters.length) {
    return '<p style="font-size:13px;color:var(--warm-gray);padding:12px 0">Nobody has adopted this zone yet. It could be you.</p>';
  }
  return adopters.map((a) => `
    <div class="lb-row" ${a.isYou ? '' : userLinkAttr(a.username)}>
      <div class="lb-avatar" style="background:${a.isYou ? '#2d6a4f' : colorFor(a.username)}">${esc(initials(a.username))}</div>
      <div class="lb-name">${esc(a.isYou ? 'You' : a.username)}
        <div style="font-family:var(--font-body);font-weight:400;font-size:12px;color:var(--warm-gray)">Since ${esc(new Date(a.since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }))}</div>
      </div>
      <span class="lb-lv">Lv ${a.level}</span>
      ${a.isYou ? '' : `<span class="row-chevron">${icons.chevronRight}</span>`}
    </div>`).join('');
}

// What you can do about this zone: adopt it, or see why you can't yet.
function adoptControlHtml(zoneId, adopters) {
  if (!adopters) return ''; // the server has not answered: adopting now could not be sent
  const mine = myZoneAdoption(zoneId);
  if (mine && zoneAdoptionLapsed(mine)) {
    return `
      <p style="font-size:13px;color:var(--warm-gray);margin:10px 0">Your adoption lapsed after ${ZONE_ADOPTION.lapseDays} days without a cleanup. Clean here to pick it back up.</p>
      <button class="btn btn--ghost btn--block" id="zone-leave">Stop adopting this zone</button>`;
  }
  if (mine) {
    return `
      <p style="font-size:13px;color:var(--warm-gray);margin:10px 0">Thanks for looking after this zone. The promise is a cleanup at least every ${ZONE_ADOPTION.commitmentDays} days.</p>
      <button class="btn btn--ghost btn--block" id="zone-leave">Stop adopting this zone</button>`;
  }
  const blocked = zoneAdoptBlocker(zoneId);
  if (blocked === 'roadway') {
    return '<p style="font-size:13px;color:var(--warm-gray);margin:10px 0">This zone runs beside highways, so it can\'t be adopted.</p>';
  }
  if (blocked === 'limit') {
    return `<p style="font-size:13px;color:var(--warm-gray);margin:10px 0">You've adopted ${ZONE_ADOPTION.maxZones} zones, the most anyone can at once. Stop adopting one to take this on.</p>`;
  }
  return '<button class="btn btn--secondary btn--block" id="zone-adopt" style="margin-top:10px">🤝 Adopt this zone</button>';
}

function openAdoptSheet(zone) {
  const back = () => openZoneSheet(zone.id);
  const wrap = openSheet(`
    <h2 class="sheet-title">${zone.emoji} Adopt ${esc(zone.name)}?</h2>
    <p class="sheet-sub">You're promising to look after this zone, with a cleanup at least every ${ZONE_ADOPTION.commitmentDays} days.</p>
    <div class="card" style="margin-bottom:12px">
      <ul style="margin:0;padding-left:18px;font-size:13.5px;color:var(--warm-gray);line-height:1.6">
        <li>Your username shows on the map for this zone, and on your profile, so neighbors can see who looks after it.</li>
        <li>Others can adopt it too. You're not on your own.</li>
        <li>No cleanup here for ${ZONE_ADOPTION.lapseDays} days and your adoption lapses. Your next cleanup picks it back up.</li>
        <li>You can adopt up to ${ZONE_ADOPTION.maxZones} zones and stop any time.</li>
      </ul>
    </div>
    <button class="btn btn--primary btn--block" id="adopt-confirm">Adopt this zone</button>
    <button class="btn btn--ghost btn--block" id="adopt-cancel" style="margin-top:8px">Not now</button>`);
  wrap.querySelector('#adopt-cancel').addEventListener('click', back);
  wrap.querySelector('#adopt-confirm').addEventListener('click', () => {
    tapHaptic();
    adoptZone(zone.id);
    toast(`You adopted ${zone.name}!`, { emoji: '🤝' });
    back();
  });
}

function openLeaveSheet(zone) {
  const back = () => openZoneSheet(zone.id);
  const wrap = openSheet(`
    <h2 class="sheet-title">Stop adopting ${esc(zone.name)}?</h2>
    <p class="sheet-sub">Your username comes off the map for this zone. Your cleanups and points stay, and you can adopt it again later.</p>
    <button class="btn btn--primary btn--block" id="leave-confirm">Stop adopting</button>
    <button class="btn btn--ghost btn--block" id="leave-cancel" style="margin-top:8px">Keep it</button>`);
  wrap.querySelector('#leave-cancel').addEventListener('click', back);
  wrap.querySelector('#leave-confirm').addEventListener('click', () => {
    tapHaptic();
    leaveZone(zone.id);
    toast(`You stopped adopting ${zone.name}`, { emoji: '👋' });
    back();
  });
}

function openZoneSheet(zoneId) {
  const zone = ZONES.find((z) => z.id === zoneId);
  if (!zone) return;
  const meta = ZONE_META[zoneId] || {};
  const status = getZoneStatus(zoneId);
  const style = STATUS_STYLE[status];
  const hot = getHotSpot(zoneId);
  const blocks = blocksForZone(zoneId);
  const s = getState();
  const cleanedHere = s.zoneCheckins[zoneId] || 0;
  const adopters = zoneAdopters(zoneId);
  refreshRemote();

  const wrap = openSheet(`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
      <div class="hot-emoji" style="background:var(--green-pale)">${zone.emoji}</div>
      <div>
        <h2 class="sheet-title" style="margin:0">${esc(zone.name)}</h2>
        <div style="font-size:12.5px;color:var(--warm-gray);display:flex;align-items:center;gap:6px">
          <span class="status-dot" style="background:${style.color}"></span>${style.label}
          ${hot ? `<span class="badge badge--hot">🔥 ${hot.short}</span>` : ''}
        </div>
      </div>
    </div>

    <div class="stat-row" style="margin:14px 0">
      <div class="stat-tile" style="box-shadow:none">
        <div class="stat-value" style="font-size:17px">${meta.daysSince >= 999 ? '—' : meta.daysSince + 'd'}</div>
        <div class="stat-label">Since cleanup</div>
      </div>
      <div class="stat-tile" style="box-shadow:none">
        <div class="stat-value" style="font-size:17px">${meta.nextEvent && meta.nextEvent.date !== 'TBD' ? esc(meta.nextEvent.date) : 'TBD'}</div>
        <div class="stat-label">Next event</div>
      </div>
      <div class="stat-tile" style="box-shadow:none">
        <div class="stat-value" style="font-size:17px">${cleanedHere}</div>
        <div class="stat-label">Your visits</div>
      </div>
    </div>

    <button class="btn btn--primary btn--block" id="zone-checkin">${icon('sparkle')} Check in here</button>

    ${ROADWAY_ZONES.includes(zoneId) ? '' : `
      <div class="section-title" style="margin-top:18px">Adopted by ${adopters?.length ? `<span style="font-weight:400;font-size:12px;color:var(--warm-gray)">${adopters.length}</span>` : ''}</div>
      <div class="card" style="padding:4px 16px">${adoptersHtml(adopters)}</div>`}
    ${adoptControlHtml(zoneId, adopters)}

    ${blocks.length ? `
      <div class="section-title" style="margin-top:18px">Blocks in this zone</div>
      <div class="card" style="padding:4px 16px">
        ${blocks.map((b) => `
          <div class="list-row" style="cursor:default">
            <span>${esc(b.name)}</span>
            ${s.adoptions.some((a) => a.blockId === b.id) ? '<span class="badge badge--rsvp" style="margin-left:auto">🏠 Adopted</span>' : ''}
          </div>`).join('')}
      </div>` : ''}
  `, { tall: blocks.length > 0 || (adopters?.length || 0) > 2 });

  wrap.querySelector('#zone-checkin').addEventListener('click', () => {
    tapHaptic();
    closeSheet();
    navigate('checkin', { zoneId });
  });
  wrap.querySelector('#zone-adopt')?.addEventListener('click', () => {
    tapHaptic();
    openAdoptSheet(zone);
  });
  wrap.querySelector('#zone-leave')?.addEventListener('click', () => {
    tapHaptic();
    openLeaveSheet(zone);
  });
  bindUserLinks(wrap, { back: () => openZoneSheet(zoneId) });
}

export function renderMap(root, params = {}) {
  root.innerHTML = `
    <div class="screen map-screen">
      <div id="map-container"></div>
      <div class="map-topbar">
        <div class="map-title-chip">${icon('map')} Deutschtown zones</div>
        <button class="map-title-chip" id="btn-clipboard" style="border:none;cursor:pointer;margin-left:auto">📋 Clipboard</button>
        <button class="map-locate-btn" id="btn-locate" aria-label="Find me">${icons.crosshair}</button>
      </div>
      <div class="map-legend">
        ${Object.entries(STATUS_STYLE).map(([k, v]) => `<span><span class="status-dot" style="background:${v.color}"></span>${v.label}</span>`).join('')}
      </div>
    </div>`;

  map = L.map('map-container', {
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    zoomControl: false,
    attributionControl: true,
  });
  const tiles = L.tileLayer(TILE_URL, { subdomains: 'abc', maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);
  let tileFailures = 0;
  let tilesSwapped = false;
  tiles.on('tileerror', () => {
    if (!tilesSwapped && ++tileFailures >= 4) {
      tilesSwapped = true;
      tiles.setOptions({ subdomains: '' });
      tiles.setUrl(TILE_URL_FALLBACK);
    }
  });

  // Adjacent zones (e.g. East of 279 / Interstate and Ramps / Penn Brewery
  // Area) can be small enough that their name labels overlap each other or
  // run off the map edge. Track label priority by status so the most
  // important ones win, then hide colliding labels after layout.
  const STATUS_PRIORITY = { attention: 3, overdue: 2, clean: 1 };
  const labelMarkers = [];

  ZONES.forEach((zone) => {
    const poly = ZONE_POLYGONS[zone.id];
    if (!poly || poly.length < 3) return;
    const status = getZoneStatus(zone.id);
    const color = STATUS_STYLE[status].color;
    const layer = L.polygon(poly, {
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.18,
    }).addTo(map);
    layer.on('click', () => {
      tapHaptic();
      openZoneSheet(zone.id);
    });
    const center = layer.getBounds().getCenter();
    const label = L.marker(center, {
      icon: L.divIcon({ className: 'zone-label', html: `${zone.emoji} ${esc(zone.name)}`, iconSize: null }),
      interactive: false,
    }).addTo(map);
    labelMarkers.push({ label, priority: STATUS_PRIORITY[status] || 1 });
  });

  function layoutZoneLabels() {
    const placed = [];
    labelMarkers
      .slice()
      .sort((a, b) => b.priority - a.priority)
      .forEach(({ label }) => {
        const el = label.getElement();
        if (!el) return;
        el.style.visibility = 'visible';
        const rect = el.getBoundingClientRect();
        const overlaps = placed.some((r) => rect.left < r.right && rect.right > r.left && rect.top < r.bottom && rect.bottom > r.top);
        if (overlaps) el.style.visibility = 'hidden';
        else placed.push(rect);
      });
  }
  map.on('zoomend moveend', layoutZoneLabels);

  root.querySelector('#btn-clipboard').addEventListener('click', () => {
    tapHaptic();
    openClipboard({ onZone: openZoneSheet });
  });

  root.querySelector('#btn-locate').addEventListener('click', async () => {
    tapHaptic();
    try {
      const { lat, lng } = await getPosition();
      if (userMarker) userMarker.remove();
      userMarker = L.circleMarker([lat, lng], {
        radius: 8,
        color: '#fff',
        weight: 2.5,
        fillColor: '#2d6a4f',
        fillOpacity: 1,
      }).addTo(map);
      map.flyTo([lat, lng], 16, { duration: 0.8 });
      const found = locateArea(lat, lng);
      if (found.zone) {
        setTimeout(() => openZoneSheet(found.zone.id), 900);
      } else {
        toast("You're outside the cleanup zones", { emoji: '🧭' });
      }
    } catch (e) {
      toast('Could not get your location — check permissions', { emoji: '📍' });
    }
  });

  // Deep link from other screens (e.g. hot block card on Home).
  if (params.zoneId) {
    setTimeout(() => openZoneSheet(params.zoneId), 350);
  }

  // Leaflet needs a resize nudge after being injected.
  setTimeout(() => {
    if (!map) return;
    map.invalidateSize();
    layoutZoneLabels();
  }, 60);

  return () => {
    if (map) {
      map.remove();
      map = null;
      userMarker = null;
    }
  };
}
