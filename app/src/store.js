// App state with persistence via Capacitor Preferences.
// On web this transparently falls back to localStorage, so the same
// code runs in the browser during development and on device.
// When Supabase is connected, sync happens here (see README).
import { Preferences } from '@capacitor/preferences';
import { ACTIVITY_FEED_SEED, zoneById } from './data.js';

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
});

let state = defaults();
const listeners = new Set();

export async function initStore() {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) state = { ...defaults(), ...JSON.parse(value) };
  } catch (e) {
    console.warn('Failed to load saved state, starting fresh', e);
  }
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

export function setProfileName(name) {
  update((s) => {
    s.profile.name = name.trim();
    s.profile.onboarded = true;
  });
}

export function toggleRsvp(eventId) {
  update((s) => {
    const i = s.rsvps.indexOf(eventId);
    if (i >= 0) s.rsvps.splice(i, 1);
    else s.rsvps.push(eventId);
  });
  return state.rsvps.includes(eventId);
}

export function adoptBlock(blockId, zoneId) {
  update((s) => {
    if (!s.adoptions.some((a) => a.blockId === blockId)) {
      s.adoptions.push({ blockId, zoneId, adoptedAt: Date.now() });
    }
  });
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
  return unlocked;
}

// Live feed = the user's real activity followed by demo seed entries.
export function activityFeed() {
  const now = Date.now();
  const seed = ACTIVITY_FEED_SEED.map((a) => ({
    ...a,
    zoneName: zoneById(a.zoneId)?.name || '',
    ts: now - a.minsAgo * 60000,
  }));
  return [...state.activity, ...seed].sort((a, b) => b.ts - a.ts);
}

export function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}
