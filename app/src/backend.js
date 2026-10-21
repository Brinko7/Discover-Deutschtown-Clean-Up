// Supabase connection for the phone app.
//
// - Every install is a guest account (anonymous sign-in), so rows belong to a real user id.
// - Writes go through an outbox in store.js, so check-ins made offline are sent later.
// - Reads are limited to two database functions that return names and totals only.
//
// Row level security is on for every table (see supabase/migrations), which is what makes the
// publishable key in config.js safe to ship.
import { createClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

// Keep the login in Capacitor Preferences so it survives webview storage clean-ups.
const prefsStorage = {
  getItem: async (key) => (await Preferences.get({ key })).value,
  setItem: async (key, value) => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key) => {
    await Preferences.remove({ key });
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { storage: prefsStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

// What the outbox does with an operation after trying it.
export const DONE = 'done';
export const RETRY = 'retry'; // offline or temporary problem, keep it and try later
export const DROP = 'drop'; // the server refused it for good, retrying would loop forever

const PERMANENT_STORAGE_STATUS = ['400', '403', '404', '409', '413', '415', '422'];

function verdict(error) {
  if (!error) return DONE;
  // Database errors carry a code (RLS refusal, constraint, duplicate). Network failures do not.
  if (typeof error.code === 'string' && error.code !== '' && error.code !== 'PGRST301') return DROP;
  if (PERMANENT_STORAGE_STATUS.includes(String(error.statusCode))) return DROP;
  return RETRY;
}

const clamp = (n, lo, hi) => Math.min(Math.max(Number.isFinite(n) ? n : lo, lo), hi);

let userId = null;

export function currentUserId() {
  return userId;
}

// Returns the user id, signing in as a new guest the first time. Null when offline.
export async function ensureSession() {
  if (userId) return userId;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      userId = session.user.id;
      return userId;
    }
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    userId = data.user.id;
    return userId;
  } catch (e) {
    console.warn('Not signed in yet (offline?). Will retry.', e);
    return null;
  }
}

// ── Writes (called from the outbox) ──────────────────────────

export async function sendProfileName(name) {
  const uid = await ensureSession();
  if (!uid) return RETRY;
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: String(name || '').slice(0, 60) })
    .eq('id', uid);
  return verdict(error);
}

export async function sendCheckin(c) {
  const uid = await ensureSession();
  if (!uid) return RETRY;

  // Photos go to the private bucket first; the row only stores their paths.
  const paths = [];
  const photos = (c.photos || []).slice(0, 3);
  for (let i = 0; i < photos.length; i++) {
    let blob;
    try {
      blob = await (await fetch(photos[i])).blob();
    } catch (e) {
      continue; // unreadable photo, skip it
    }
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${uid}/${c.id}-${i}.${ext}`;
    const { error } = await supabase.storage
      .from('checkin-photos')
      .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
    if (error) {
      if (verdict(error) === RETRY) return RETRY;
      continue; // refused for good (too large, wrong type): send the check-in without it
    }
    paths.push(path);
  }

  const row = {
    id: c.id,
    user_id: uid,
    created_at: new Date(c.ts).toISOString(),
    minutes: clamp(Math.round(c.minutes), 0, 1440),
    bags: clamp(Math.round(c.bags * 100) / 100, 0, 200),
    notes: (c.notes || '').slice(0, 1000) || null,
    zone_ids: c.zoneIds,
    block_ids: c.blockIds || [],
    block_names: c.blockNames || [],
    points: clamp(Math.round(c.points), 0, 100000),
    multiplier: clamp(Math.round(c.multiplier || 1), 1, 10),
    anonymous: !!c.anonymous,
    photo_paths: paths,
  };
  // Safe to repeat: a check-in that already arrived is ignored.
  const { error } = await supabase.from('checkins').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
  return verdict(error);
}

export async function sendRsvp(eventId, going) {
  const uid = await ensureSession();
  if (!uid) return RETRY;
  const { error } = going
    ? await supabase
        .from('rsvps')
        .upsert({ user_id: uid, event_id: eventId }, { onConflict: 'user_id,event_id', ignoreDuplicates: true })
    : await supabase.from('rsvps').delete().eq('user_id', uid).eq('event_id', eventId);
  return verdict(error);
}

export async function sendAdoption(blockId, zoneId) {
  const uid = await ensureSession();
  if (!uid) return RETRY;
  // A block has one adopter. If someone else got there first the server refuses (duplicate) and we drop it.
  const { error } = await supabase.from('adoptions').insert({ user_id: uid, block_id: blockId, zone_id: zoneId });
  return verdict(error);
}

// ── Reads (names and totals only) ────────────────────────────

export async function fetchLeaderboard(limit = 20) {
  if (!(await ensureSession())) return null;
  const { data, error } = await supabase.rpc('get_leaderboard', { max_rows: limit });
  return error ? null : data;
}

export async function fetchFeed(limit = 30) {
  if (!(await ensureSession())) return null;
  const { data, error } = await supabase.rpc('get_activity_feed', { max_rows: limit });
  return error ? null : data;
}

// ── Delete everything (required for apps that create accounts) ──

export async function deleteMyAccount() {
  const uid = await ensureSession();
  if (!uid) throw new Error('offline');
  // Files first: deleting the user does not delete storage objects.
  for (const bucket of ['checkin-photos', 'avatars']) {
    const { data } = await supabase.storage.from(bucket).list(uid, { limit: 1000 });
    if (data && data.length) {
      await supabase.storage.from(bucket).remove(data.map((f) => `${uid}/${f.name}`));
    }
  }
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut();
  userId = null;
}
