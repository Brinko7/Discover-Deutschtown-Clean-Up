// Two-phase check-in, same model as the web version:
// pick where you're cleaning → live timer session → check out with
// photos and notes → points + unlocks.
import {
  ZONES, blocksForZone, blockById, zoneById,
  getHotSpot, computeScore, ADOPTION_RULES, ZONE_MASCOTS,
  ZONE_POLYGONS, REQUIRE_LOCATION, LOCATION_BUFFER_METERS,
  STILL_CLEANING_MINUTES, MAX_SESSION_MINUTES, FINISH_BUFFER_METERS, formatMinutes,
} from '../data.js';
import {
  getState, recordCheckin, adoptedBlockIds, adoptBlock, uuid,
  saveActiveSession, loadActiveSession,
} from '../store.js';
import { icon, esc, openSheet, closeSheet, toast, celebrate } from '../ui.js';
import { icons } from '../icons.js';
import { tapHaptic, successHaptic, takePhoto, getPosition, locateArea, distanceToPolygonMeters } from '../native.js';
import { navigate, refreshTabBar } from '../main.js';

// Module-level so the session survives tab switches, and saved to the phone
// on every change so it survives the app being closed (see store.js).
// confirmedUntil: time is counted up to here until the person answers "Still cleaning?".
// skippedMs: time between an unanswered check and the answer, which is not counted.
let session = null; // { startTime, zoneId, blockIds:[], photos:[], notes, anonymous, confirmedUntil, skippedMs }
let timerInterval = null;
let stillCleaningOpen = false;
let lastFix = null; // the most recent GPS fix from this screen, reused if fresh

const MIN = 60000;

export function hasActiveSession() {
  return !!session;
}

// Picks up a cleanup that was running when the app closed. Returns true if there was one.
export async function restoreSession() {
  const saved = await loadActiveSession();
  if (!saved || !zoneById(saved.zoneId)) return false;
  session = {
    blockIds: [], photos: [], notes: '', anonymous: false, skippedMs: 0,
    confirmedUntil: saved.startTime + STILL_CLEANING_MINUTES * MIN,
    ...saved,
  };
  return true;
}

// Android can close the app while the camera is open; the photo is then handed
// back on the next launch. Attach it to the restored cleanup.
export function addRestoredPhoto(dataUrl) {
  if (!session || !dataUrl || session.photos.length >= 3) return false;
  session.photos.push(dataUrl);
  saveActiveSession(session);
  return true;
}

function persistSession() {
  saveActiveSession(session);
}

// Minutes that count toward points: time after an unanswered "Still cleaning?"
// is left out, and nothing counts past MAX_SESSION_MINUTES.
function creditedMinutes(now = Date.now()) {
  const counted = Math.min(now, session.confirmedUntil) - session.startTime - (session.skippedMs || 0);
  return Math.max(1, Math.min(MAX_SESSION_MINUTES, Math.round(counted / MIN)));
}

function isPaused(now = Date.now()) {
  return now >= session.confirmedUntil || creditedMinutes(now) >= MAX_SESSION_MINUTES;
}

const LOCATE_IDLE = '<b>Find my zone automatically</b><br><span style="font-size:12px;opacity:.8">Uses your location to pick the right spot</span>';

// ── Step 1: choose where ─────────────────────────────────────

function renderStart(root, params) {
  const preselect = params.zoneId || null;
  let zoneId = preselect;
  let blockIds = [];
  let locateHtml = LOCATE_IDLE;

  const paint = () => {
    const zoneChips = ZONES.map((z) => {
      const hot = getHotSpot(z.id);
      return `<button class="chip ${hot ? 'chip--hot' : ''} ${zoneId === z.id ? 'chip--selected' : ''}" data-zone="${z.id}">${z.emoji} ${esc(z.name)}${hot ? ` · ${hot.short}` : ''}</button>`;
    }).join('');

    const blocks = zoneId ? blocksForZone(zoneId) : [];
    const blockChips = blocks.length
      ? `<div class="field-label" style="margin-top:18px">Narrow it to a block <span style="font-weight:400;color:var(--warm-gray)">(optional)</span></div>
         <div class="area-chip-row">
           ${blocks.map((b) => `<button class="chip ${blockIds.includes(b.id) ? 'chip--selected' : ''}" data-block="${b.id}">${esc(b.name)}</button>`).join('')}
         </div>`
      : '';

    root.innerHTML = `
      <div class="screen checkin-screen">
        <header class="screen-header">
          <div>
            <h1 class="screen-title">Check in</h1>
            <p class="screen-subtitle">Where are you cleaning today?</p>
          </div>
        </header>

        <div class="section">
          <button class="locate-banner btn--block" id="btn-autolocate" style="border:none;cursor:pointer;width:100%;text-align:left">
            ${icon('crosshair')} <span id="autolocate-text">${locateHtml}</span>
          </button>
        </div>

        <div class="section">
          <div class="field-label">Pick a zone</div>
          <div class="area-chip-row">${zoneChips}</div>
          ${blockChips}
        </div>

        <div class="section" style="margin-top:auto;padding-bottom:16px">
          <button class="btn btn--primary btn--block" id="btn-start" ${zoneId ? '' : 'disabled'}>
            ${icon('play')} Start cleanup
          </button>
        </div>
      </div>`;

    root.querySelectorAll('[data-zone]').forEach((btn) => {
      btn.addEventListener('click', () => {
        tapHaptic();
        zoneId = zoneId === btn.dataset.zone ? null : btn.dataset.zone;
        blockIds = [];
        paint();
      });
    });
    root.querySelectorAll('[data-block]').forEach((btn) => {
      btn.addEventListener('click', () => {
        tapHaptic();
        const id = btn.dataset.block;
        const i = blockIds.indexOf(id);
        if (i >= 0) blockIds.splice(i, 1);
        else blockIds.push(id);
        paint();
      });
    });
    root.querySelector('#btn-autolocate').addEventListener('click', () => {
      tapHaptic();
      autoLocate();
    });
    root.querySelector('#btn-start').addEventListener('click', async (e) => {
      if (!zoneId) return;
      const startBtn = e.currentTarget;
      // You have to be at the cleanup to start it: your GPS position must be
      // inside the chosen zone, or within a small buffer of its edge.
      if (REQUIRE_LOCATION) {
        const label = startBtn.innerHTML;
        startBtn.disabled = true;
        startBtn.textContent = 'Checking your location…';
        const restore = () => {
          startBtn.disabled = false;
          startBtn.innerHTML = label;
        };
        let pos;
        try {
          // Reuse the fix from opening this screen if it is under a minute old.
          pos = lastFix && Date.now() - lastFix.at < MIN ? lastFix : await getPosition();
          lastFix = pos;
        } catch (err) {
          restore();
          toast('We need your location to start a cleanup. Turn on location for this app in your phone settings and try again.', { emoji: '📍' });
          return;
        }
        const zoneName = zoneById(zoneId)?.name || 'that zone';
        const away = distanceToPolygonMeters(pos.lat, pos.lng, ZONE_POLYGONS[zoneId]);
        if (away > LOCATION_BUFFER_METERS) {
          restore();
          const found = locateArea(pos.lat, pos.lng);
          const where = away === Infinity ? '' : away < 1000 ? `about ${Math.round(away / 10) * 10} m` : `about ${(away / 1000).toFixed(1)} km`;
          toast(
            found.zone && found.zone.id !== zoneId
              ? `You're in ${found.zone.name}, not ${zoneName}. Pick ${found.zone.name} to start here.`
              : `You're ${where ? where + ' ' : ''}from ${zoneName}. Head over, then start your cleanup.`,
            { emoji: '🧭' },
          );
          return;
        }
        restore();
      }
      successHaptic();
      session = {
        startTime: Date.now(),
        zoneId,
        blockIds: [...blockIds],
        photos: [],
        notes: '',
        anonymous: false,
        confirmedUntil: Date.now() + STILL_CLEANING_MINUTES * MIN,
        skippedMs: 0,
      };
      persistSession();
      refreshTabBar();
      renderActive(root);
      toast('Cleanup started — go get it!', { emoji: '🧹' });
    });
  };

  // Fills in your zone from GPS. Runs on its own when the screen opens (location
  // is needed to start anyway), and again from the banner to retry.
  let locating = false;
  async function autoLocate({ quiet = false } = {}) {
    if (locating) return;
    locating = true;
    const setBanner = (html) => {
      locateHtml = html;
      const el = root.querySelector('#autolocate-text');
      if (el) el.innerHTML = html;
    };
    setBanner('<b>Finding your zone…</b><br><span style="font-size:12px;opacity:.8">Checking your location</span>');
    try {
      const pos = await getPosition();
      lastFix = pos;
      if (!root.querySelector('#autolocate-text')) return; // left the screen meanwhile
      const found = locateArea(pos.lat, pos.lng);
      if (found.zone) {
        zoneId = found.zone.id;
        blockIds = found.block ? [found.block.id] : [];
        const where = found.block ? `${found.block.name}, ${found.zone.name}` : found.zone.name;
        setBanner(`<b>${found.nearby ? 'Closest zone' : "You're in"}: ${esc(where)}</b><br><span style="font-size:12px;opacity:.8">Picked for you. Tap a different zone to change it.</span>`);
        paint();
      } else {
        setBanner("<b>You're not in a cleanup zone right now</b><br><span style=\"font-size:12px;opacity:.8\">Head to one of the zones below, then tap here to check again</span>");
      }
    } catch (e) {
      setBanner('<b>Location is off</b><br><span style="font-size:12px;opacity:.8">Turn on location for this app to start a cleanup, then tap here</span>');
      if (!quiet) toast('Location unavailable. Check app permissions.', { emoji: '📍' });
    } finally {
      locating = false;
    }
  }

  paint();
  if (!preselect) autoLocate({ quiet: true });
}

// ── Step 2: active session ───────────────────────────────────

function fmtTimer() {
  const secs = Math.floor((Date.now() - session.startTime) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return h ? `${h}:${mmss}` : mmss;
}

function renderActive(root) {
  const zone = zoneById(session.zoneId);
  const areaIds = [session.zoneId, ...session.blockIds];
  const hot = getHotSpot(session.zoneId) || session.blockIds.map(getHotSpot).find(Boolean);

  const paintPoints = () => {
    const score = computeScore(creditedMinutes(), areaIds, adoptedBlockIds());
    const note = root.querySelector('#timer-note');
    if (note) {
      const maxed = creditedMinutes() >= MAX_SESSION_MINUTES;
      note.textContent = maxed
        ? `That's the ${formatMinutes(MAX_SESSION_MINUTES)} maximum. Finish to log it.`
        : isPaused()
          ? `Counting paused at ${formatMinutes(creditedMinutes())}. Tell us you're still cleaning.`
          : '';
      note.style.display = note.textContent ? 'block' : 'none';
    }
    const el = root.querySelector('#points-preview');
    if (!el) return;
    el.innerHTML = `
      <div>
        <div class="pv-note">You'll earn</div>
        <div class="pv-total">${score.total} pts</div>
        <div class="pv-note">${score.base} base${score.multiplier > 1 ? ` × ${score.multiplier}` : ''}</div>
      </div>
      ${score.multiplier > 1 ? `<div class="mult-badge">🔥 ${score.multiplier}× active</div>` : ''}`;
  };

  const paintPhotos = () => {
    const strip = root.querySelector('#photo-strip');
    strip.innerHTML = `
      <button class="photo-add" id="btn-photo">${icons.camera}<span>Add photo</span></button>
      ${session.photos.map((p, i) => `
        <span class="photo-thumb-wrap">
          <img class="photo-thumb" src="${p}" alt="Cleanup photo ${i + 1}" />
          <button class="photo-remove" data-remove-photo="${i}">✕</button>
        </span>`).join('')}`;
    strip.querySelector('#btn-photo').addEventListener('click', async () => {
      tapHaptic();
      const dataUrl = await takePhoto();
      if (dataUrl && session) {
        session.photos.push(dataUrl);
        persistSession();
        paintPhotos();
        toast('Photo added', { emoji: '📸' });
      }
    });
    strip.querySelectorAll('[data-remove-photo]').forEach((btn) => {
      btn.addEventListener('click', () => {
        tapHaptic();
        session.photos.splice(Number(btn.dataset.removePhoto), 1);
        persistSession();
        paintPhotos();
      });
    });
  };

  const blockNames = session.blockIds.map((id) => blockById(id)?.name).filter(Boolean);

  root.innerHTML = `
    <div class="screen checkin-screen">
      <header class="screen-header">
        <div>
          <h1 class="screen-title">Cleaning now</h1>
          <p class="screen-subtitle">${zone.emoji} ${esc(zone.name)}${blockNames.length ? ' · ' + esc(blockNames.join(', ')) : ''}${hot ? ' · 🔥 bonus zone' : ''}</p>
        </div>
      </header>

      <div class="section">
        <div class="card" style="padding:22px 16px">
          <div class="timer-label">Session time</div>
          <div class="timer-display" id="timer">00:00</div>
          <p class="timer-note" id="timer-note" style="display:none"></p>
        </div>
      </div>

      <div class="section">
        <div class="card">
          <div class="field-label">${icon('camera')} Photos</div>
          <div class="photo-strip" id="photo-strip"></div>
        </div>
      </div>

      <div class="section">
        <div class="card">
          <div class="field-label">${icon('note')} Notes</div>
          <textarea class="text-input" id="notes" placeholder="Anything worth flagging? Dumping, broken glass, a block that needs love…">${esc(session.notes)}</textarea>
          <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13.5px;color:var(--warm-gray)">
            <input type="checkbox" id="anon" ${session.anonymous ? 'checked' : ''} style="width:17px;height:17px;accent-color:var(--green)" />
            Check in anonymously
          </label>
        </div>
      </div>

      <div class="section">
        <div class="points-preview" id="points-preview"></div>
      </div>

      <div class="section" style="padding-bottom:16px">
        <button class="btn btn--primary btn--block" id="btn-finish">${icon('stop')} Finish &amp; check out</button>
        <div style="height:8px"></div>
        <button class="btn btn--danger btn--block" id="btn-cancel">Discard session</button>
      </div>
    </div>`;

  const timerEl = root.querySelector('#timer');
  timerEl.textContent = fmtTimer();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!session || !document.body.contains(timerEl)) return clearInterval(timerInterval);
    timerEl.textContent = fmtTimer();
    paintPoints();
    maybeAskStillCleaning(root);
  }, 1000);
  maybeAskStillCleaning(root);

  paintPoints();
  paintPhotos();

  let notesTimer = null;
  root.querySelector('#notes').addEventListener('input', (e) => {
    session.notes = e.target.value;
    clearTimeout(notesTimer);
    notesTimer = setTimeout(persistSession, 500);
  });
  root.querySelector('#anon').addEventListener('change', (e) => {
    session.anonymous = e.target.checked;
    persistSession();
  });

  root.querySelector('#btn-cancel').addEventListener('click', () => {
    tapHaptic();
    const wrap = openSheet(`
      <h2 class="sheet-title">Discard this session?</h2>
      <p class="sheet-sub">Your timer, photos and notes will be lost.</p>
      <button class="btn btn--danger btn--block" id="confirm-discard">Discard</button>
      <div style="height:8px"></div>
      <button class="btn btn--ghost btn--block" id="keep-going">Keep cleaning</button>`);
    wrap.querySelector('#confirm-discard').addEventListener('click', () => {
      endSession();
      closeSheet();
      navigate('home');
      toast('Session discarded');
    });
    wrap.querySelector('#keep-going').addEventListener('click', closeSheet);
  });

  root.querySelector('#btn-finish').addEventListener('click', () => checkOut(root));
}

// Past the counted time: ask once. A late "yes" does not count the gap.
function maybeAskStillCleaning(root) {
  if (!session || stillCleaningOpen || Date.now() < session.confirmedUntil) return;
  if (creditedMinutes() >= MAX_SESSION_MINUTES) return;
  stillCleaningOpen = true;
  const wrap = openSheet(`
    <h2 class="sheet-title">🧹 Still cleaning?</h2>
    <p class="sheet-sub">Your cleanup has been running for ${formatMinutes(Math.round((Date.now() - session.startTime) / MIN))}. Time only keeps counting once you confirm.</p>
    <button class="btn btn--primary btn--block" id="still-yes">Yes, still cleaning</button>
    <div style="height:8px"></div>
    <button class="btn btn--ghost btn--block" id="still-done">I'm done, check out</button>`, {
    onClose: () => {
      stillCleaningOpen = false;
    },
  });
  wrap.querySelector('#still-yes').addEventListener('click', () => {
    successHaptic();
    const now = Date.now();
    if (now > session.confirmedUntil) session.skippedMs = (session.skippedMs || 0) + (now - session.confirmedUntil);
    session.confirmedUntil = now + STILL_CLEANING_MINUTES * MIN;
    persistSession();
    closeSheet();
    toast('Keep it up!', { emoji: '💪' });
  });
  wrap.querySelector('#still-done').addEventListener('click', () => {
    closeSheet();
    checkOut(root);
  });
}

function endSession() {
  session = null;
  clearInterval(timerInterval);
  saveActiveSession(null);
  refreshTabBar();
}

// Check-out: a quick location check. Someone far from their zone is asked how
// long they actually cleaned (they may have walked home first). If location is
// unavailable, the check-out goes ahead as is.
async function checkOut(root) {
  if (!session) return;
  const btn = root.querySelector('#btn-finish');
  const credited = creditedMinutes();
  let away = 0;
  if (REQUIRE_LOCATION) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Wrapping up…';
    }
    try {
      const pos = await getPosition();
      away = distanceToPolygonMeters(pos.lat, pos.lng, ZONE_POLYGONS[session.zoneId]);
    } catch (e) {
      away = 0;
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `${icon('stop')} Finish &amp; check out`;
    }
  }
  if (!session) return;
  if (!(away > FINISH_BUFFER_METERS) || away === Infinity) return finish(root, credited);

  const zoneName = zoneById(session.zoneId)?.name || 'your zone';
  const dist = away < 1000 ? `about ${Math.round(away / 10) * 10} m` : `about ${(away / 1000).toFixed(1)} km`;
  let minutes = credited;
  const wrap = openSheet(`
    <h2 class="sheet-title">How long did you clean?</h2>
    <p class="sheet-sub">You're ${dist} from ${esc(zoneName)}. If you stopped cleaning a while ago, set the time you actually spent there.</p>
    <div class="minutes-stepper">
      <button class="btn btn--ghost" id="min-down" aria-label="15 minutes less">−15</button>
      <div class="minutes-value" id="min-value"></div>
      <button class="btn btn--ghost" id="min-up" aria-label="15 minutes more">+15</button>
    </div>
    <button class="btn btn--primary btn--block" id="min-log"></button>
    <div style="height:8px"></div>
    <button class="btn btn--ghost btn--block" id="min-keep">Keep cleaning</button>`);
  const paintMinutes = () => {
    wrap.querySelector('#min-value').textContent = formatMinutes(minutes);
    wrap.querySelector('#min-log').textContent = `Log ${formatMinutes(minutes)}`;
    wrap.querySelector('#min-up').disabled = minutes >= credited;
    wrap.querySelector('#min-down').disabled = minutes <= 1;
  };
  paintMinutes();
  wrap.querySelector('#min-down').addEventListener('click', () => {
    tapHaptic();
    minutes = Math.max(1, minutes - 15);
    paintMinutes();
  });
  wrap.querySelector('#min-up').addEventListener('click', () => {
    tapHaptic();
    minutes = Math.min(credited, minutes + 15);
    paintMinutes();
  });
  wrap.querySelector('#min-log').addEventListener('click', () => {
    closeSheet();
    finish(root, minutes);
  });
  wrap.querySelector('#min-keep').addEventListener('click', closeSheet);
}

// ── Step 3: check out ────────────────────────────────────────

function finish(root, minutes) {
  const areaIds = [session.zoneId, ...session.blockIds];
  const score = computeScore(minutes, areaIds, adoptedBlockIds());
  const zone = zoneById(session.zoneId);
  const blockNames = session.blockIds.map((id) => blockById(id)?.name).filter(Boolean);

  const checkin = {
    id: uuid(),
    ts: Date.now(),
    minutes,
    notes: session.notes.trim(),
    zoneIds: [session.zoneId],
    blockIds: [...session.blockIds],
    blockNames,
    points: score.total,
    multiplier: score.multiplier,
    photos: session.photos.slice(0, 3), // cap stored photos to keep Preferences light
    anonymous: session.anonymous,
  };

  const firstBlock = session.blockIds[0] || null;
  endSession();
  const unlockedZones = recordCheckin(checkin);
  successHaptic();

  celebrate(`
    <div class="celebrate-emoji">🎉</div>
    <div class="celebrate-title">Nice work${getState().profile.name ? ', ' + esc(getState().profile.name.split(' ')[0]) : ''}!</div>
    <div class="celebrate-points">+${score.total} pts</div>
    <div class="celebrate-sub">
      ${minutes} min in ${esc(zone.name)}
      ${score.multiplier > 1 ? `<br>🔥 ${score.multiplier}× bonus applied` : ''}
    </div>`, {
    // Follow-up moments only appear once this card is actually dismissed,
    // so celebration overlays never stack on top of each other.
    onClose: () => {
      if (unlockedZones.length) {
        const mascot = ZONE_MASCOTS.find((m) => m.zoneId === unlockedZones[0]);
        if (mascot) {
          celebrate(`
            <div class="celebrate-emoji">${mascot.emoji}</div>
            <div class="celebrate-title">You met ${esc(mascot.name)}!</div>
            <div class="celebrate-sub">"${esc(mascot.motto)}"<br>Mascot badge added to your collection.</div>`);
          return;
        }
      }
      maybePromptAdoption(firstBlock);
    },
  });

  navigate('home');
}

function maybePromptAdoption(blockId) {
  if (!blockId) return;
  const s = getState();
  const count = s.blockCheckins[blockId] || 0;
  const block = blockById(blockId);
  if (!block || count < ADOPTION_RULES.promptAfterCheckins) return;
  if (s.adoptions.some((a) => a.blockId === blockId)) return;

  const wrap = openSheet(`
    <h2 class="sheet-title">🏠 Adopt ${esc(block.name)}?</h2>
    <p class="sheet-sub">You've cleaned this block ${count} times — it clearly likes you. Adopters commit to ${ADOPTION_RULES.commitment.toLowerCase()} for ${ADOPTION_RULES.term.toLowerCase()} and earn <b>${ADOPTION_RULES.pointsMultiplier}× points</b> here, plus a ${ADOPTION_RULES.streakBonus}-pt bonus for a 4-week streak.</p>
    <button class="btn btn--primary btn--block" id="adopt-yes">Adopt this block</button>
    <div style="height:8px"></div>
    <button class="btn btn--ghost btn--block" id="adopt-no">Maybe later</button>`);
  wrap.querySelector('#adopt-yes').addEventListener('click', () => {
    successHaptic();
    adoptBlock(blockId, block.zoneId);
    closeSheet();
    toast(`You adopted ${block.name}!`, { emoji: '🏠' });
  });
  wrap.querySelector('#adopt-no').addEventListener('click', closeSheet);
}

// ── Entry ────────────────────────────────────────────────────

export function renderCheckin(root, params = {}) {
  if (session) {
    renderActive(root);
  } else {
    renderStart(root, params);
  }
  return () => clearInterval(timerInterval);
}
