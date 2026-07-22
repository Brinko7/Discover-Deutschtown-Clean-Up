// Two-phase check-in, same model as the web version:
// pick where you're cleaning → live timer session → check out with
// bags, photos and notes → points + unlocks.
import {
  ZONES, blocksForZone, blockById, zoneById,
  getHotSpot, computeScore, ADOPTION_RULES, ZONE_MASCOTS,
} from '../data.js';
import { getState, recordCheckin, adoptedBlockIds, adoptBlock } from '../store.js';
import { icon, esc, openSheet, closeSheet, toast, celebrate } from '../ui.js';
import { icons } from '../icons.js';
import { tapHaptic, successHaptic, takePhoto, getPosition, locateArea } from '../native.js';
import { navigate, refreshTabBar } from '../main.js';

// Module-level so the session survives tab switches.
let session = null; // { startTime, zoneId, blockIds:[], photos:[], bags, partial, notes, anonymous }
let timerInterval = null;

export function hasActiveSession() {
  return !!session;
}

// ── Step 1: choose where ─────────────────────────────────────

function renderStart(root, params) {
  const preselect = params.zoneId || null;
  let zoneId = preselect;
  let blockIds = [];

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
            ${icon('crosshair')} <span id="autolocate-text"><b>Find my zone automatically</b><br><span style="font-size:12px;opacity:.8">Uses your location to pick the right spot</span></span>
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
    root.querySelector('#btn-autolocate').addEventListener('click', async () => {
      tapHaptic();
      const textEl = root.querySelector('#autolocate-text');
      textEl.innerHTML = '<b>Locating you…</b>';
      try {
        const { lat, lng } = await getPosition();
        const found = locateArea(lat, lng);
        if (found.zone) {
          zoneId = found.zone.id;
          blockIds = found.block ? [found.block.id] : [];
          paint();
          toast(
            found.block
              ? `You're on ${found.block.name}`
              : found.nearby
                ? `Closest zone: ${found.zone.name}`
                : `You're in ${found.zone.name}`,
            { emoji: '📍' },
          );
        } else {
          textEl.innerHTML = '<b>Find my zone automatically</b><br><span style="font-size:12px;opacity:.8">Uses your location to pick the right spot</span>';
          toast("You don't seem to be in a cleanup zone — pick one below", { emoji: '🧭' });
        }
      } catch (e) {
        textEl.innerHTML = '<b>Find my zone automatically</b><br><span style="font-size:12px;opacity:.8">Uses your location to pick the right spot</span>';
        toast('Location unavailable — check app permissions', { emoji: '📍' });
      }
    });
    root.querySelector('#btn-start').addEventListener('click', () => {
      if (!zoneId) return;
      successHaptic();
      session = {
        startTime: Date.now(),
        zoneId,
        blockIds: [...blockIds],
        photos: [],
        bags: 0,
        partial: 0,
        notes: '',
        anonymous: false,
      };
      refreshTabBar();
      renderActive(root);
      toast('Cleanup started — go get it!', { emoji: '🧹' });
    });
  };

  paint();
}

// ── Step 2: active session ───────────────────────────────────

function elapsedMinutes() {
  return Math.max(1, Math.round((Date.now() - session.startTime) / 60000));
}

function fmtTimer() {
  const secs = Math.floor((Date.now() - session.startTime) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderActive(root) {
  const zone = zoneById(session.zoneId);
  const areaIds = [session.zoneId, ...session.blockIds];
  const hot = getHotSpot(session.zoneId) || session.blockIds.map(getHotSpot).find(Boolean);

  const paintPoints = () => {
    const score = computeScore(elapsedMinutes(), areaIds, adoptedBlockIds());
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
      if (dataUrl) {
        session.photos.push(dataUrl);
        paintPhotos();
        toast('Photo added', { emoji: '📸' });
      }
    });
    strip.querySelectorAll('[data-remove-photo]').forEach((btn) => {
      btn.addEventListener('click', () => {
        tapHaptic();
        session.photos.splice(Number(btn.dataset.removePhoto), 1);
        paintPhotos();
      });
    });
  };

  const totalBags = () => session.bags + session.partial;

  const paintBags = () => {
    root.querySelector('#bags-value').textContent = totalBags() % 1 ? totalBags().toFixed(1) : totalBags();
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
        </div>
      </div>

      <div class="section">
        <div class="card">
          <div class="field-label">${icon('trash')} Bags collected</div>
          <div class="stepper">
            <button class="stepper-btn" id="bags-minus">${icons.minus}</button>
            <div class="stepper-value" id="bags-value">0</div>
            <button class="stepper-btn" id="bags-plus">${icons.plus}</button>
          </div>
          <div class="area-chip-row" style="justify-content:center;margin-top:12px">
            ${[0, 0.25, 0.5, 0.75].map((f) => `<button class="chip ${session.partial === f ? 'chip--selected' : ''}" data-partial="${f}">${f === 0 ? 'No partial' : '+' + f + ' bag'}</button>`).join('')}
          </div>
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
  }, 1000);

  paintPoints();
  paintPhotos();
  paintBags();

  root.querySelector('#bags-plus').addEventListener('click', () => {
    tapHaptic();
    session.bags += 1;
    paintBags();
  });
  root.querySelector('#bags-minus').addEventListener('click', () => {
    tapHaptic();
    session.bags = Math.max(0, session.bags - 1);
    paintBags();
  });
  root.querySelectorAll('[data-partial]').forEach((btn) => {
    btn.addEventListener('click', () => {
      tapHaptic();
      session.partial = Number(btn.dataset.partial);
      root.querySelectorAll('[data-partial]').forEach((b) => b.classList.toggle('chip--selected', b === btn));
      paintBags();
    });
  });
  root.querySelector('#notes').addEventListener('input', (e) => {
    session.notes = e.target.value;
  });
  root.querySelector('#anon').addEventListener('change', (e) => {
    session.anonymous = e.target.checked;
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

  root.querySelector('#btn-finish').addEventListener('click', () => finish(root));
}

function endSession() {
  session = null;
  clearInterval(timerInterval);
  refreshTabBar();
}

// ── Step 3: check out ────────────────────────────────────────

function finish(root) {
  const minutes = elapsedMinutes();
  const areaIds = [session.zoneId, ...session.blockIds];
  const score = computeScore(minutes, areaIds, adoptedBlockIds());
  const zone = zoneById(session.zoneId);
  const blockNames = session.blockIds.map((id) => blockById(id)?.name).filter(Boolean);
  const bags = session.bags + session.partial;

  const checkin = {
    id: String(Date.now()),
    ts: Date.now(),
    minutes,
    bags,
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
      ${minutes} min in ${esc(zone.name)}${bags ? ` · ${bags % 1 ? bags.toFixed(2).replace(/0+$/, '') : bags} bag${bags === 1 ? '' : 's'}` : ''}
      ${score.multiplier > 1 ? `<br>🔥 ${score.multiplier}× bonus applied` : ''}
    </div>`);

  // Follow-up moments, staggered after the celebration.
  setTimeout(() => {
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
  }, 3400);

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
