// ============================================================
// XP and levels.
//
// The server is the source of truth for XP: it works it out when a check-in
// arrives and stores it on the check-in (see supabase/migrations/
// 20261101000000_xp_levels.sql, function calc_checkin_xp). The rules below are
// a mirror of that function, used only to show an estimate for a cleanup that
// has not reached the server yet. If you change a rule, change both.
//
// The level curve and titles live only here, so tuning them needs no migration.
// ============================================================
import { getHotSpot } from './data.js';

export const XP_RULES = {
  perMinute: 1,
  dailyTimeCap: 120, // most XP that time alone can earn in one day
  showUp: 20, // first cleanup of the day that lasts showUpMinMinutes or more
  showUpMinMinutes: 10,
  newZone: 50, // first time cleaning in a zone
  newBlock: 15, // each block you have not cleaned before
  newBlockMax: 3,
  hotZone: 25, // flat bonus for cleaning in a hot zone
  event: 100, // first check-in at a hosted event (web page)
};

// First level that earns each title. Placeholder names, change freely.
export const LEVEL_TITLES = [
  [1, 'Neighbor'],
  [3, 'Sweeper'],
  [5, 'Block Regular'],
  [8, 'Block Captain'],
  [12, 'Zone Steward'],
  [16, 'Deutschtown Local'],
  [20, 'Deutschtown Legend'],
];

// Total XP needed to reach a level: 50 x n x (n - 1). L2 = 100, L5 = 1,000, L10 = 4,500, L20 = 19,000.
export function xpForLevel(n) {
  return 50 * n * (n - 1);
}

export function titleForLevel(level) {
  let title = LEVEL_TITLES[0][1];
  for (const [from, name] of LEVEL_TITLES) if (level >= from) title = name;
  return title;
}

export function levelInfo(xp) {
  xp = Math.max(0, Math.floor(Number(xp) || 0));
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2));
  while (xpForLevel(level + 1) <= xp) level++;
  while (level > 1 && xpForLevel(level) > xp) level--;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    title: titleForLevel(level),
    xp,
    floor,
    next,
    into: xp - floor,
    span: next - floor,
    toNext: next - xp,
    pct: Math.min(100, Math.round(((xp - floor) / (next - floor)) * 100)),
  };
}

const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

// Estimates the XP a cleanup will earn, from what this phone knows about the
// account. Call it BEFORE recordCheckin adds the cleanup to the state.
// { minutes, zoneId, blockIds, ts } -> number
export function estimateXp(state, { minutes, zoneId, blockIds = [], ts = Date.now() }) {
  minutes = Math.round(minutes); // the server stores whole minutes
  const today = state.checkins.filter((c) => dayKey(c.ts) === dayKey(ts));
  const usedMinutes = today.reduce((sum, c) => sum + (c.minutes || 0), 0);
  const showedUp = today.some((c) => c.minutes >= XP_RULES.showUpMinMinutes);

  let xp = Math.max(0, Math.min(minutes * XP_RULES.perMinute, XP_RULES.dailyTimeCap - Math.min(XP_RULES.dailyTimeCap, usedMinutes)));

  if (minutes >= XP_RULES.showUpMinMinutes) {
    if (!showedUp) xp += XP_RULES.showUp;
    if (!(state.zoneCheckins[zoneId] > 0)) xp += XP_RULES.newZone;
    const fresh = new Set(blockIds.filter((b) => !(state.blockCheckins[b] > 0)));
    xp += XP_RULES.newBlock * Math.min(XP_RULES.newBlockMax, fresh.size);
  }
  if (getHotSpot(zoneId)) xp += XP_RULES.hotZone;
  return Math.min(xp, 1000);
}
