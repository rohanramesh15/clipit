/**
 * Subtitle fetcher for YouTube videos
 * Fetches subtitles directly from YouTube's timedtext API using the user's browser
 * This avoids backend IP blocking issues
 */

/**
 * Fetch available caption tracks for a video
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Array>} Array of available caption tracks
 */
async function getAvailableCaptions(videoId) {
  try {
    // YouTube's timedtext list endpoint
    const url = `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`;
    const response = await fetch(url);
    const xml = await response.text();

    // Parse XML manually (DOMParser not available in service workers)
    const tracks = [];
    const trackRegex = /<track[^>]*>/gi;
    const matches = xml.match(trackRegex);

    if (matches) {
      for (const match of matches) {
        const langMatch = match.match(/lang_code="([^"]+)"/);
        const nameMatch = match.match(/name="([^"]+)"/);
        const kindMatch = match.match(/kind="([^"]+)"/);

        tracks.push({
          lang: langMatch ? langMatch[1] : null,
          name: nameMatch ? nameMatch[1] : null,
          kind: kindMatch ? kindMatch[1] : null
        });
      }
    }

    return tracks;
  } catch (error) {
    console.error('[Deadbird] Failed to get caption list:', error);
    return [];
  }
}

/**
 * Fetch subtitles for a specific language
 * @param {string} videoId - YouTube video ID
 * @param {string} lang - Language code (e.g., 'ko', 'uk', 'en')
 * @returns {Promise<Array|null>} Array of subtitle objects or null if not available
 */
async function fetchSubtitles(videoId, lang) {
  try {
    // Try to get subtitles in JSON3 format (easiest to parse)
    const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`;
    const response = await fetch(url);

    if (!response.ok) {
      console.log(`[Deadbird] No ${lang} subtitles available for ${videoId}`);
      return null;
    }

    const data = await response.json();

    // Convert YouTube's JSON3 format to our format
    if (!data.events) return null;

    const subtitles = [];
    for (const event of data.events) {
      if (!event.segs) continue; // Skip events without text

      const text = event.segs.map(seg => seg.utf8).join('');
      if (!text || !text.trim()) continue;

      subtitles.push({
        text: text.trim(),
        start: event.tStartMs / 1000, // Convert ms to seconds
        duration: (event.dDurationMs || 0) / 1000
      });
    }

    return subtitles;
  } catch (error) {
    console.error(`[Deadbird] Error fetching ${lang} subtitles:`, error);
    return null;
  }
}

/**
 * Try to get Korean subtitles with fallback to translation
 * @param {string} videoId - YouTube video ID
 * @param {Array} availableTracks - Available caption tracks (may be incomplete due to API issues)
 * @returns {Promise<Array|null>} Korean subtitles or null
 */
async function fetchKoreanSubtitles(videoId, _availableTracks) {
  // Always try fetching Korean directly first (don't rely on availableTracks which may be incomplete)
  const subs = await fetchSubtitles(videoId, 'ko');
  if (subs && subs.length > 0) {
    console.log(`[Deadbird] Found ${subs.length} Korean subtitles via direct fetch`);
    return subs;
  }

  // Fallback: try English with Korean translation
  console.log('[Deadbird] No direct Korean subs, trying English→Korean translation');
  try {
    const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&tlang=ko&fmt=json3`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.events) {
        const subtitles = [];
        for (const event of data.events) {
          if (!event.segs) continue;
          const text = event.segs.map(seg => seg.utf8).join('');
          if (!text || !text.trim()) continue;
          subtitles.push({
            text: text.trim(),
            start: event.tStartMs / 1000,
            duration: (event.dDurationMs || 0) / 1000
          });
        }
        if (subtitles.length > 0) {
          console.log(`[Deadbird] Found ${subtitles.length} Korean subtitles via translation`);
          return subtitles;
        }
      }
    }
  } catch (error) {
    console.error('[Deadbird] Korean translation failed:', error);
  }

  return null;
}

/**
 * Try to get Ukrainian subtitles with fallback to translation
 * @param {string} videoId - YouTube video ID
 * @param {Array} availableTracks - Available caption tracks (may be incomplete due to API issues)
 * @returns {Promise<Array|null>} Ukrainian subtitles or null
 */
async function fetchUkrainianSubtitles(videoId, _availableTracks) {
  // Always try fetching Ukrainian directly first (don't rely on availableTracks which may be incomplete)
  const subs = await fetchSubtitles(videoId, 'uk');
  if (subs && subs.length > 0) {
    console.log(`[Deadbird] Found ${subs.length} Ukrainian subtitles via direct fetch`);
    return subs;
  }

  // Fallback: try English with Ukrainian translation
  console.log('[Deadbird] No direct Ukrainian subs, trying English→Ukrainian translation');
  try {
    const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&tlang=uk&fmt=json3`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.events) {
        const subtitles = [];
        for (const event of data.events) {
          if (!event.segs) continue;
          const text = event.segs.map(seg => seg.utf8).join('');
          if (!text || !text.trim()) continue;
          subtitles.push({
            text: text.trim(),
            start: event.tStartMs / 1000,
            duration: (event.dDurationMs || 0) / 1000
          });
        }
        if (subtitles.length > 0) {
          console.log(`[Deadbird] Found ${subtitles.length} Ukrainian subtitles via translation`);
          return subtitles;
        }
      }
    }
  } catch (error) {
    console.error('[Deadbird] Ukrainian translation failed:', error);
  }

  return null;
}

/**
 * Merge Korean and English subtitles by timestamp
 * @param {Array} koreanSubs - Korean subtitles
 * @param {Array} englishSubs - English subtitles
 * @returns {Array} Merged subtitles
 */
function mergeSubtitles(koreanSubs, englishSubs) {
  const merged = [];

  for (const koSub of koreanSubs) {
    if (!koSub.text || !koSub.text.trim()) continue;

    // Find matching English subtitle (within 1 second)
    const matchingEng = englishSubs.find(enSub =>
      Math.abs(koSub.start - enSub.start) < 1.0
    );

    if (matchingEng && matchingEng.text && matchingEng.text.trim()) {
      merged.push({
        start: koSub.start,
        duration: koSub.duration,
        end: koSub.start + koSub.duration,
        korean: koSub.text,
        english: matchingEng.text
      });
    }
  }

  return merged;
}

/**
 * Merge Ukrainian and English subtitles by timestamp
 * @param {Array} ukrainianSubs - Ukrainian subtitles
 * @param {Array} englishSubs - English subtitles
 * @returns {Array} Merged subtitles
 */
function mergeUkrainianSubtitles(ukrainianSubs, englishSubs) {
  const merged = [];

  for (const ukSub of ukrainianSubs) {
    if (!ukSub.text || !ukSub.text.trim()) continue;

    // Find matching English subtitle (within 1 second)
    const matchingEng = englishSubs.find(enSub =>
      Math.abs(ukSub.start - enSub.start) < 1.0
    );

    if (matchingEng && matchingEng.text && matchingEng.text.trim()) {
      merged.push({
        start: ukSub.start,
        duration: ukSub.duration,
        end: ukSub.start + ukSub.duration,
        ukrainian: ukSub.text,
        english: matchingEng.text
      });
    }
  }

  return merged;
}

/**
 * Fetch and process all subtitles for a video
 * @param {string} videoId - YouTube video ID
 * @param {string} lang - Target language ('ko' or 'uk')
 * @returns {Promise<Object>} Subtitle data ready to send to backend
 */
async function fetchAllSubtitles(videoId, lang = 'ko') {
  console.log(`[Deadbird] Fetching ${lang} subtitles for ${videoId}`);

  try {
    // Get available caption tracks
    const availableTracks = await getAvailableCaptions(videoId);
    console.log(`[Deadbird] Available tracks:`, availableTracks.map(t => t.lang));

    // Fetch target language subtitles
    let targetSubs;
    if (lang === 'uk') {
      targetSubs = await fetchUkrainianSubtitles(videoId, availableTracks);
    } else {
      targetSubs = await fetchKoreanSubtitles(videoId, availableTracks);
    }

    if (!targetSubs || targetSubs.length === 0) {
      console.log(`[Deadbird] No ${lang} subtitles available for ${videoId}`);
      return {
        video_id: videoId,
        has_korean: false,
        has_ukrainian: false,
        subtitles: []
      };
    }

    // Fetch English subtitles for translation
    const englishSubs = await fetchSubtitles(videoId, 'en');

    // Merge subtitles
    let merged;
    if (lang === 'uk') {
      if (englishSubs && englishSubs.length > 0) {
        merged = mergeUkrainianSubtitles(targetSubs, englishSubs);
      } else {
        // Ukrainian only, no English
        merged = targetSubs.map(sub => ({
          start: sub.start,
          duration: sub.duration,
          end: sub.start + sub.duration,
          ukrainian: sub.text,
          english: sub.text
        }));
      }
    } else {
      if (englishSubs && englishSubs.length > 0) {
        merged = mergeSubtitles(targetSubs, englishSubs);
      } else {
        // Korean only, no English
        merged = targetSubs.map(sub => ({
          start: sub.start,
          duration: sub.duration,
          end: sub.start + sub.duration,
          korean: sub.text,
          english: sub.text
        }));
      }
    }

    console.log(`[Deadbird] Fetched ${merged.length} merged subtitles for ${videoId}`);

    return {
      video_id: videoId,
      total_subtitles: merged.length,
      has_korean: lang === 'ko' && targetSubs.length > 0,
      has_ukrainian: lang === 'uk' && targetSubs.length > 0,
      subtitles: merged
    };
  } catch (error) {
    console.error(`[Deadbird] Error fetching subtitles for ${videoId}:`, error);
    return {
      video_id: videoId,
      has_korean: false,
      has_ukrainian: false,
      subtitles: []
    };
  }
}
