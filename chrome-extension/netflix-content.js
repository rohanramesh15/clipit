/**
 * Deadbird — Netflix content script
 * Detects Netflix video playback and intercepts subtitle requests.
 * Also tracks actual watch time while video is playing.
 */

let lastTrackedId = null;
let titleCheckInterval = null;
let screenshotCache = {}; // { timestamp: true } - tracks what we've already captured
let keywordTimestamps = []; // Timestamps where keywords appear (from backend)
let keywordTimestampsFetched = false;
let detectedAudioLang = null; // Track the detected audio language

// ─── Watch time tracking ─────────────────────────────────────────────────────
let watchTimeAccumulator = 0; // Seconds accumulated since last sync
let lastWatchTimeSync = Date.now();
let isVideoPlaying = false;
let watchTimeInterval = null;
const WATCH_TIME_SYNC_INTERVAL = 30000; // Sync every 30 seconds

function getNetflixVideoElement() {
  return document.querySelector('video');
}

function startWatchTimeTracking() {
  if (watchTimeInterval) return; // Already tracking

  const video = getNetflixVideoElement();
  if (!video) {
    // Retry after a delay if video not found yet
    setTimeout(startWatchTimeTracking, 1000);
    return;
  }

  // Listen for play/pause events
  video.addEventListener('play', () => {
    isVideoPlaying = true;
    console.log('[Deadbird] Netflix video playing - tracking watch time');
  });

  video.addEventListener('pause', () => {
    isVideoPlaying = false;
    console.log('[Deadbird] Netflix video paused');
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

    console.log(`[Deadbird] Syncing ${secondsToSync}s watch time for Netflix ${lastTrackedId}`);

    try {
      chrome.runtime.sendMessage({
        type: 'UPDATE_WATCH_TIME',
        videoId: lastTrackedId,
        seconds: secondsToSync,
        platform: 'netflix'
      }, () => { try { void chrome.runtime.lastError; } catch (_) {} });
    } catch (_) {}
  }
}

function resetWatchTimeTracking() {
  syncWatchTime();
  watchTimeAccumulator = 0;
  isVideoPlaying = false;
}

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

// Extract Netflix video ID from URL (e.g., /watch/81234567)
function getVideoId() {
  try {
    const match = location.pathname.match(/\/watch\/(\d+)/);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

// Detect selected audio language from Netflix
function getAudioLanguage() {
  try {
    // Check URL parameter (Netflix uses ?al=ko for Korean audio)
    const urlParams = new URLSearchParams(location.search);
    const audioLang = urlParams.get('al');
    if (audioLang) {
      console.log('[Deadbird] Audio language from URL:', audioLang);
      return audioLang;
    }

    // Check the audio selector in Netflix player UI
    const audioSelectors = [
      // Selected audio track indicator
      '[data-uia="audio-tracks-item-selected"]',
      '.track-list-audio .selected',
      '[data-uia="track-list-audio"] .track-item-selected',
    ];

    for (const selector of audioSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.toLowerCase() || '';
        if (text.includes('korean') || text.includes('한국어')) return 'ko';
        if (text.includes('ukrainian') || text.includes('українська')) return 'uk';
        if (text.includes('english')) return 'en';
      }
    }

    // Check for language indicators in the player
    const langIndicators = document.querySelectorAll('[class*="audio"], [class*="language"]');
    for (const el of langIndicators) {
      const text = el.textContent?.toLowerCase() || '';
      if (text.includes('korean') || text.includes('한국어')) return 'ko';
      if (text.includes('ukrainian') || text.includes('українська')) return 'uk';
    }

    return null;
  } catch (e) {
    return null;
  }
}

// Monitor for audio language changes
function startAudioLanguageMonitor(videoId) {
  // Check immediately
  const checkAudio = () => {
    const lang = getAudioLanguage();
    if (lang && lang !== detectedAudioLang) {
      detectedAudioLang = lang;
      console.log('[Deadbird] Detected audio language:', lang);

      // Notify backend about audio language
      chrome.runtime.sendMessage({
        type: 'NETFLIX_AUDIO_LANGUAGE',
        videoId,
        audioLang: lang,
      });
    }
  };

  checkAudio();

  // Also check periodically (user might change audio)
  const interval = setInterval(checkAudio, 3000);

  // Clean up after 60 seconds (most language changes happen early)
  setTimeout(() => clearInterval(interval), 60000);
}

// Extract season/episode info from Netflix player UI
function getEpisodeInfo() {
  try {
    // Netflix shows episode info in various places
    const selectors = [
      // Episode title/number in player
      '[data-uia="video-title"] span',
      '[data-uia="video-title-episode"]',
      '.ellipsize-text[data-uia*="episode"]',
      // Season/episode indicators
      '.video-title span:not(:first-child)',
      '[class*="episode"]',
      '[class*="season"]',
    ];

    let season = null;
    let episode = null;
    let episodeTitle = null;

    // Try to find season/episode from UI elements
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent?.trim() || '';

        // Match patterns like "S1:E5", "Season 1 Episode 5", "시즌 1 에피소드 5"
        const seMatch = text.match(/S(\d+)\s*[:\s]\s*E(\d+)/i) ||
                        text.match(/Season\s*(\d+).*Episode\s*(\d+)/i) ||
                        text.match(/시즌\s*(\d+).*에피소드\s*(\d+)/i);
        if (seMatch) {
          season = parseInt(seMatch[1]);
          episode = parseInt(seMatch[2]);
        }

        // Match just episode like "E5" or "Episode 5"
        const eMatch = text.match(/^E(\d+)$/i) || text.match(/Episode\s*(\d+)/i);
        if (eMatch && !episode) {
          episode = parseInt(eMatch[1]);
        }

        // Match just season
        const sMatch = text.match(/^S(\d+)$/i) || text.match(/Season\s*(\d+)/i);
        if (sMatch && !season) {
          season = parseInt(sMatch[1]);
        }
      }
    }

    // Try to get episode title (usually after the S1:E1 part)
    const titleEl = document.querySelector('[data-uia="video-title"]');
    if (titleEl) {
      const spans = titleEl.querySelectorAll('span');
      if (spans.length > 1) {
        // Usually format is: "Show Name" "S1:E1" "Episode Title"
        const lastSpan = spans[spans.length - 1];
        const text = lastSpan.textContent?.trim();
        if (text && !text.match(/^S\d+/i) && !text.match(/^E\d+/i)) {
          episodeTitle = text;
        }
      }
    }

    // Also check document title for episode info
    const docTitle = document.title;
    if (!season || !episode) {
      const docMatch = docTitle.match(/S(\d+)\s*[:\s]\s*E(\d+)/i) ||
                       docTitle.match(/Season\s*(\d+).*Episode\s*(\d+)/i);
      if (docMatch) {
        season = season || parseInt(docMatch[1]);
        episode = episode || parseInt(docMatch[2]);
      }
    }

    if (season || episode) {
      console.log('[Deadbird] Episode info:', { season, episode, episodeTitle });
      return { season, episode, episodeTitle };
    }

    return null;
  } catch (e) {
    return null;
  }
}

// Extract title from Netflix player UI
function getTitle() {
  try {
    // Try various Netflix UI selectors (Netflix changes these frequently)
    const selectors = [
      // Standard player title selectors
      '[data-uia="video-title"] h4',
      '[data-uia="video-title"]',
      '[data-uia="player-title"]',
      '.video-title h4',
      '.video-title',
      // Mini player / preview title
      '.previewModal--player-titleTreatment-logo',
      '.title-card-title-text',
      // Watch page title elements
      '.watch-video--evidence-overlay-title',
      '.ellipsize-text',
      // Fallback: any element with title-like classes
      '[class*="title-treatment"]',
      '[class*="videoTitle"]',
    ];

    for (const s of selectors) {
      const el = document.querySelector(s);
      const text = el?.textContent?.trim() || el?.getAttribute('alt')?.trim();
      if (text && text.length > 1 && text.toLowerCase() !== 'netflix') {
        return text;
      }
    }

    // Try document.title - Netflix usually sets it to "Show Name | Netflix"
    const docTitle = document.title;
    if (docTitle && docTitle !== 'Netflix') {
      // Remove common Netflix suffixes
      const cleaned = docTitle
        .replace(/\s*[\|\-]\s*Netflix.*$/i, '')
        .replace(/^Netflix\s*[\|\-]\s*/i, '')
        .replace(/\s*-\s*Watch.*$/i, '')
        .trim();
      if (cleaned && cleaned.length > 1 && cleaned.toLowerCase() !== 'netflix') {
        return cleaned;
      }
    }

    // Try to get from meta tags
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    if (ogTitle && ogTitle.toLowerCase() !== 'netflix') {
      return ogTitle.replace(/\s*[\|\-]\s*Netflix.*$/i, '').trim();
    }

    return 'Unknown';
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

  // Try to update the title now that page is fully loaded
  const title = getTitle();
  if (title && title !== 'Unknown') {
    chrome.runtime.sendMessage({
      type: 'UPDATE_NETFLIX_TITLE',
      videoId,
      title,
    });
  }

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

// Capture screenshot and audio at keyword timestamps
async function captureMediaForTimestamp(timestamp) {
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

  console.log('[Deadbird] ✅ Capturing screenshot + audio at keyword timestamp:', roundedTimestamp);

  try {
    // Capture screenshot immediately
    const screenshotResponse = await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' });
    console.log('[Deadbird] 📷 Screenshot response:', screenshotResponse?.success);

    if (screenshotResponse?.success && screenshotResponse.dataUrl) {
      screenshotCache[roundedTimestamp] = true; // Mark as captured
      console.log(`[Deadbird] 📸 Screenshot captured at ${roundedTimestamp}s, size: ${screenshotResponse.dataUrl.length}`);

      // Send screenshot to backend
      chrome.runtime.sendMessage({
        type: 'SAVE_NETFLIX_SCREENSHOT',
        videoId: `netflix_${videoId}`,
        timestamp: roundedTimestamp,
        dataUrl: screenshotResponse.dataUrl,
      });
    } else {
      console.log('[Deadbird] ❌ Screenshot failed:', screenshotResponse?.error);
    }

    // Capture 3 seconds of audio (starts from current playback position)
    try {
      const audioResponse = await chrome.runtime.sendMessage({
        type: 'CAPTURE_AUDIO',
        duration: 3000, // 3 seconds
      });

      if (audioResponse?.success && audioResponse.audioData) {
        console.log(`[Deadbird] 🎵 Audio captured at ${roundedTimestamp}s, size: ${audioResponse.audioData.size}`);

        // Send audio to backend
        chrome.runtime.sendMessage({
          type: 'SAVE_NETFLIX_AUDIO',
          videoId: `netflix_${videoId}`,
          timestamp: roundedTimestamp,
          audioData: audioResponse.audioData,
        });
      } else if (audioResponse?.error?.includes('not enabled')) {
        // Only log once per session to avoid spam
        if (!window._deadbirdAudioWarningShown) {
          console.log('[Deadbird] 💡 Tip: Click the Deadbird extension icon and enable audio to capture sentence audio');
          window._deadbirdAudioWarningShown = true;
        }
      } else {
        console.log('[Deadbird] ⚠️ Audio capture unavailable:', audioResponse?.error);
      }
    } catch (audioErr) {
      // Audio capture is optional - don't fail the whole operation
      if (!window._deadbirdAudioWarningShown) {
        console.log('[Deadbird] 💡 Tip: Click the Deadbird extension icon and enable audio to capture sentence audio');
        window._deadbirdAudioWarningShown = true;
      }
    }

    return screenshotResponse?.dataUrl;
  } catch (e) {
    console.error('[Deadbird] Media capture failed:', e);
  }
  return null;
}

// Alias for backwards compatibility
const captureScreenshotForTimestamp = captureMediaForTimestamp;

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
  detectedAudioLang = null; // Reset audio language

  // Reset watch time tracking when switching videos
  resetWatchTimeTracking();

  let attempts = 0;
  let lastTitle = null;
  let thumbnailCaptured = false;
  titleCheckInterval = setInterval(() => {
    try {
      const title = getTitle();
      const audioLang = getAudioLanguage();
      const episodeInfo = getEpisodeInfo();
      attempts++;

      // Keep trying if we only have "Unknown" - Netflix may take time to load
      // But track immediately if we get a real title
      const hasRealTitle = title && title !== 'Unknown';

      if (hasRealTitle || attempts >= 20) {
        clearInterval(titleCheckInterval);
        titleCheckInterval = null;

        const finalTitle = hasRealTitle ? title : (lastTitle || 'Netflix Video');
        console.log('[Deadbird] Tracking Netflix video:', videoId, finalTitle, 'audio:', audioLang, 'episode:', episodeInfo);
        chrome.runtime.sendMessage({
          type: 'TRACK_NETFLIX',
          videoId,
          title: finalTitle,
          platform: 'netflix',
          audioLang: audioLang,
          episodeInfo: episodeInfo,
        });

        // Capture thumbnail after a short delay (let video load)
        if (!thumbnailCaptured) {
          setTimeout(() => captureThumbnail(videoId), 2000);
          thumbnailCaptured = true;
        }

        // Start monitoring for audio language changes
        startAudioLanguageMonitor(videoId);

        // Start polling for keyword timestamps (set after subtitles processed)
        startKeywordTimestampPolling(videoId);

        // Start tracking watch time for this video
        setTimeout(startWatchTimeTracking, 1000);
      } else if (title && title !== 'Unknown') {
        lastTitle = title;
      }
    } catch (e) {}
  }, 500);
}

// Capture a thumbnail for the video
async function captureThumbnail(videoId) {
  try {
    console.log('[Deadbird] Capturing thumbnail for video:', videoId);
    const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' });

    if (response?.success && response.dataUrl) {
      console.log('[Deadbird] Thumbnail captured, saving...');
      chrome.runtime.sendMessage({
        type: 'SAVE_NETFLIX_THUMBNAIL',
        videoId: `netflix_${videoId}`,
        dataUrl: response.dataUrl,
      });
    }
  } catch (e) {
    console.log('[Deadbird] Thumbnail capture failed:', e.message);
  }
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
