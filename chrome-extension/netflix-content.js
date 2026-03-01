/**
 * Deadbird — Netflix content script
 * Detects Netflix video playback and intercepts subtitle requests.
 */

let lastTrackedId = null;
let titleCheckInterval = null;
let screenshotCache = {}; // { timestamp: true } - tracks what we've already captured
let keywordTimestamps = []; // Timestamps where keywords appear (from backend)
let keywordTimestampsFetched = false;

// Extract Netflix video ID from URL (e.g., /watch/81234567)
function getVideoId() {
  try {
    const match = location.pathname.match(/\/watch\/(\d+)/);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

// Extract title from Netflix player UI
function getTitle() {
  try {
    const selectors = [
      '[data-uia="video-title"] h4',
      '[data-uia="video-title"]',
      '.video-title h4',
      '.video-title',
    ];

    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el?.textContent?.trim()) {
        return el.textContent.trim();
      }
    }

    return document.title.replace(' | Netflix', '').replace(' - Netflix', '').trim() || 'Unknown';
  } catch (e) {
    return 'Unknown';
  }
}

// Detect language from subtitle content
function detectLanguage(text) {
  const sample = text.slice(0, 3000);
  // Check for Korean (Hangul)
  if (/[\uAC00-\uD7AF]/.test(sample)) return 'ko';
  // Check for Ukrainian (Cyrillic with Ukrainian letters)
  if (/[\u0400-\u04FF]/.test(sample) && /[іїєґІЇЄҐ]/.test(sample)) return 'uk';
  // Check for mostly Latin (English)
  const textOnly = sample.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
  if (/^[\x20-\x7E\s]+$/.test(textOnly.slice(0, 500))) return 'en';
  return null;
}

// Parse TTML subtitle format
function parseTTML(xml) {
  const subtitles = [];
  const pRegex = /<p[^>]*begin="([^"]+)"[^>]*end="([^"]+)"[^>]*>([\s\S]*?)<\/p>/gi;
  let match;

  while ((match = pRegex.exec(xml)) !== null) {
    const begin = parseTime(match[1]);
    const end = parseTime(match[2]);
    const text = match[3]
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

    if (text) {
      subtitles.push({ start: begin, end: end, duration: end - begin, text });
    }
  }
  return subtitles;
}

// Parse WebVTT subtitle format
function parseWebVTT(vtt) {
  const subtitles = [];
  const blocks = vtt.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const timeMatch = lines[i].match(/(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/);
      if (timeMatch) {
        const start = parseTime(timeMatch[1]);
        const end = parseTime(timeMatch[2]);
        const textLines = lines.slice(i + 1).filter(l => l.trim() && !l.match(/^\d+$/));
        const text = textLines.join(' ').replace(/<[^>]*>/g, '').trim();
        if (text) {
          subtitles.push({ start, end, duration: end - start, text });
        }
        break;
      }
    }
  }
  return subtitles;
}

function parseTime(timeStr) {
  const normalized = timeStr.replace(',', '.');

  // Handle Netflix tick format (e.g., "660242916t" or just large numbers)
  // Netflix uses 10,000,000 ticks per second
  if (normalized.endsWith('t')) {
    return parseInt(normalized.slice(0, -1)) / 10000000;
  }

  // If it's a large number without colons, assume tick format
  const parts = normalized.split(':');
  if (parts.length === 1) {
    const num = parseFloat(normalized);
    // If the number is larger than a reasonable timestamp (e.g., > 100000 seconds = ~28 hours),
    // it's probably in tick format
    if (num > 100000) {
      return num / 10000000;
    }
    return num;
  }

  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(normalized);
}

// Process captured subtitle
function processSubtitle(text, url) {
  const videoId = getVideoId();
  if (!videoId) return;

  let subtitles;
  if (text.includes('<tt') || text.includes('<?xml')) {
    subtitles = parseTTML(text);
  } else if (text.includes('WEBVTT')) {
    subtitles = parseWebVTT(text);
  } else {
    return;
  }

  if (subtitles.length === 0) return;

  const lang = detectLanguage(text);
  if (!lang) return;

  console.log(`[Deadbird] Captured ${subtitles.length} ${lang} subtitles`);

  // Only process Korean or Ukrainian (skip English-only)
  if (lang !== 'ko' && lang !== 'uk') {
    console.log(`[Deadbird] Skipping ${lang} subtitles (not target language)`);
    return;
  }

  // Format subtitles for backend (English will be translated via DeepL)
  const formatted = subtitles.map(sub => ({
    start: sub.start,
    end: sub.end,
    duration: sub.duration,
    [lang === 'ko' ? 'korean' : 'ukrainian']: sub.text,
    english: '', // Will be translated by backend
  }));

  console.log(`[Deadbird] Sending ${formatted.length} ${lang} subtitles to background`);
  chrome.runtime.sendMessage({
    type: 'NETFLIX_SUBTITLES',
    videoId,
    language: lang,
    subtitles: formatted,
  });
}

// Request background to inject the fetch interceptor
function injectInterceptor() {
  chrome.runtime.sendMessage({ type: 'INJECT_NETFLIX_INTERCEPTOR' });
}

// Fetch keyword timestamps from background (set by backend after subtitle processing)
async function fetchKeywordTimestamps(videoId) {
  try {
    const timestamps = await chrome.runtime.sendMessage({
      type: 'GET_KEYWORD_TIMESTAMPS',
      videoId: videoId,
    });
    if (timestamps && timestamps.length > 0) {
      keywordTimestamps = timestamps;
      keywordTimestampsFetched = true;
      console.log(`[Deadbird] Loaded ${timestamps.length} keyword timestamps for screenshots`);
    }
  } catch (e) {
    console.error('[Deadbird] Failed to get keyword timestamps:', e);
  }
}

// Check if current timestamp is near a keyword timestamp (within 1 second)
function isKeywordTimestamp(timestamp) {
  const rounded = Math.floor(timestamp);
  return keywordTimestamps.some(kt => Math.abs(kt - rounded) <= 1);
}

// Capture screenshot only at keyword timestamps
async function captureScreenshotForTimestamp(timestamp) {
  const videoId = getVideoId();
  if (!videoId) {
    console.log('[Deadbird] ❌ No video ID found');
    return null;
  }

  const roundedTimestamp = Math.floor(timestamp);

  // Skip if we already captured this timestamp
  if (screenshotCache[roundedTimestamp]) {
    console.log('[Deadbird] ⏭️ Already captured timestamp:', roundedTimestamp);
    return null;
  }

  // Only capture at keyword timestamps
  if (!isKeywordTimestamp(timestamp)) {
    console.log('[Deadbird] ⏭️ Not a keyword timestamp:', roundedTimestamp, '(keywords:', keywordTimestamps.slice(0, 5).join(', '), '...)');
    return null;
  }

  console.log('[Deadbird] ✅ Capturing screenshot at keyword timestamp:', roundedTimestamp);

  try {
    const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' });
    console.log('[Deadbird] 📷 Capture response:', response);

    if (response?.success && response.dataUrl) {
      screenshotCache[roundedTimestamp] = true; // Mark as captured
      console.log(`[Deadbird] 📸 Screenshot captured at ${roundedTimestamp}s (keyword), size: ${response.dataUrl.length}`);

      // Send to backend immediately
      chrome.runtime.sendMessage({
        type: 'SAVE_NETFLIX_SCREENSHOT',
        videoId: `netflix_${videoId}`,
        timestamp: roundedTimestamp,
        dataUrl: response.dataUrl,
      });

      return response.dataUrl;
    } else {
      console.log('[Deadbird] ❌ Capture failed - success:', response?.success, 'hasDataUrl:', !!response?.dataUrl, 'error:', response?.error);
    }
  } catch (e) {
    console.error('[Deadbird] Screenshot capture failed:', e);
  }
  return null;
}

// Listen for intercepted subtitles and screenshot requests
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data?.type === 'DEADBIRD_SUBTITLE') {
    processSubtitle(event.data.text, event.data.url);
  }

  if (event.data?.type === 'DEADBIRD_CAPTURE_SCREENSHOT') {
    console.log('[Deadbird] 📨 Received screenshot request for timestamp:', event.data.timestamp);
    console.log('[Deadbird] 📊 Keyword timestamps loaded:', keywordTimestamps.length, 'timestamps');
    console.log('[Deadbird] 🔍 Is keyword timestamp?', isKeywordTimestamp(event.data.timestamp));
    captureScreenshotForTimestamp(event.data.timestamp);
  }
});

function sendTrack(videoId) {
  if (titleCheckInterval) clearInterval(titleCheckInterval);
  screenshotCache = {}; // Reset screenshot cache for new video
  keywordTimestamps = []; // Reset keyword timestamps
  keywordTimestampsFetched = false;

  let attempts = 0;
  titleCheckInterval = setInterval(() => {
    try {
      const title = getTitle();
      attempts++;

      if ((title && title !== 'Unknown') || attempts >= 10) {
        clearInterval(titleCheckInterval);
        titleCheckInterval = null;

        console.log('[Deadbird] Tracking Netflix video:', videoId, title);
        chrome.runtime.sendMessage({
          type: 'TRACK_NETFLIX',
          videoId,
          title: (title && title !== 'Unknown') ? title : 'Unknown',
          platform: 'netflix',
        });

        // Start polling for keyword timestamps (set after subtitles processed)
        startKeywordTimestampPolling(videoId);
      }
    } catch (e) {}
  }, 500);
}

// Poll for keyword timestamps until we get them (subtitles may take time to process)
function startKeywordTimestampPolling(videoId) {
  let pollAttempts = 0;
  const maxAttempts = 30; // Try for ~30 seconds

  const pollInterval = setInterval(async () => {
    pollAttempts++;

    if (keywordTimestampsFetched || pollAttempts >= maxAttempts) {
      clearInterval(pollInterval);
      if (!keywordTimestampsFetched) {
        console.log('[Deadbird] Keyword timestamps not available yet');
      }
      return;
    }

    await fetchKeywordTimestamps(videoId);
  }, 1000);
}

let lastHref = location.href;

function checkNavigation() {
  try {
    if (location.href === lastHref) return;
    lastHref = location.href;

    const videoId = getVideoId();
    if (videoId && videoId !== lastTrackedId) {
      lastTrackedId = videoId;
      sendTrack(videoId);
    }
  } catch (e) {}
}

// Initialize
console.log('[Deadbird] Netflix content script loading...');
injectInterceptor();
setInterval(checkNavigation, 1000);

const videoId = getVideoId();
if (videoId) {
  console.log('[Deadbird] Netflix video detected:', videoId);
  lastTrackedId = videoId;
  sendTrack(videoId);
}
