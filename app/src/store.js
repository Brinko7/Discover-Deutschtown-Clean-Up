// App state with persistence via Capacitor Preferences.
// On web this transparently falls back to localStorage, so the same
// code runs in the browser during development and on device.
//
// The phone is the source of truth for your own history, so the app works fully offline.
// Changes are also queued in an outbox and sent to Supabase (see backend.js) when there is a connection.
import { Preferences } from '@capacitor/preferences';
import { zoneById, normalizeEvent, setZoneMeta } from './data.js';
import {
  DONE, RETRY,
  ensureSession, sendProfileName, sendCheckin, sendRsvp, sendAdoption,
  fetchLeaderboard, fetchFeed, fetchEvents, fetchZoneActivity,
} from './backend.js';

const KEY = 'myb_state_v1';

const defaults = () => ({
  profile: {
    name: '',
    onboarded: false,
    points: 0,
    bags: 0,
    minutes: 0,
    sessions: 0,
    streakWeeks: 0,
  },
  checkins: [], // { id, ts, minutes, bags, notes, zoneIds, blockIds, points, multiplier, photos:[dataUrl], anonymous }
  rsvps: [], // event ids
  adoptions: [], // { blockId, zoneId, adoptedAt }
  zoneCheckins: {}, // zoneId -> count (drives mascot unlocks)
  blockCheckins: {}, // blockId -> count (drives adopt prompt)
  mascots: [], // unlocked zoneIds
  activity: [], // user-generated activity entries, newest first
  outbox: [], // changes waiting to be sent: { t: 'profile'|'checkin'|'rsvp'|'adopt', ... }
  cache: { events: [], zones: [] }, // last events and zone activity from the server, so those screens work offline
});

let state = defaults();
const listeners = new Set();

// Shared data from the server (leaderboard, activity feed). Null until the first successful fetch.
const remote = { leaders: null, feed: null, events: null, zones: null, at: 0 };
const remoteListeners = new Set();

// Check-in ids are UUIDs so the server can ignore a repeated send.
export function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function initStore() {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) state = { ...defaults(), ...JSON.parse(value) };
  } catch (e) {
    console.warn('Failed to load saved state, starting fresh', e);
  }
  // Show the last known events and zone status right away, before the network answers.
  remote.events = state.cache?.events || [];
  remote.zones = state.cache?.zones || [];
  setZoneMeta(remote.zones, remote.events);
  // Sync in the background, never block the app on the network.
  window.addEventListener('online', () => syncNow());
  syncNow();
  return state;
}

async function persist() {
  try {
    await Preferences.set({ key: KEY, value: JSON.stringify(state) });
  } catch (e) {
    console.warn('Failed to persist state', e);
  }
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn(state));
}

export function update(mutator) {
  mutator(state);
  persist();
  notify();
}

// ── Sync with Supabase ───────────────────────────────────────

let flushing = false;
let retryTimer = null;

function queue(op) {
  update((s) => {
    s.outbox.push(op);
  });
  flushOutbox();
}

async function sendOp(op) {
  if (op.t === 'profile') return sendProfileName(op.name);
  if (op.t === 'rsvp') return sendRsvp(op.eventId, op.going);
  if (op.t === 'adopt') return sendAdoption(op.blockId, op.zoneId);
  if (op.t === 'checkin') {
    const checkin = state.checkins.find((c) => c.id === op.id);
    if (!checkin) return DONE; // deleted locally, nothing to send
    return sendCheckin(checkin);
  }
  return DONE;
}

// Sends queued changes in order. Stops at the first temporary failure and tries again later.
export async function flushOutbox() {
  if (flushing) return;
  flushing = true;
  let sentCheckin = false;
  try {
    while (state.outbox.length) {
      const op = state.outbox[0];
      const result = await sendOp(op);
      if (result === RETRY) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(flushOutbox, 30000);
        break;
      }
      if (op.t === 'checkin' && result === DONE) sentCheckin = true;
      state.outbox.shift();
      await persist();
    }
  } finally {
    flushing = false;
  }
  if (sentCheckin) refreshRemote(true);
}

export function getRemote() {
  return remote;
}

export function subscribeRemote(fn) {
  remoteListeners.add(fn);
  return () => remoteListeners.delete(fn);
}

// Pulls the shared leaderboard and feed. Rate limited unless forced.
export async function refreshRemote(force = false) {
  if (!force && Date.now() - remote.at < 30000) return;
  remote.at = Date.now();
  const [leaders, feed, events, zones] = await Promise.all([
    fetchLeaderboard(20), fetchFeed(30), fetchEvents(), fetchZoneActivity(),
  ]);
  if (leaders) remote.leaders = leaders;
  if (feed) remote.feed = feed;
  if (events) remote.events = events;
  if (zones) remote.zones = zones;
  if (events || zones) {
    setZoneMeta(remote.zones || [], remote.events || []);
    update((s) => {
      s.cache = { events: remote.events || [], zones: remote.zones || [] };
    });
  }
  if (leaders || feed || events || zones) remoteListeners.forEach((fn) => fn(remote));
}

// Call on start, when the connection returns, and when the app comes back to the foreground.
export async function syncNow() {
  // No guest account is created until someone has actually started using the app.
  if (!state.profile.onboarded && !state.outbox.length) return;
  if (!(await ensureSession())) return;
  await flushOutbox();
  await refreshRemote(true);
}

// Wipes everything on this phone (after the server data was deleted).
export async function resetAll() {
  try {
    await Preferences.remove({ key: KEY });
  } catch (e) {
    console.warn('Failed to clear saved state', e);
  }
  state = defaults();
  remote.leaders = null;
  remote.feed = null;
  remote.events = null;
  remote.zones = null;
  remote.at = 0;
  setZoneMeta([], []);
}

// ── State changes ────────────────────────────────────────────

export function setProfileName(name) {
  const clean = name.trim();
  update((s) => {
    s.profile.name = clean;
    s.profile.onboarded = true;
    // Only the latest name needs sending.
    s.outbox = s.outbox.filter((op) => op.t !== 'profile');
  });
  queue({ t: 'profile', name: clean });
}

export function toggleRsvp(eventId) {
  let going = false;
  update((s) => {
    const i = s.rsvps.indexOf(eventId);
    if (i >= 0) s.rsvps.splice(i, 1);
    else s.rsvps.push(eventId);
    going = s.rsvps.includes(eventId);
    // A newer choice for the same event replaces an older one still waiting.
    s.outbox = s.outbox.filter((op) => !(op.t === 'rsvp' && op.eventId === eventId));
  });
  queue({ t: 'rsvp', eventId, going });
  return going;
}

export function adoptBlock(blockId, zoneId) {
  let added = false;
  update((s) => {
    if (!s.adoptions.some((a) => a.blockId === blockId)) {
      s.adoptions.push({ blockId, zoneId, adoptedAt: Date.now() });
      added = true;
    }
  });
  if (added) queue({ t: 'adopt', blockId, zoneId });
}

export function isAdopted(blockId) {
  return state.adoptions.some((a) => a.blockId === blockId);
}

export function adoptedBlockIds() {
  return state.adoptions.map((a) => a.blockId);
}

// Records a completed session and returns anything that unlocked.
export function recordCheckin(checkin) {
  const unlocked = [];
  update((s) => {
    s.checkins.unshift(checkin);
    s.profile.points += checkin.points;
    s.profile.bags += checkin.bags;
    s.profile.minutes += checkin.minutes;
    s.profile.sessions += 1;

    checkin.zoneIds.forEach((zid) => {
      s.zoneCheckins[zid] = (s.zoneCheckins[zid] || 0) + 1;
      if (!s.mascots.includes(zid)) {
        s.mascots.push(zid);
        unlocked.push(zid);
      }
    });
    checkin.blockIds.forEach((bid) => {
      s.blockCheckins[bid] = (s.blockCheckins[bid] || 0) + 1;
    });

    const zone = zoneById(checkin.zoneIds[0]);
    s.activity.unshift({
      id: 'u_' + checkin.id,
      type: 'checkin',
      name: checkin.anonymous ? 'Anonymous' : (s.profile.name || 'You'),
      isYou: true,
      zoneId: checkin.zoneIds[0],
      zoneName: zone ? zone.name : '',
      blockName: checkin.blockNames?.[0] || null,
      bags: checkin.bags,
      ts: checkin.ts,
      color: '#2d6a4f',
    });
  });
  queue({ t: 'checkin', id: checkin.id });
  return unlocked;
}

const FEED_COLORS = ['#2d6a4f', '#0077b6', '#c96f2f', '#5b8c6e', '#c77dff', '#f4a261', '#8c9aad', '#b5703a'];

export function colorFor(name) {
  let h = 0;
  for (const ch of String(name || '?')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FEED_COLORS[h % FEED_COLORS.length];
}

// Events from the server, split into what is coming up and what already happened.
export function getEventLists() {
  const all = (remote.events || []).map(normalizeEvent);
  return {
    upcoming: all.filter((e) => !e.isPast).sort((a, b) => a.date - b.date),
    past: all.filter((e) => e.isPast).sort((a, b) => b.date - a.date),
  };
}

// Live feed: real check-ins from the server, plus any of yours that are still waiting to be sent.
export function activityFeed() {
  const real = (remote.feed || []).map((f) => ({
    id: f.id,
    type: 'checkin',
    name: f.display_name,
    anonymous: f.display_name === 'Anonymous',
    isYou: f.is_you,
    zoneId: f.zone_id,
    zoneName: zoneById(f.zone_id)?.name || '',
    blockName: f.block_name,
    bags: Number(f.bags) || 0,
    ts: new Date(f.created_at).getTime(),
    color: colorFor(f.display_name),
  }));
  const sent = new Set(real.map((r) => r.id));
  const unsent = state.activity.filter((a) => !sent.has(a.id.replace(/^u_/, '')));
  return [...unsent, ...real].sort((a, b) => b.ts - a.ts);
}

export function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}
