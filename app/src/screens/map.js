import L from 'leaflet';
import {
  MAP_CENTER, MAP_ZOOM, TILE_URL, TILE_ATTRIBUTION,
  ZONES, ZONE_POLYGONS, ZONE_META, STATUS_STYLE,
  getZoneStatus, getHotSpot, blocksForZone,
} from '../data.js';
import { getState } from '../store.js';
import { icon, esc, openSheet, closeSheet, toast } from '../ui.js';
import { icons } from '../icons.js';
import { tapHaptic, getPosition, locateArea } from '../native.js';
import { navigate } from '../main.js';

let map = null;
let userMarker = null;

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

    ${blocks.length ? `
      <div class="section-title" style="margin-top:18px">Blocks in this zone</div>
      <div class="card" style="padding:4px 16px">
        ${blocks.map((b) => `
          <div class="list-row" style="cursor:default">
            <span>${esc(b.name)}</span>
            ${s.adoptions.some((a) => a.blockId === b.id) ? '<span class="badge badge--rsvp" style="margin-left:auto">🏠 Adopted</span>' : ''}
          </div>`).join('')}
      </div>` : ''}
  `, { tall: blocks.length > 4 });

  wrap.querySelector('#zone-checkin').addEventListener('click', () => {
    tapHaptic();
    closeSheet();
    navigate('checkin', { zoneId });
  });
}

export function renderMap(root, params = {}) {
  root.innerHTML = `
    <div class="screen map-screen">
      <div id="map-container"></div>
      <div class="map-topbar">
        <div class="map-title-chip">${icon('map')} Deutschtown zones</div>
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
  L.tileLayer(TILE_URL, { subdomains: 'abcd', maxZoom: 20, attribution: TILE_ATTRIBUTION }).addTo(map);

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
    L.marker(center, {
      icon: L.divIcon({ className: 'zone-label', html: `${zone.emoji} ${esc(zone.name)}`, iconSize: null }),
      interactive: false,
    }).addTo(map);
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
  setTimeout(() => map && map.invalidateSize(), 60);

  return () => {
    if (map) {
      map.remove();
      map = null;
      userMarker = null;
    }
  };
}
