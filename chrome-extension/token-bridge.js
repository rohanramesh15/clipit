/**
 * token-bridge.js — content script injected into the ClipIt frontend.
 * Reads the JWT from localStorage and syncs it into chrome.storage.local so that
 * the background service worker and popup can attach it to authenticated API requests.
 *
 * The `storage` event only fires in OTHER windows, not the window that called setItem.
 * So we poll every second to catch same-window login/logout events.
 *
 * Injected into:
 * - https://theclipitapp.com/* (production)
 */

let lastSynced = null;
let lastTheme = null;
let lastLanguage = null;
let syncInterval = null;

function extensionStorageAvailable() {
  return Boolean(chrome?.runtime?.id && chrome?.storage?.local);
}

function stopSyncingAfterReload(error) {
  console.warn('[ClipIt] Extension context unavailable; refresh the page after reloading the extension.', error);
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

function syncToken() {
  try {
    if (!extensionStorageAvailable()) return;
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
  } catch (error) {
    stopSyncingAfterReload(error);
  }
}

function syncPreferences() {
  try {
    if (!extensionStorageAvailable()) return;
    const theme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
    const language = localStorage.getItem('deadbird_language') === 'uk' ? 'uk' : 'ko';

    const updates = {};
    if (theme !== lastTheme) {
      updates.theme = theme;
      lastTheme = theme;
    }
    if (language !== lastLanguage) {
      updates.language = language;
      lastLanguage = language;
    }

    if (Object.keys(updates).length) {
      chrome.storage.local.set(updates);
      console.log('[ClipIt] Preferences synced to extension storage', updates);
    }
  } catch (error) {
    stopSyncingAfterReload(error);
  }
}

// Sync immediately on page load
syncToken();
syncPreferences();

// Poll every second to catch same-window login/logout
syncInterval = setInterval(() => {
  syncToken();
  syncPreferences();
}, 1000);
