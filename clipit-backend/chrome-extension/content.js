/**
 * Deadbird — content script
 * Detects YouTube video navigation (SPA) and sends video ID + title to background.
 * Caption filtering (Korean + English required) is handled server-side.
 */

let lastTrackedId = null;

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
