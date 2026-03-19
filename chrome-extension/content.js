/**
 * Deadbird — content script
 * Detects YouTube video navigation (SPA) and sends video ID + title to background.
 * Also tracks actual watch time while video is playing.
 * Caption filtering (Korean + English required) is handled server-side.
 */

let lastTrackedId = null;

// ─── Watch time tracking ─────────────────────────────────────────────────────
let watchTimeAccumulator = 0; // Seconds accumulated since last sync
let lastWatchTimeSync = Date.now();
let isVideoPlaying = false;
let watchTimeInterval = null;
const WATCH_TIME_SYNC_INTERVAL = 30000; // Sync every 30 seconds

function getVideoElement() {
  return document.querySelector('video.html5-main-video') || document.querySelector('video');
}

function startWatchTimeTracking() {
  if (watchTimeInterval) return; // Already tracking

  const video = getVideoElement();
  if (!video) return;

  // Listen for play/pause events
  video.addEventListener('play', () => {
    isVideoPlaying = true;
    console.log('[Deadbird] Video playing - tracking watch time');
  });

  video.addEventListener('pause', () => {
    isVideoPlaying = false;
    console.log('[Deadbird] Video paused');
    // Sync immediately on pause
    syncWatchTime();
  });

  video.addEventListener('ended', () => {
    isVideoPlaying = false;
    syncWatchTime();
  });

  // Set initial state
  isVideoPlaying = !video.paused;

  // Accumulate watch time every second
  watchTimeInterval = setInterval(() => {
    if (isVideoPlaying && lastTrackedId) {
      watchTimeAccumulator++;

      // Sync periodically
      if (Date.now() - lastWatchTimeSync >= WATCH_TIME_SYNC_INTERVAL) {
        syncWatchTime();
      }
    }
  }, 1000);
}

function syncWatchTime() {
  if (watchTimeAccumulator > 0 && lastTrackedId) {
    const secondsToSync = watchTimeAccumulator;
    watchTimeAccumulator = 0;
    lastWatchTimeSync = Date.now();

    console.log(`[Deadbird] Syncing ${secondsToSync}s watch time for ${lastTrackedId}`);

    try {
      chrome.runtime.sendMessage({
        type: 'UPDATE_WATCH_TIME',
        videoId: lastTrackedId,
        seconds: secondsToSync,
        platform: 'youtube'
      }, () => { try { void chrome.runtime.lastError; } catch (_) {} });
    } catch (_) {}
  }
}

function resetWatchTimeTracking() {
  // Sync any remaining time before resetting
  syncWatchTime();
  watchTimeAccumulator = 0;
  isVideoPlaying = false;
}

function getVideoId() {
  return new URLSearchParams(location.search).get('v');
}

function getTitle() {
  const selectors = [
    'h1.ytd-watch-metadata yt-formatted-string',
    '#above-the-fold #title h1',
    'ytd-watch-metadata h1 yt-formatted-string',
    '#title h1 yt-formatted-string',
    'h1.style-scope.ytd-watch-metadata',
  ];
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return document.title.replace(' - YouTube', '').trim() || 'Unknown';
}

function sendTrack(videoId) {
  // Reset watch time when switching videos
  resetWatchTimeTracking();

  // Retry up to 5 times (2.5s) waiting for title to render
  let attempts = 0;
  const interval = setInterval(() => {
    try {
      const title = getTitle();
      attempts++;
      if ((title && title !== 'Unknown') || attempts >= 5) {
        clearInterval(interval);
        chrome.runtime.sendMessage({
          type: 'TRACK_VIDEO',
          videoId,
          title: (title && title !== 'Unknown') ? title : 'Unknown',
        }, () => { try { void chrome.runtime.lastError; } catch (_) {} });

        // Start tracking watch time for this video
        setTimeout(startWatchTimeTracking, 1000);
      }
    } catch (_) {
      // Extension context invalidated (extension reloaded while tab was open) — stop silently
      clearInterval(interval);
    }
  }, 500);
}

function checkForNewVideo() {
  try {
    const videoId = getVideoId();
    if (videoId && videoId !== lastTrackedId) {
      lastTrackedId = videoId;
      lastHref = location.href;
      sendTrack(videoId);
    }
  } catch (_) {}
}

let lastHref = location.href;

// YouTube fires this event on every SPA navigation — most reliable trigger
window.addEventListener('yt-navigate-finish', checkForNewVideo);

// Fallback interval for cases where the event doesn't fire
const navInterval = setInterval(() => {
  try {
    if (location.href === lastHref) return;
    lastHref = location.href;
    checkForNewVideo();
  } catch (_) {
    clearInterval(navInterval);
  }
}, 1000);

// Track on initial page load (e.g. direct link to a watch URL)
checkForNewVideo();

// Sync watch time when page is about to unload
window.addEventListener('beforeunload', () => {
  syncWatchTime();
});

// Also sync on visibility change (user switches tabs)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    syncWatchTime();
  }
});
