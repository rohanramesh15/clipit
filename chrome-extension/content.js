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
        }, () => void chrome.runtime.lastError);
      }
    } catch (_) {
      // Extension context invalidated (extension reloaded while tab was open) — stop silently
      clearInterval(interval);
    }
  }, 500);
}

let lastHref = location.href;

const navInterval = setInterval(() => {
  try {
    if (location.href === lastHref) return;
    lastHref = location.href;
    const videoId = getVideoId();
    if (videoId && videoId !== lastTrackedId) {
      lastTrackedId = videoId;
      sendTrack(videoId);
    }
  } catch (_) {
    // Extension context invalidated — stop polling
    clearInterval(navInterval);
  }
}, 1000);

// Track on initial page load
try {
  const videoId = getVideoId();
  if (videoId) {
    lastTrackedId = videoId;
    sendTrack(videoId);
  }
} catch (_) {
  // Context already invalid on load — nothing to do
}
