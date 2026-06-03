/**
 * Subtitle fetcher for YouTube videos
 * Fetches subtitles directly from YouTube's timedtext API using the user's browser
 * This avoids backend IP blocking issues
 */

function getLanguageConfig(lang = 'ko') {
  if (lang === 'uk') {
    return {
      code: 'uk',
      name: 'Ukrainian',
      subtitleKey: 'ukrainian',
      availabilityKey: 'has_ukrainian',
    };
  }
  if (lang === 'ko') {
    return {
      code: 'ko',
      name: 'Korean',
      subtitleKey: 'korean',
      availabilityKey: 'has_korean',
    };
  }
  if (lang === 'es') {
    return {
      code: 'es',
      name: 'Spanish',
      subtitleKey: 'spanish',
      availabilityKey: 'has_spanish',
    };
  }
  return {
    code: lang,
    name: lang,
    subtitleKey: lang,
    availabilityKey: `has_${lang}`,
  };
}

function makeAvailabilityFlags(lang, available) {
  const flags = {
    has_korean: false,
    has_ukrainian: false,
    has_spanish: false,
  };
  const config = getLanguageConfig(lang);
  if (config.availabilityKey in flags) {
    flags[config.availabilityKey] = available;
  }
  return flags;
}

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

    const body = await response.text();
    if (!body.trim()) {
      console.log(`[Deadbird] Empty ${lang} subtitle response for ${videoId}`);
      return null;
    }

    let data;
    try {
      data = JSON.parse(body);
    } catch (error) {
      console.log(`[Deadbird] Non-JSON ${lang} subtitle response for ${videoId}`);
      return null;
    }

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
 * Try to get target-language subtitles with fallback to YouTube's English translation.
 * This intentionally does not rely on availableTracks because that endpoint is often incomplete.
 * @param {string} videoId - YouTube video ID
 * @param {string} lang - Target language code
 * @returns {Promise<Array|null>} Target subtitles or null
 */
async function fetchTargetLanguageSubtitles(videoId, lang) {
  const config = getLanguageConfig(lang);

  // Always try fetching the target language directly first.
  const subs = await fetchSubtitles(videoId, config.code);
  if (subs && subs.length > 0) {
    console.log(`[Deadbird] Found ${subs.length} ${config.name} subtitles via direct fetch`);
    return subs;
  }

  // Fallback: try English with target-language translation.
  console.log(`[Deadbird] No direct ${config.name} subs, trying English→${config.name} translation`);
  try {
    const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&tlang=${config.code}&fmt=json3`;
    const response = await fetch(url);
    if (response.ok) {
      const body = await response.text();
      if (!body.trim()) return null;

      let data;
      try {
        data = JSON.parse(body);
      } catch (error) {
        console.log(`[Deadbird] Non-JSON English→${config.name} translation response for ${videoId}`);
        return null;
      }
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
          console.log(`[Deadbird] Found ${subtitles.length} ${config.name} subtitles via translation`);
          return subtitles;
        }
      }
    }
  } catch (error) {
    console.error(`[Deadbird] ${config.name} translation failed:`, error);
  }

  return null;
}

function mergeTargetSubtitles(targetSubs, englishSubs, lang) {
  const config = getLanguageConfig(lang);
  const merged = [];

  for (const targetSub of targetSubs) {
    if (!targetSub.text || !targetSub.text.trim()) continue;

    // Find matching English subtitle (within 1 second)
    const matchingEng = (englishSubs || []).find(enSub =>
      Math.abs(targetSub.start - enSub.start) < 1.0
    );

    merged.push({
      start: targetSub.start,
      duration: targetSub.duration,
      end: targetSub.start + targetSub.duration,
      [config.subtitleKey]: targetSub.text,
      english: matchingEng?.text?.trim() || targetSub.text
    });
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
  const config = getLanguageConfig(lang);
  console.log(`[Deadbird] Fetching ${config.name} subtitles for ${videoId}`);

  try {
    // Get available caption tracks
    const availableTracks = await getAvailableCaptions(videoId);
    console.log(`[Deadbird] Available tracks:`, availableTracks.map(t => t.lang));

    // Fetch target language subtitles
    const targetSubs = await fetchTargetLanguageSubtitles(videoId, config.code);

    if (!targetSubs || targetSubs.length === 0) {
      console.log(`[Deadbird] No ${config.name} subtitles available for ${videoId}`);
      return {
        video_id: videoId,
        ...makeAvailabilityFlags(config.code, false),
        subtitles: []
      };
    }

    // Fetch English subtitles for translation
    const englishSubs = await fetchSubtitles(videoId, 'en');

    // Merge subtitles. If English is unavailable, use target text as the fallback
    // translation so the rest of the pipeline can still build cards.
    const merged = mergeTargetSubtitles(targetSubs, englishSubs || [], config.code);

    console.log(`[Deadbird] Fetched ${merged.length} merged subtitles for ${videoId}`);

    return {
      video_id: videoId,
      total_subtitles: merged.length,
      ...makeAvailabilityFlags(config.code, targetSubs.length > 0),
      subtitles: merged
    };
  } catch (error) {
    console.error(`[Deadbird] Error fetching subtitles for ${videoId}:`, error);
    return {
      video_id: videoId,
      ...makeAvailabilityFlags(lang, false),
      subtitles: []
    };
  }
}
