/**
 * Deadbird — background service worker
 * Tracks videos and pre-fetches the full vocab pipeline in the background.
 * Results cached in chrome.storage.local so the popup loads instantly.
 * Supports YouTube and Netflix.
 */

const API = 'https://project-deadbird-backend.onrender.com/api';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function getAuthToken() {
  const result = await chrome.storage.local.get('deadbird_token');
  return result.deadbird_token || null;
}

function authHeaders(token, extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// Netflix subtitle state
let currentNetflixVideoId = null;
let netflixSubtitles = {}; // { videoId: { ko: [...], en: [...], uk: [...] } }

// Offscreen document state
let offscreenDocumentCreated = false;

// Track tabs where audio capture is activated (user clicked extension icon)
let audioActivatedTabs = new Set();

// Track tabs with active persistent loopback
let loopbackActiveTabs = new Set();

// Restore audioActivatedTabs from session storage (survives service worker restarts)
chrome.storage.session.get('audioActivatedTabs').then(result => {
  if (result.audioActivatedTabs) {
    audioActivatedTabs = new Set(result.audioActivatedTabs);
    console.log('[Deadbird] Restored audioActivatedTabs:', [...audioActivatedTabs]);
  }
}).catch(() => {});

// Helper to persist audioActivatedTabs
function persistAudioTabs() {
  chrome.storage.session.set({ audioActivatedTabs: [...audioActivatedTabs] }).catch(() => {});
}

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  audioActivatedTabs.delete(tabId);
  persistAudioTabs();
  // Stop loopback for this tab
  if (loopbackActiveTabs.has(tabId)) {
    loopbackActiveTabs.delete(tabId);
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP_LOOPBACK' }).catch(() => {});
  }
});

// ─── YouTube auto-tracking via tab URL change ────────────────────────────────
// Deduplication: don't re-track the same video within 60 seconds
const recentlyTracked = new Map(); // videoId → timestamp

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only care about URL changes on YouTube watch pages
  const url = changeInfo.url;
  if (!url || !url.includes('youtube.com/watch')) return;

  let videoId;
  try {
    videoId = new URL(url).searchParams.get('v');
  } catch { return; }
  if (!videoId) return;

  // Skip if we tracked this video recently (content script may also fire)
  const lastTime = recentlyTracked.get(videoId);
  if (lastTime && Date.now() - lastTime < 60000) return;
  recentlyTracked.set(videoId, Date.now());

  // Don't use tab.title — it's often stale (shows previous video's title during navigation)
  // Let the content script provide the real title via TRACK_VIDEO message
  const title = 'Unknown';
  console.log(`[Deadbird] YouTube tab navigation: ${videoId} — awaiting title from content script`);
  await trackAndPrefetch(videoId, title);
});

// ─── Offscreen document management ───────────────────────────────────────────

async function ensureOffscreenDocument() {
  if (offscreenDocumentCreated) return;

  // Check if already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  });

  if (existingContexts.length > 0) {
    offscreenDocumentCreated = true;
    return;
  }

  // Create offscreen document
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Recording audio from tab for language learning flashcards'
  });
  offscreenDocumentCreated = true;
  console.log('[Deadbird] Offscreen document created');
}

/**
 * Start persistent audio loopback for a tab.
 * This allows seamless audio capture without glitches.
 */
async function startPersistentLoopback(tabId) {
  try {
    await ensureOffscreenDocument();

    // Get stream ID for the tab
    const streamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(streamId);
        }
      });
    });

    console.log('[Deadbird] 🔊 Starting persistent loopback with stream ID:', streamId);

    // Tell offscreen document to start persistent loopback
    const response = await chrome.runtime.sendMessage({
      type: 'OFFSCREEN_START_LOOPBACK',
      streamId: streamId,
    });

    if (response.success) {
      loopbackActiveTabs.add(tabId);
      console.log('[Deadbird] 🔊 Persistent loopback active for tab:', tabId);
    } else {
      throw new Error(response.error || 'Failed to start loopback');
    }
  } catch (e) {
    console.error('[Deadbird] Failed to start persistent loopback:', e);
    throw e;
  }
}

async function captureAudio(tabId, duration = 3000) {
  console.log('[Deadbird] 🎤 Starting audio capture, tabId:', tabId, 'duration:', duration);

  // Check if audio capture is enabled for this tab
  if (!audioActivatedTabs.has(tabId)) {
    console.log('[Deadbird] 🎤 Audio not enabled for tab. User needs to click "Enable Audio" in popup.');
    throw new Error('Audio capture not enabled. Click the Deadbird extension icon and enable audio.');
  }

  try {
    // Ensure offscreen document exists
    await ensureOffscreenDocument();

    // Always try persistent loopback first (the offscreen document knows if it's active)
    // This handles service worker restarts where loopbackActiveTabs gets cleared
    console.log('[Deadbird] 🎤 Trying persistent loopback for seamless capture');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'OFFSCREEN_RECORD_CLIP',
        duration: duration
      });

      if (response.success) {
        console.log('[Deadbird] 🎤 Audio captured (seamless), size:', response.audioData?.size);
        // Re-add to loopbackActiveTabs in case service worker restarted
        loopbackActiveTabs.add(tabId);
        return response.audioData;
      }

      // If loopback not active, the error will be "Loopback not active"
      console.log('[Deadbird] 🎤 Persistent loopback not ready:', response.error);
    } catch (loopbackErr) {
      console.log('[Deadbird] 🎤 Loopback attempt failed:', loopbackErr.message);
    }

    // Fallback: Start fresh loopback (this will fail if stream already active)
    // Try to start persistent loopback first
    console.log('[Deadbird] 🎤 Attempting to start fresh loopback');
    try {
      await startPersistentLoopback(tabId);
      // Now try recording again
      const response = await chrome.runtime.sendMessage({
        type: 'OFFSCREEN_RECORD_CLIP',
        duration: duration
      });
      if (response.success) {
        console.log('[Deadbird] 🎤 Audio captured after loopback restart, size:', response.audioData?.size);
        return response.audioData;
      }
    } catch (restartErr) {
      console.log('[Deadbird] 🎤 Could not restart loopback:', restartErr.message);
    }

    // Final fallback: Legacy mode (will likely fail if stream is active)
    console.log('[Deadbird] 🎤 Final fallback: legacy recording');
    const streamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(streamId);
        }
      });
    });

    const response = await chrome.runtime.sendMessage({
      type: 'OFFSCREEN_START_RECORDING',
      streamId: streamId,
      duration: duration
    });

    if (!response.success) {
      throw new Error(response.error || 'Recording failed');
    }

    console.log('[Deadbird] 🎤 Audio captured (legacy), size:', response.audioData?.size);
    return response.audioData;
  } catch (e) {
    console.error('[Deadbird] Audio capture failed:', e);
    throw e;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Enable audio capture for a tab (from popup)
  if (msg.type === 'ENABLE_AUDIO_CAPTURE') {
    audioActivatedTabs.add(msg.tabId);
    persistAudioTabs();
    console.log('[Deadbird] Audio capture enabled for tab:', msg.tabId);
    chrome.action.setBadgeText({ text: '🎤', tabId: msg.tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId: msg.tabId });

    // Start persistent loopback for seamless audio
    startPersistentLoopback(msg.tabId)
      .then(() => {
        console.log('[Deadbird] Persistent loopback started for tab:', msg.tabId);
        sendResponse({ success: true });
      })
      .catch(e => {
        console.error('[Deadbird] Failed to start loopback:', e);
        sendResponse({ success: true }); // Still mark as enabled, will use legacy mode
      });
    return true; // async response
  }

  // Check if audio is enabled for a tab
  if (msg.type === 'CHECK_AUDIO_ENABLED') {
    sendResponse({ enabled: audioActivatedTabs.has(msg.tabId) });
    return;
  }

  // Netflix interceptor injection
  if (msg.type === 'INJECT_NETFLIX_INTERCEPTOR' && sender.tab) {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: 'MAIN',
      files: ['inject.js']
    }).catch(e => console.error('[Deadbird] Failed to inject:', e));
    return;
  }

  // Screenshot capture for Netflix
  if (msg.type === 'CAPTURE_SCREENSHOT' && sender.tab) {
    console.log('[Deadbird] 📷 Capture request received, tabId:', sender.tab.id, 'windowId:', sender.tab.windowId);
    captureScreenshot(sender.tab.id, sender.tab.windowId)
      .then(dataUrl => {
        console.log('[Deadbird] 📷 Capture successful, size:', dataUrl?.length);
        sendResponse({ success: true, dataUrl });
      })
      .catch(e => {
        console.error('[Deadbird] Screenshot failed:', e);
        sendResponse({ success: false, error: e.message });
      });
    return true; // async response
  }

  // Audio capture for Netflix
  if (msg.type === 'CAPTURE_AUDIO' && sender.tab) {
    console.log('[Deadbird] 🎤 Audio capture request, tabId:', sender.tab.id, 'duration:', msg.duration);
    captureAudio(sender.tab.id, msg.duration || 3000)
      .then(audioData => {
        console.log('[Deadbird] 🎤 Audio capture successful');
        sendResponse({ success: true, audioData });
      })
      .catch(e => {
        console.error('[Deadbird] Audio capture failed:', e);
        sendResponse({ success: false, error: e.message });
      });
    return true; // async response
  }

  // Combined screenshot + audio capture for Netflix
  if (msg.type === 'CAPTURE_SCREENSHOT_AND_AUDIO' && sender.tab) {
    console.log('[Deadbird] 📷🎤 Combined capture request, tabId:', sender.tab.id);
    Promise.all([
      captureScreenshot(sender.tab.id, sender.tab.windowId),
      captureAudio(sender.tab.id, msg.duration || 3000)
    ])
      .then(([screenshotDataUrl, audioData]) => {
        console.log('[Deadbird] 📷🎤 Combined capture successful');
        sendResponse({ success: true, screenshotDataUrl, audioData });
      })
      .catch(e => {
        console.error('[Deadbird] Combined capture failed:', e);
        sendResponse({ success: false, error: e.message });
      });
    return true; // async response
  }

  // YouTube tracking (from content script — also checks dedup)
  if (msg.type === 'TRACK_VIDEO') {
    const lastTime = recentlyTracked.get(msg.videoId);
    if (lastTime && Date.now() - lastTime < 60000) {
      // Already tracked recently by tabs.onUpdated — just update title if better
      if (msg.title && msg.title !== 'Unknown') {
        fetch(`${API}/videos/${msg.videoId}/title`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: msg.title }),
        }).catch(() => {});
      }
      sendResponse({ success: true, is_new: false });
    } else {
      recentlyTracked.set(msg.videoId, Date.now());
      trackAndPrefetch(msg.videoId, msg.title, msg.lang || 'ko').then(sendResponse);
    }
    return true;
  }
  if (msg.type === 'GET_VOCAB') {
    getCachedVocab(msg.videoId, msg.lang || 'ko').then(sendResponse);
    return true;
  }

  // Netflix tracking
  if (msg.type === 'TRACK_NETFLIX') {
    currentNetflixVideoId = msg.videoId;
    netflixSubtitles[msg.videoId] = netflixSubtitles[msg.videoId] || {};
    trackNetflix(msg.videoId, msg.title, msg.audioLang, msg.episodeInfo).then(sendResponse);
    return true;
  }
  // Update Netflix title (when we get a better title later)
  if (msg.type === 'UPDATE_NETFLIX_TITLE') {
    updateNetflixTitle(msg.videoId, msg.title);
    return;
  }
  // Netflix audio language detected/changed
  if (msg.type === 'NETFLIX_AUDIO_LANGUAGE') {
    updateNetflixAudioLanguage(msg.videoId, msg.audioLang);
    return;
  }
  if (msg.type === 'NETFLIX_SUBTITLES') {
    // Received subtitles from content script
    console.log(`[Deadbird] Received ${msg.subtitles.length} subtitles for Netflix ${msg.videoId}`);
    processNetflixSubtitles(msg.videoId, msg.subtitles, msg.language);
    sendResponse({ success: true });
    return true;
  }
  if (msg.type === 'GET_NETFLIX_SUBTITLES') {
    sendResponse(netflixSubtitles[msg.videoId] || {});
    return true;
  }

  // Get keyword timestamps for targeted screenshot capture
  if (msg.type === 'GET_KEYWORD_TIMESTAMPS') {
    const key = `keyword_timestamps_${msg.videoId}`;
    chrome.storage.local.get(key).then(result => {
      sendResponse(result[key] || []);
    });
    return true;
  }

  // Save screenshot to backend
  if (msg.type === 'SAVE_NETFLIX_SCREENSHOT') {
    saveScreenshotToBackend(msg.videoId, msg.timestamp, msg.dataUrl);
    return;
  }

  // Save thumbnail for Netflix video
  if (msg.type === 'SAVE_NETFLIX_THUMBNAIL') {
    saveThumbnailToBackend(msg.videoId, msg.dataUrl);
    return;
  }

  // Save audio to backend
  if (msg.type === 'SAVE_NETFLIX_AUDIO') {
    saveAudioToBackend(msg.videoId, msg.timestamp, msg.audioData);
    return;
  }

  // Save both screenshot and audio to backend
  if (msg.type === 'SAVE_NETFLIX_MEDIA') {
    if (msg.screenshotDataUrl) {
      saveScreenshotToBackend(msg.videoId, msg.timestamp, msg.screenshotDataUrl);
    }
    if (msg.audioData) {
      saveAudioToBackend(msg.videoId, msg.timestamp, msg.audioData);
    }
    return;
  }
});

// ─── Netflix subtitle processing (received from content script) ──────────────

function detectSubtitleLanguage(url, content) {
  // Try to detect from URL parameters or content
  const urlLower = url.toLowerCase();

  // Common Netflix URL patterns for language
  if (urlLower.includes('ko') || urlLower.includes('korean')) return 'ko';
  if (urlLower.includes('uk') || urlLower.includes('ukrainian')) return 'uk';
  if (urlLower.includes('en') || urlLower.includes('english')) return 'en';

  // Try to detect from content
  const contentSample = content.slice(0, 2000).toLowerCase();

  // Check for Korean characters (Hangul)
  if (/[\uAC00-\uD7AF]/.test(contentSample)) return 'ko';

  // Check for Ukrainian characters (Cyrillic with Ukrainian-specific letters)
  if (/[\u0400-\u04FF]/.test(contentSample) && /[іїєґ]/i.test(contentSample)) return 'uk';

  // Check for mostly ASCII (likely English)
  if (/^[\x00-\x7F\s]+$/.test(contentSample.replace(/<[^>]*>/g, ''))) return 'en';

  return null;
}

function parseTTML(xml) {
  const subtitles = [];
  // Match <p> elements with timing
  const pRegex = /<p[^>]*begin="([^"]+)"[^>]*end="([^"]+)"[^>]*>([\s\S]*?)<\/p>/gi;
  let match;

  while ((match = pRegex.exec(xml)) !== null) {
    const begin = parseTimeToSeconds(match[1]);
    const end = parseTimeToSeconds(match[2]);
    const text = match[3]
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    if (text) {
      subtitles.push({
        start: begin,
        end: end,
        duration: end - begin,
        text: text,
      });
    }
  }

  return subtitles;
}

function parseWebVTT(vtt) {
  const subtitles = [];
  const lines = vtt.split('\n');
  let i = 0;

  while (i < lines.length) {
    // Look for timestamp line (00:00:00.000 --> 00:00:00.000)
    const timeLine = lines[i];
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/);

    if (timeMatch) {
      const start = parseTimeToSeconds(timeMatch[1]);
      const end = parseTimeToSeconds(timeMatch[2]);

      // Collect text lines until empty line
      i++;
      let textLines = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim());
        i++;
      }

      const text = textLines.join(' ')
        .replace(/<[^>]*>/g, '')
        .trim();

      if (text) {
        subtitles.push({
          start: start,
          end: end,
          duration: end - start,
          text: text,
        });
      }
    }
    i++;
  }

  return subtitles;
}

function parseTimeToSeconds(timeStr) {
  // Handle formats: "00:00:00.000", "00:00.000", "00:00:00,000"
  const normalized = timeStr.replace(',', '.');
  const parts = normalized.split(':');

  if (parts.length === 3) {
    const [h, m, s] = parts;
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
  } else if (parts.length === 2) {
    const [m, s] = parts;
    return parseInt(m) * 60 + parseFloat(s);
  }
  return parseFloat(normalized);
}

async function trackNetflix(videoId, title, audioLang, episodeInfo) {
  try {
    const token = await getAuthToken();
    // Track the video with platform indicator
    const res = await fetch(`${API}/videos/track`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        video_id: `netflix_${videoId}`,
        title: title,
        platform: 'netflix',
        audio_lang: audioLang,
        season: episodeInfo?.season || null,
        episode: episodeInfo?.episode || null,
        episode_title: episodeInfo?.episodeTitle || null,
      }),
    });
    const data = await res.json();

    // Use shared updateStatus helper for language marking
    if (audioLang === 'ko' || audioLang === 'uk') {
      await updateStatus(`netflix_${videoId}`, audioLang, true);
      console.log(`[Deadbird] Marked video as having ${audioLang} (audio detected)`);
    }

    return { success: true, is_new: data.is_new };
  } catch (e) {
    console.error('[Deadbird] Error tracking Netflix:', e);
    return { success: false };
  }
}

async function updateNetflixTitle(videoId, title) {
  try {
    const res = await fetch(`${API}/videos/netflix_${videoId}/title`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      console.log(`[Deadbird] Updated Netflix title: ${title}`);
    }
  } catch (e) {
    // Silently fail - title update is optional
  }
}

async function updateNetflixAudioLanguage(videoId, audioLang) {
  if (audioLang === 'ko' || audioLang === 'uk') {
    await updateStatus(`netflix_${videoId}`, audioLang, true);
    console.log(`[Deadbird] Updated: ${audioLang} audio detected`);
  }
}

async function processNetflixSubtitles(videoId, subtitles, lang) {
  // Subtitles are already merged by content script
  const netflixVideoId = `netflix_${videoId}`;
  try {
    const res = await fetch(`${API}/netflix/subtitles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: netflixVideoId,
        language: lang,
        subtitles: subtitles,
      }),
    });

    const data = await res.json();

    // Store keyword timestamps for targeted screenshot capture
    if (data.keyword_timestamps && data.keyword_timestamps.length > 0) {
      const key = `keyword_timestamps_${videoId}`;
      await chrome.storage.local.set({ [key]: data.keyword_timestamps });
      console.log(`[Deadbird] Stored ${data.keyword_timestamps.length} keyword timestamps for ${videoId}`);
    }

    // Run vocab pipeline
    runVocabPipeline(netflixVideoId, lang);
  } catch (e) {
    console.error('[Deadbird] Error sending Netflix subtitles:', e);
  }
}

async function trackAndPrefetch(videoId, title, lang = 'ko') {
  const token = await getAuthToken();
  if (!token) {
    console.warn('[Deadbird] No auth token — open the Deadbird app and log in first.');
    return { success: false, reason: 'no_token' };
  }

  try {
    // 1. Track the video
    const res = await fetch(`${API}/videos/track`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ video_id: videoId, title }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[Deadbird] Track failed:', res.status, err.detail || '');
      return { success: false, reason: res.status };
    }

    const data = await res.json();
    console.log(`[Deadbird] Tracked: ${videoId} — ${title} (new: ${data.is_new})`);

    // 2. Run vocab pipeline for BOTH languages (fire and forget)
    runVocabPipeline(videoId, 'ko');
    runVocabPipeline(videoId, 'uk');

    return { success: true, is_new: data.is_new };
  } catch (e) {
    console.error('[Deadbird] trackAndPrefetch error:', e);
    return { success: false };
  }
}

async function runVocabPipeline(videoId, lang = 'ko') {
  const cacheKey = `vocab_${lang}_${videoId}`;

  // Check if we have a recent cache
  const existing = await chrome.storage.local.get(cacheKey);
  if (existing[cacheKey] && !existing[cacheKey].loading) {
    const age = Date.now() - (existing[cacheKey].cachedAt || 0);
    if (age < CACHE_TTL_MS) return; // Fresh cache, skip
  }

  // Mark as loading
  await chrome.storage.local.set({ [cacheKey]: { loading: true, cachedAt: Date.now() } });

  try {
    // Step 1: fetch/cache subtitles (skip for Netflix - already captured)
    if (!videoId.startsWith('netflix_')) {
      const subRes = await fetch(`${API}/subtitles/${videoId}?lang=${lang}`);
      if (!subRes.ok) throw new Error('subtitles');
    }

    // Step 2: vocabulary (all words in freq list, no level filter)
    const vocabRes = await fetch(`${API}/vocabulary/${videoId}?limit=20&lang=${lang}`);
    if (!vocabRes.ok) throw new Error('vocab');
    const vocab = await vocabRes.json();

    if (!vocab.total_words) {
      // No target language vocab found — update status and cache empty result
      await updateStatus(videoId, lang, false);
      await chrome.storage.local.set({
        [cacheKey]: { loading: false, words: [], total: 0, cachedAt: Date.now() }
      });
      return;
    }

    // Step 3: flashcard data (English definitions + example sentences)
    const wordList = vocab.vocabulary.map(v => v.word);
    const fcRes = await fetch(`${API}/flashcard-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId, words: wordList, word_source: 'essential', language: lang }),
    });

    let words;
    if (fcRes.ok) {
      const fc = await fcRes.json();
      // Merge rank from vocab into flashcard data
      const rankMap = {};
      vocab.vocabulary.forEach(v => { rankMap[v.word] = v.rank; });
      words = fc.flashcards.map(card => ({
        ...card,
        rank: rankMap[card.target_word] || 0,
      }));

    } else {
      // Fallback: vocab words without flashcard enrichment
      words = vocab.vocabulary.map(v => ({
        target_word: v.word,
        dictionary_form: v.word,
        english: null,
        sentence: null,
        sentence_translation: null,
        rank: v.rank,
      }));
    }

    // Update language status to true
    await updateStatus(videoId, lang, true);

    await chrome.storage.local.set({
      [cacheKey]: { loading: false, words, total: words.length, cachedAt: Date.now() }
    });
  } catch {
    await chrome.storage.local.set({
      [cacheKey]: { loading: false, error: true, words: null, cachedAt: Date.now() }
    });
  }
}

async function updateStatus(videoId, lang, value) {
  if (lang === 'uk') {
    await fetch(`${API}/videos/${videoId}/status/ukrainian`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ has_ukrainian: value }),
    }).catch(() => {});
  } else {
    await fetch(`${API}/videos/${videoId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ has_korean: value }),
    }).catch(() => {});
  }
}

async function getCachedVocab(videoId, lang = 'ko') {
  const cacheKey = `vocab_${lang}_${videoId}`;
  const result = await chrome.storage.local.get(cacheKey);
  return result[cacheKey] || { loading: true };
}

// ─── Screenshot capture ──────────────────────────────────────────────────────

async function captureScreenshot(tabId, windowId) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: 'jpeg',
      quality: 85
    });
    return dataUrl;
  } catch (e) {
    console.error('[Deadbird] captureVisibleTab failed:', e);
    throw e;
  }
}

async function saveScreenshotToBackend(videoId, timestamp, dataUrl) {
  try {
    const res = await fetch(`${API}/netflix/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId, timestamp, data_url: dataUrl }),
    });
    if (res.ok) {
      console.log(`[Deadbird] Screenshot saved to backend: ${videoId} @ ${timestamp}s`);
    }
  } catch (e) {
    console.error('[Deadbird] Failed to save screenshot:', e);
  }
}

async function saveAudioToBackend(videoId, timestamp, audioData) {
  try {
    const res = await fetch(`${API}/netflix/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: videoId,
        timestamp: timestamp,
        audio_data: audioData.base64,
        mime_type: audioData.mimeType,
      }),
    });
    if (res.ok) {
      console.log(`[Deadbird] Audio saved to backend: ${videoId} @ ${timestamp}s`);
    }
  } catch (e) {
    console.error('[Deadbird] Failed to save audio:', e);
  }
}

async function saveThumbnailToBackend(videoId, dataUrl) {
  try {
    const res = await fetch(`${API}/netflix/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: videoId,
        data_url: dataUrl,
      }),
    });
    if (res.ok) {
      console.log(`[Deadbird] Thumbnail saved for: ${videoId}`);
    }
  } catch (e) {
    console.error('[Deadbird] Failed to save thumbnail:', e);
  }
}