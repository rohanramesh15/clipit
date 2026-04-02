/**
 * token-bridge.js — content script injected into the ClipIt frontend.
 * Reads the JWT from localStorage and syncs it into chrome.storage.local so that
 * the background service worker and popup can attach it to authenticated API requests.
 *
 * The `storage` event only fires in OTHER windows, not the window that called setItem.
 * So we poll every second to catch same-window login/logout events.
 *
 * Injected into:
 * - http://localhost:5176/* (development)
 * - https://project-deadbird-frontend.fly.dev/* (production)
 */

let lastSynced = null;

function syncToken() {
  // Check both localStorage and sessionStorage (for "Remember me" off)
  const token = localStorage.getItem('deadbird_token') || sessionStorage.getItem('deadbird_token') || null;
  if (token === lastSynced) return; // nothing changed
  lastSynced = token;
  if (token) {
    chrome.storage.local.set({ deadbird_token: token });
    console.log('[ClipIt] Token synced to extension storage');
  } else {
    chrome.storage.local.remove('deadbird_token');
    console.log('[ClipIt] Token removed from extension storage');
  }
}

// Sync immediately on page load
syncToken();

// Poll every second to catch same-window login/logout
setInterval(syncToken, 1000);
