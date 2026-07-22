import 'leaflet/dist/leaflet.css';
import './styles.css';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import { initStore, getState, setProfileName } from './store.js';
import { icons } from './icons.js';
import { tapHaptic } from './native.js';
import { closeSheet } from './ui.js';
import { renderHome } from './screens/home.js';
import { renderMap } from './screens/map.js';
import { renderCheckin, hasActiveSession } from './screens/checkin.js';
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

function showOnboarding() {
  const root = document.getElementById('screen-root');
  document.getElementById('tab-bar').style.display = 'none';
  root.innerHTML = `
    <div class="onboard-screen screen">
      <div class="onboard-art">
        <div class="hero-blob" style="width:340px;height:340px;top:-90px;right:-120px"></div>
        <div class="hero-blob" style="width:200px;height:200px;top:180px;left:-90px;opacity:.08"></div>
        <div style="position:absolute;top:24%;left:0;right:0;text-align:center;font-size:84px">🧹</div>
      </div>
      <div style="position:relative">
        <div class="onboard-logo">
          <svg width="26" height="26" viewBox="0 0 26 26"><g fill="#85ceac"><rect x="1" y="1" width="7" height="7" rx="1.5"/><rect x="9.5" y="1" width="7" height="7" rx="1.5" opacity=".55"/><rect x="18" y="1" width="7" height="7" rx="1.5"/><rect x="1" y="9.5" width="7" height="7" rx="1.5" opacity=".55"/><rect x="9.5" y="9.5" width="7" height="7" rx="1.5"/><rect x="18" y="9.5" width="7" height="7" rx="1.5" opacity=".55"/><rect x="1" y="18" width="7" height="7" rx="1.5"/><rect x="9.5" y="18" width="7" height="7" rx="1.5" opacity=".55"/><rect x="18" y="18" width="7" height="7" rx="1.5"/></g></svg>
          MIND YOUR BLOCK
        </div>
        <h1 class="onboard-title">Keep Deutschtown clean, together.</h1>
        <p class="onboard-sub">Check in when you clean, earn points and mascot badges, and see your block shine on the neighborhood map.</p>
        <input class="text-input" id="onboard-name" placeholder="What should we call you?" maxlength="30" autocomplete="name" />
        <button class="btn btn--primary btn--block" id="onboard-go">Let's clean up</button>
        <button class="onboard-skip" id="onboard-skip">Continue as guest</button>
      </div>
    </div>`;

  const finish = (name) => {
    tapHaptic();
    setProfileName(name || 'Neighbor');
    document.getElementById('tab-bar').style.display = '';
    navigate('home');
  };
  root.querySelector('#onboard-go').addEventListener('click', () => finish(root.querySelector('#onboard-name').value));
  root.querySelector('#onboard-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(e.target.value);
  });
  root.querySelector('#onboard-skip').addEventListener('click', () => finish(''));
}

async function boot() {
  await initStore();

  if (Capacitor.isNativePlatform()) {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
    } catch (e) { /* not critical */ }
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

  if (!getState().profile.onboarded) {
    showOnboarding();
  } else {
    navigate('home');
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await SplashScreen.hide();
    } catch (e) { /* not critical */ }
  }
}

boot();
