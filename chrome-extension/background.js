/**
 * Deadbird — background service worker
 * Tracks videos and pre-fetches the full vocab pipeline in the background.
 * Results cached in chrome.storage.local so the popup loads instantly.
 */

const API = 'http://localhost:8000/api';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'TRACK_VIDEO') {
    trackAndPrefetch(msg.videoId, msg.title).then(sendResponse);
    return true;
  }
  if (msg.type === 'GET_VOCAB') {
    getCachedVocab(msg.videoId).then(sendResponse);
    return true;
  }
});

async function trackAndPrefetch(videoId, title) {
  try {
    // 1. Track the video
    const res = await fetch(`${API}/videos/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId, title }),
    });
    const data = await res.json();

    // 2. Run the full vocab pipeline in background (don't await — fire and forget)
    runVocabPipeline(videoId);

    return { success: true, is_new: data.is_new };
  } catch {
    return { success: false };
  }
}

async function runVocabPipeline(videoId) {
  const cacheKey = `vocab_${videoId}`;

  // Check if we have a recent cache
  const existing = await chrome.storage.local.get(cacheKey);
  if (existing[cacheKey] && !existing[cacheKey].loading) {
    const age = Date.now() - (existing[cacheKey].cachedAt || 0);
    if (age < CACHE_TTL_MS) return; // Fresh cache, skip
  }

  // Mark as loading
  await chrome.storage.local.set({ [cacheKey]: { loading: true, cachedAt: Date.now() } });

  try {
    // Step 1: fetch/cache subtitles
    const subRes = await fetch(`${API}/subtitles/${videoId}`);
    if (!subRes.ok) throw new Error('subtitles');

    // Step 2: vocabulary (all words in freq list, no level filter)
    const vocabRes = await fetch(`${API}/vocabulary/${videoId}?limit=20`);
    if (!vocabRes.ok) throw new Error('vocab');
    const vocab = await vocabRes.json();

    if (!vocab.total_words) {
      // No Korean vocab found — update status and cache empty result
      await fetch(`${API}/videos/${videoId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ has_korean: false }),
      }).catch(() => {});
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
      body: JSON.stringify({ video_id: videoId, words: wordList, word_source: 'essential' }),
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

    // Update has_korean status to true
    await fetch(`${API}/videos/${videoId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ has_korean: true }),
    }).catch(() => {});

    await chrome.storage.local.set({
      [cacheKey]: { loading: false, words, total: words.length, cachedAt: Date.now() }
    });
  } catch {
    await chrome.storage.local.set({
      [cacheKey]: { loading: false, error: true, words: null, cachedAt: Date.now() }
    });
  }
}

async function getCachedVocab(videoId) {
  const cacheKey = `vocab_${videoId}`;
  const result = await chrome.storage.local.get(cacheKey);
  return result[cacheKey] || { loading: true };
}
