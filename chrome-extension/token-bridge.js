/**
 * token-bridge.js — content script injected into the Deadbird frontend (localhost:5176).
 * Reads the JWT from localStorage and syncs it into chrome.storage.local so that
 * the background service worker and popup can attach it to authenticated API requests.
 *
 * The `storage` event only fires in OTHER windows, not the window that called setItem.
 * So we poll every second to catch same-window login/logout events.
 */

let lastSynced = null;

function syncToken() {
  const token = localStorage.getItem('deadbird_token') || null;
  if (token === lastSynced) return; // nothing changed
  lastSynced = token;
  if (token) {
    chrome.storage.local.set({ deadbird_token: token });
    console.log('[Deadbird] Token synced to extension storage');
  } else {
    chrome.storage.local.remove('deadbird_token');
    console.log('[Deadbird] Token removed from extension storage');
  }
}

// Sync immediately on page load
syncToken();

// Poll every second to catch same-window login/logout
setInterval(syncToken, 1000);
