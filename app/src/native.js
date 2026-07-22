// Thin wrappers around Capacitor native plugins with graceful web fallbacks,
// so the whole app works in a desktop browser during development.
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { ZONE_POLYGONS, BLOCKS, ZONES } from './data.js';

export const isNative = Capacitor.isNativePlatform();

// ── Haptics ──────────────────────────────────────────────────

export function tapHaptic() {
  if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export function successHaptic() {
  if (isNative) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}

// ── Camera ───────────────────────────────────────────────────

// Returns a dataUrl string, or null if the user cancelled.
export async function takePhoto() {
  if (isNative) {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt, // lets the user pick camera or library
        quality: 60,
        width: 1200,
        correctOrientation: true,
        promptLabelHeader: 'Add a cleanup photo',
        promptLabelPhoto: 'Choose from library',
        promptLabelPicture: 'Take photo',
      });
      return photo.dataUrl || null;
    } catch (e) {
      // User cancelled the prompt — not an error.
      return null;
    }
  }
  // Web fallback: native file input (mobile browsers open the camera with capture).
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      downscaleImage(file, 1200, 0.6).then(resolve).catch(() => resolve(null));
    };
    // cancel event fires on modern browsers when the picker is dismissed
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function downscaleImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Geolocation ──────────────────────────────────────────────

export async function getPosition() {
  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 12000,
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

// Ray-casting point-in-polygon; polygon is [[lat,lng], ...].
export function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function polygonCentroid(polygon) {
  let lat = 0;
  let lng = 0;
  polygon.forEach(([a, b]) => {
    lat += a;
    lng += b;
  });
  return [lat / polygon.length, lng / polygon.length];
}

// Finds where the user is standing: exact polygon hit first,
// otherwise the nearest zone within 400m of its centroid.
export function locateArea(lat, lng) {
  let zone = null;
  for (const z of ZONES) {
    const poly = ZONE_POLYGONS[z.id];
    if (poly && pointInPolygon(lat, lng, poly)) {
      zone = z;
      break;
    }
  }
  let block = null;
  if (zone) {
    for (const b of BLOCKS) {
      if (b.zoneId === zone.id && b.polygon.length >= 3 && pointInPolygon(lat, lng, b.polygon)) {
        block = b;
        break;
      }
    }
    return { zone, block, nearby: false };
  }
  // Not inside any zone — suggest the closest one if reasonably near.
  let best = null;
  let bestDist = Infinity;
  for (const z of ZONES) {
    const poly = ZONE_POLYGONS[z.id];
    if (!poly || !poly.length) continue;
    const [clat, clng] = polygonCentroid(poly);
    const d = distanceMeters(lat, lng, clat, clng);
    if (d < bestDist) {
      bestDist = d;
      best = z;
    }
  }
  if (best && bestDist <= 400) return { zone: best, block: null, nearby: true };
  return { zone: null, block: null, nearby: false };
}

// ── Share ────────────────────────────────────────────────────

export async function shareApp(text) {
  const payload = {
    title: 'Mind Your Block',
    text: text || 'Join me keeping Deutschtown clean — check in, earn points, adopt a block!',
    url: 'https://mindyourblock.org',
  };
  try {
    if (isNative || navigator.share) {
      await Share.share(payload);
      return true;
    }
  } catch (e) {
    /* cancelled */
  }
  try {
    await navigator.clipboard.writeText(`${payload.text} ${payload.url}`);
    return 'copied';
  } catch (e) {
    return false;
  }
}
