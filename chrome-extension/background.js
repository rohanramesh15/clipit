/**
 * Deadbird — background service worker
 * Handles video tracking and prefetches subtitles immediately after tracking.
 */

const API = 'http://localhost:8000/api';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'TRACK_VIDEO') {
    trackAndPrefetch(msg.videoId, msg.title, msg.captionLanguages || []).then(sendResponse);
    return true;
  }
});

async function trackAndPrefetch(videoId, title, captionLanguages = []) {
  try {
    // 1. Track the video
    const res = await fetch(`${API}/videos/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId, title, caption_languages: captionLanguages }),
    });
    const data = await res.json();

    // 2. Prefetch subtitles in background so popup loads faster
    if (data.is_new) {
      fetch(`${API}/subtitles/${videoId}`).catch(() => {});
    }

    return { success: true };
  } catch {
    return { success: false };
  }
}
