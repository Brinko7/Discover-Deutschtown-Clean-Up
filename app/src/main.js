import 'leaflet/dist/leaflet.css';
import './styles.css';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import { initStore, getState, update, resetAll, syncNow, subscribeRemote, setAccountProfile, claimForAccount } from './store.js';
import {
  ensureSession, onAuthChange,
  signInAccount, signUpAccount, resetPassword,
  cleanUsername, validUsername, fetchMyProfile,
} from './backend.js';
import { icons } from './icons.js';
import { icon, esc, toast } from './ui.js';
import { tapHaptic } from './native.js';
import { closeSheet } from './ui.js';
import { renderHome } from './screens/home.js';
import { renderMap } from './screens/map.js';
import { renderCheckin, hasActiveSession, restoreSession, addRestoredPhoto } from './screens/checkin.js';
import { renderEvents } from './screens/events.js';
import { renderProfile } from './screens/profile.js';

const TABS = [
  { id: 'home', label: 'Home', icon: 'home', render: renderHome },
  { id: 'map', label: 'Map', icon: 'map', render: renderMap },
  { id: 'checkin', label: 'Check In', icon: 'sparkle', render: renderCheckin },
  { id: 'events', label: 'Events', icon: 'calendar', render: renderEvents },
  { id: 'profile', label: 'You', icon: 'user', render: renderProfile },
];

let currentTab = 'home';
let currentCleanup = null;
let appStarted = false;

export function navigate(tabId, params = {}) {
  const tab = TABS.find((t) => t.id === tabId);
  if (!tab) return;
  closeSheet();
  if (typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }
  currentTab = tabId;
  const root = document.getElementById('screen-root');
  root.scrollTop = 0;
  currentCleanup = tab.render(root, params) || null;
  paintTabBar();
}

function paintTabBar() {
  document.querySelectorAll('#tab-bar .tab').forEach((btn) => {
    const id = btn.dataset.tab;
    const tab = TABS.find((t) => t.id === id);
    const active = id === currentTab;
    btn.classList.toggle('tab--active', active);
    if (id === 'checkin') {
      btn.classList.toggle('tab--session', hasActiveSession());
      btn.innerHTML = `<span class="tab-fab">${icons[hasActiveSession() ? 'clock' : 'plus']}</span><span class="tab-label">${hasActiveSession() ? 'Cleaning…' : tab.label}</span>`;
    } else {
      btn.innerHTML = `${icons[tab.icon]}<span class="tab-label">${tab.label}</span>`;
    }
  });
}

// Screens call this to refresh the FAB state (e.g. session started/ended).
export function refreshTabBar() {
  paintTabBar();
}

// ── Sign in / create account ─────────────────────────────────
// Everyone has an account and signs in: there is no guest mode.

const LOGO_SVG = `<svg width="26" height="26" viewBox="0 0 26 26"><g fill="#85ceac"><rect x="1" y="1" width="7" height="7" rx="1.5"/><rect x="9.5" y="1" width="7" height="7" rx="1.5" opacity=".55"/><rect x="18" y="1" width="7" height="7" rx="1.5"/><rect x="1" y="9.5" width="7" height="7" rx="1.5" opacity=".55"/><rect x="9.5" y="9.5" width="7" height="7" rx="1.5"/><rect x="18" y="9.5" width="7" height="7" rx="1.5" opacity=".55"/><rect x="1" y="18" width="7" height="7" rx="1.5"/><rect x="9.5" y="18" width="7" height="7" rx="1.5" opacity=".55"/><rect x="18" y="18" width="7" height="7" rx="1.5"/></g></svg>`;

function authShell(inner) {
  return `
    <div class="onboard-screen auth-screen screen">
      <div class="onboard-art">
        <div class="hero-blob" style="width:340px;height:340px;top:-90px;right:-120px"></div>
        <div class="hero-blob" style="width:200px;height:200px;top:180px;left:-90px;opacity:.08"></div>
        <div style="position:absolute;top:16%;left:0;right:0;text-align:center;font-size:84px">🧹</div>
      </div>
      <div style="position:relative">
        <div class="onboard-logo">${LOGO_SVG} MIND YOUR BLOCK</div>
        ${inner}
      </div>
    </div>`;
}

function friendlyAuthError(err) {
  const msg = (err && err.message) || 'Something went wrong. Try again.';
  if (/invalid login credentials/i.test(msg)) return 'That email and password do not match an account. Try again, or create an account.';
  if (/already registered/i.test(msg)) return 'An account with that email already exists. Sign in instead.';
  if (/password should be at least/i.test(msg)) return 'Password needs at least 8 characters.';
  if (/unable to validate email/i.test(msg)) return 'That email address does not look right.';
  if (/failed to fetch|network/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg;
}

function showAuth(mode = 'signin') {
  appStarted = false;
  const root = document.getElementById('screen-root');
  document.getElementById('tab-bar').style.display = 'none';
  document.body.classList.add('no-tabs');

  if (mode === 'signup') {
    root.innerHTML = authShell(`
      <h1 class="onboard-title">Join the cleanup crew.</h1>
      <p class="onboard-sub">Create an account to check in, earn points and mascot badges, and see your block shine.</p>
      <input class="text-input" id="su-username" placeholder="Username (shown to neighbors)" maxlength="30" autocomplete="username" autocapitalize="none" style="margin-bottom:4px" />
      <p style="font-size:12px;opacity:.7;margin:0 0 8px">Letters, numbers and _ only. This is the name on the leaderboard.</p>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input class="text-input" id="su-first" placeholder="First (optional)" maxlength="40" autocomplete="given-name" style="flex:1;min-width:0" />
        <input class="text-input" id="su-last" placeholder="Last (optional)" maxlength="40" autocomplete="family-name" style="flex:1;min-width:0" />
      </div>
      <input class="text-input" id="su-email" type="email" placeholder="Email (used to sign in)" autocomplete="email" style="margin-bottom:8px" />
      <input class="text-input" id="su-password" type="password" placeholder="Password (8+ characters)" autocomplete="new-password" style="margin-bottom:8px" />
      <input class="text-input" id="su-password2" type="password" placeholder="Confirm password" autocomplete="new-password" style="margin-bottom:8px" />
      <p id="auth-error" style="display:none;color:#c0392b;font-size:13px;margin:2px 0 8px"></p>
      <button class="btn btn--primary btn--block" id="su-go">Create account</button>
      <button class="onboard-skip" id="su-toggle">Already have an account? Sign in</button>`);

    const err = (m) => {
      const el = root.querySelector('#auth-error');
      el.textContent = m;
      el.style.display = 'block';
    };
    root.querySelector('#su-toggle').addEventListener('click', () => showAuth('signin'));
    root.querySelector('#su-go').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const firstName = root.querySelector('#su-first').value.trim();
      const lastName = root.querySelector('#su-last').value.trim();
      const username = cleanUsername(root.querySelector('#su-username').value);
      const email = root.querySelector('#su-email').value.trim();
      const password = root.querySelector('#su-password').value;
      const password2 = root.querySelector('#su-password2').value;
      if (!validUsername(username)) return err('Username needs 3 to 30 characters: lowercase letters, numbers or underscores.');
      if (!email) return err('Enter your email.');
      if (password.length < 8) return err('Password needs at least 8 characters.');
      if (password !== password2) return err('The two passwords do not match. Type them again.');
      btn.disabled = true;
      btn.textContent = 'Creating account…';
      const { session, error } = await signUpAccount({ email, password, username, firstName, lastName });
      btn.disabled = false;
      btn.textContent = 'Create account';
      if (error) return err(friendlyAuthError(error));
      if (!session) return err('Account created. Check your email to confirm it, then sign in.');
      tapHaptic();
      await startApp();
    });
    return;
  }

  root.innerHTML = authShell(`
    <h1 class="onboard-title">Keep Deutschtown clean, together.</h1>
    <p class="onboard-sub">Sign in to check in when you clean, earn points and mascot badges, and see your block shine on the neighborhood map.</p>
    <input class="text-input" id="si-email" type="email" placeholder="Email" autocomplete="email" style="margin-bottom:8px" />
    <input class="text-input" id="si-password" type="password" placeholder="Password" autocomplete="current-password" style="margin-bottom:8px" />
    <p id="auth-error" style="display:none;color:#c0392b;font-size:13px;margin:2px 0 8px"></p>
    <button class="btn btn--primary btn--block" id="si-go">Sign in</button>
    <button class="onboard-skip" id="si-forgot">Forgot password?</button>
    <button class="onboard-skip" id="si-toggle">New here? Create an account</button>`);

  const err = (m) => {
    const el = root.querySelector('#auth-error');
    el.textContent = m;
    el.style.display = 'block';
  };
  const doSignIn = async () => {
    const btn = root.querySelector('#si-go');
    const email = root.querySelector('#si-email').value.trim();
    const password = root.querySelector('#si-password').value;
    if (!email || !password) return err('Enter your email and password.');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    const { session, error } = await signInAccount(email, password);
    btn.disabled = false;
    btn.textContent = 'Sign in';
    if (error || !session) return err(friendlyAuthError(error));
    tapHaptic();
    await startApp();
  };
  root.querySelector('#si-go').addEventListener('click', doSignIn);
  root.querySelector('#si-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSignIn();
  });
  root.querySelector('#si-toggle').addEventListener('click', () => showAuth('signup'));
  root.querySelector('#si-forgot').addEventListener('click', async () => {
    const email = root.querySelector('#si-email').value.trim();
    if (!email) return err('Enter your email above first, then tap Forgot password.');
    const { error } = await resetPassword(email);
    if (error) return err(friendlyAuthError(error));
    toast('Password reset email sent. The link opens the web version to set a new password.', { emoji: '📧' });
  });
}

async function startApp() {
  appStarted = true;
  document.getElementById('tab-bar').style.display = '';
  document.body.classList.remove('no-tabs');
  await claimForAccount();
  // A cleanup was running when the app closed: go straight back to it.
  if (!hasActiveSession() && (await restoreSession())) {
    navigate('checkin');
    toast('Your cleanup is still running', { emoji: '🧹' });
  } else {
    navigate(hasActiveSession() ? 'checkin' : 'home');
  }
  syncNow();
  // Fill in the username and optional real name from the account the first time
  // (and after a different account signs in on this phone, initStore already reset state).
  if (!getState().profile.name) {
    const profile = await fetchMyProfile();
    if (profile) {
      setAccountProfile({
        username: profile.username || profile.full_name,
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
      });
      if (currentTab === 'profile') navigate('profile');
    }
  }
}

async function boot() {
  await initStore();

  if (Capacitor.isNativePlatform()) {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
    } catch (e) { /* not critical */ }
    // Coming back to the app: send anything queued and refresh the shared data.
    CapApp.addListener('resume', () => syncNow());
    // Android may close the app while the camera is open. The photo then
    // arrives here on relaunch, after the cleanup was restored from storage.
    CapApp.addListener('appRestoredResult', async (result) => {
      if (result.pluginId !== 'Camera' || !result.success || !result.data?.dataUrl) return;
      if (!hasActiveSession()) await restoreSession();
      if (addRestoredPhoto(result.data.dataUrl)) {
        if (currentTab === 'checkin') navigate('checkin');
        toast('Photo added', { emoji: '📸' });
      }
    });
    // Android back button: close sheet or go home before exiting.
    CapApp.addListener('backButton', ({ canGoBack }) => {
      const sheetOpen = document.querySelector('.sheet-wrap');
      if (sheetOpen) return closeSheet();
      if (currentTab !== 'home') return navigate('home');
      CapApp.exitApp();
    });
  }

  document.querySelectorAll('#tab-bar .tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      tapHaptic();
      navigate(btn.dataset.tab);
    });
  });

  if (await ensureSession()) {
    await startApp();
  } else {
    showAuth('signin');
  }

  // Signed out anywhere (You tab, expired session): wipe this phone's local
  // state so the next account starts clean, and go back to the auth screen.
  onAuthChange(async (session) => {
    if (!session && appStarted) {
      await resetAll();
      showAuth('signin');
    }
  });

  // Fresh leaderboard or feed arrived: redraw Home or You, but never under an open sheet.
  subscribeRemote(() => {
    if (document.querySelector('.auth-screen')) return; // never replace the sign-in screen
    if (document.querySelector('.sheet-wrap')) return;
    if (!['home', 'profile', 'events'].includes(currentTab)) return;
    const root = document.getElementById('screen-root');
    const top = root.scrollTop;
    navigate(currentTab);
    root.scrollTop = top;
  });

  if (Capacitor.isNativePlatform()) {
    try {
      await SplashScreen.hide();
    } catch (e) { /* not critical */ }
  }
}

boot();
