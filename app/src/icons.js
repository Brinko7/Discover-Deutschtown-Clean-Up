// Inline SVG icon set (Tabler-style 24px strokes) — bundled so the app
// needs no icon CDN at runtime.
const svg = (paths, filled = false) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="${filled ? 'currentColor' : 'none'}" stroke="${filled ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export const icons = {
  home: svg('<path d="M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"/>'),
  map: svg('<path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z"/><path d="M9 4v13M15 7v13"/>'),
  sparkle: svg('<path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/>'),
  calendar: svg('<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4M8 3v4M4 11h16"/>'),
  user: svg('<circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>'),
  camera: svg('<path d="M5 7h1a2 2 0 0 0 2-2 1 1 0 0 1 1-1h6a1 1 0 0 1 1 1 2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3"/>'),
  location: svg('<path d="M12 21c-4.5-4-8-7.6-8-11a8 8 0 0 1 16 0c0 3.4-3.5 7-8 11z"/><circle cx="12" cy="10" r="3"/>'),
  crosshair: svg('<circle cx="12" cy="12" r="7"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'),
  flame: svg('<path d="M12 3s-5 4.5-5 9a5 5 0 0 0 10 0c0-1.5-.5-3-1.5-4.5C14.5 9 13 10 13 11.5c0 0-1-2.5-1-8.5z"/>'),
  trophy: svg('<path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0z"/><path d="M7 6H4a1 1 0 0 0-1 1 4 4 0 0 0 4 4M17 6h3a1 1 0 0 1 1 1 4 4 0 0 1-4 4"/>'),
  heart: svg('<path d="M19.5 12.6L12 20l-7.5-7.4A5 5 0 1 1 12 6.3a5 5 0 1 1 7.5 6.3z"/>'),
  share: svg('<circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4"/>'),
  chevronRight: svg('<path d="M9 6l6 6-6 6"/>'),
  chevronLeft: svg('<path d="M15 6l-6 6 6 6"/>'),
  x: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  check: svg('<path d="M5 12l5 5L20 7"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  play: svg('<path d="M7 4v16l13-8z"/>', true),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="2"/>', true),
  search: svg('<circle cx="10" cy="10" r="7"/><path d="M21 21l-6-6"/>'),
  users: svg('<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.1a4 4 0 0 1 0 7.8M21 21v-2a4 4 0 0 0-3-3.9"/>'),
  medal: svg('<circle cx="12" cy="15" r="5"/><path d="M9 10.5L7 3h4l1 4 1-4h4l-2 7.5"/>'),
  gift: svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>'),
  note: svg('<path d="M13 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7l-7 7z"/><path d="M13 20v-5a2 2 0 0 1 2-2h5"/>'),
  leaf: svg('<path d="M5 21c.5-4.5 2.5-8 7-10"/><path d="M9 18c6.2 1.1 10-3.4 11-13-9.6 1-14.1 4.8-13 11 .3 1.3 1 2 2 2z"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>'),
  edit: svg('<path d="M7 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1"/><path d="M20.4 7.3a2.1 2.1 0 0 0-3-3L9 12v3h3z"/>'),
  bolt: svg('<path d="M13 3L4 14h6l-1 7 9-11h-6z"/>'),
};

export function icon(name, cls = '') {
  return `<span class="icon ${cls}">${icons[name] || ''}</span>`;
}
