import json
from pathlib import Path
from youtube_transcript_api import YouTubeTranscriptApi
from app.core.config import settings
from app.services.video_store import save_subtitles, get_subtitles, update_video_duration


def _cache_path(video_id: str) -> Path:
    cache_dir = Path(settings.SUBTITLES_CACHE_DIR)
    cache_dir.mkdir(exist_ok=True)
    return cache_dir / f"subtitles_{video_id}.json"


def _snippets_to_list(result) -> list:
    return [{'text': s.text, 'start': s.start, 'duration': s.duration} for s in result.snippets]


def merge_subtitles_by_timestamp(english_subs: list, korean_subs: list) -> list:
    """Merge Korean (primary) with matching English. Only keeps entries with BOTH languages."""
    merged = []
    for ko_sub in korean_subs:
        if not ko_sub['text'] or not ko_sub['text'].strip():
            continue
        ko_start = ko_sub['start']
        matching_eng = None
        for en_sub in english_subs:
            if abs(ko_start - en_sub['start']) < 1.0:
                matching_eng = en_sub
                break
        if matching_eng and matching_eng['text'].strip():
            merged.append({
                'start': ko_start,
                'duration': ko_sub['duration'],
                'end': ko_start + ko_sub['duration'],
                'english': matching_eng['text'],
                'korean': ko_sub['text'],
            })
    return merged


def _fetch_english(transcript_list, ko_transcript) -> list:
    """
    Try every YouTube path to get English subtitles:
      1. Direct English (manual or auto-generated)
      2. Any auto-generated English
      3. YouTube translation of Korean → English
    Returns empty list if all paths fail.
    """
    # 1. Direct English transcript (manual or auto)
    try:
        return _snippets_to_list(transcript_list.find_transcript(['en']).fetch())
    except Exception:
        pass

    # 2. Explicitly look for auto-generated English
    try:
        return _snippets_to_list(transcript_list.find_generated_transcript(['en']).fetch())
    except Exception:
        pass

    # 3. YouTube translation of Korean → English
    if ko_transcript is not None:
        try:
            return _snippets_to_list(ko_transcript.translate('en').fetch())
        except Exception:
            pass

    return []


def _fetch_korean_translation(transcript_list) -> list:
    """
    Try to get Korean via YouTube's auto-translation of English.
    Used as fallback when no native Korean transcript exists.
    """
    try:
        en_transcript = transcript_list.find_transcript(['en'])
        return _snippets_to_list(en_transcript.translate('ko').fetch())
    except Exception:
        pass

    try:
        en_transcript = transcript_list.find_generated_transcript(['en'])
        return _snippets_to_list(en_transcript.translate('ko').fetch())
    except Exception:
        pass

    return []


def fetch_and_cache_subtitles(video_id: str) -> dict:
    """Fetch Korean+English subtitles, merge, cache to disk + Neon, return data."""
    cache_file = _cache_path(video_id)

    if cache_file.exists():
        with open(cache_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    # Check Neon before hitting YouTube
    neon_data = get_subtitles(video_id)
    if neon_data:
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(neon_data, f, ensure_ascii=False, indent=2)
        return neon_data

    api = YouTubeTranscriptApi()
    transcript_list = api.list(video_id)

    # ── Korean (native first, then translation fallback) ───────────
    korean_subs = []
    ko_transcript = None
    try:
        ko_transcript = transcript_list.find_transcript(['ko'])
        korean_subs = _snippets_to_list(ko_transcript.fetch())
    except Exception:
        pass

    if not korean_subs:
        korean_subs = _fetch_korean_translation(transcript_list)

    # ── English (best effort) ──────────────────────────────────────
    english_subs = _fetch_english(transcript_list, ko_transcript)

    if not korean_subs and not english_subs:
        raise Exception(f"No subtitles available for {video_id}")

    # ── Merge ──────────────────────────────────────────────────────
    if korean_subs and english_subs:
        merged = merge_subtitles_by_timestamp(english_subs, korean_subs)
    elif korean_subs:
        # Korean only — no English available
        merged = [
            {
                'start': s['start'], 'duration': s['duration'],
                'end': s['start'] + s['duration'],
                'english': s['text'], 'korean': s['text'],
            }
            for s in korean_subs
            if s['text'] and s['text'].strip()
        ]
    else:
        # English only — no Korean at all (native or translated)
        merged = [
            {
                'start': s['start'], 'duration': s['duration'],
                'end': s['start'] + s['duration'],
                'english': s['text'], 'korean': '',
            }
            for s in english_subs
            if s['text'] and s['text'].strip()
        ]

    data = {
        'video_id': video_id,
        'total_subtitles': len(merged),
        'has_korean': len(korean_subs) > 0,
        'subtitles': merged,
    }

    with open(cache_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Also persist to Neon (best-effort)
    try:
        save_subtitles(video_id, data)
    except Exception:
        pass

    # Calculate and save video duration from last subtitle
    if merged:
        last_sub = merged[-1]
        duration_seconds = int(last_sub.get('end', last_sub['start'] + last_sub['duration']))
        try:
            update_video_duration(video_id, duration_seconds)
        except Exception:
            pass

    return data


def check_korean_available(video_id: str) -> bool:
    """Quick check if Korean subtitles exist (uses cache if available)."""
    cache_file = _cache_path(video_id)
    if cache_file.exists():
        with open(cache_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data.get('has_korean', False)

    try:
        api = YouTubeTranscriptApi()
        transcript_list = api.list(video_id)
        transcript_list.find_transcript(['ko'])
        return True
    except Exception:
        return False


def load_cached_subtitles(video_id: str) -> dict | None:
    """Load from local file cache, then Neon, no network call."""
    cache_file = _cache_path(video_id)
    if cache_file.exists():
        with open(cache_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    # Fallback: check Neon
    return get_subtitles(video_id)


# ── Ukrainian support ─────────────────────────────────────────────────────────

def _cache_path_uk(video_id: str) -> Path:
    cache_dir = Path(settings.SUBTITLES_CACHE_DIR)
    cache_dir.mkdir(exist_ok=True)
    return cache_dir / f"subtitles_uk_{video_id}.json"


def merge_subtitles_ukrainian(english_subs: list, ukrainian_subs: list) -> list:
    """Merge Ukrainian (primary) with matching English."""
    merged = []
    for uk_sub in ukrainian_subs:
        if not uk_sub['text'] or not uk_sub['text'].strip():
            continue
        uk_start = uk_sub['start']
        matching_eng = None
        for en_sub in english_subs:
            if abs(uk_start - en_sub['start']) < 1.0:
                matching_eng = en_sub
                break
        if matching_eng and matching_eng['text'].strip():
            merged.append({
                'start': uk_start,
                'duration': uk_sub['duration'],
                'end': uk_start + uk_sub['duration'],
                'english': matching_eng['text'],
                'ukrainian': uk_sub['text'],
            })
    return merged


def _fetch_ukrainian_translation(transcript_list) -> list:
    """Try to get Ukrainian via YouTube's auto-translation of English."""
    try:
        en_transcript = transcript_list.find_transcript(['en'])
        return _snippets_to_list(en_transcript.translate('uk').fetch())
    except Exception:
        pass

    try:
        en_transcript = transcript_list.find_generated_transcript(['en'])
        return _snippets_to_list(en_transcript.translate('uk').fetch())
    except Exception:
        pass

    return []


def fetch_and_cache_subtitles_ukrainian(video_id: str) -> dict:
    """Fetch Ukrainian+English subtitles, merge, cache to disk, return data."""
    cache_file = _cache_path_uk(video_id)

    if cache_file.exists():
        with open(cache_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    api = YouTubeTranscriptApi()
    transcript_list = api.list(video_id)

    # ── Ukrainian (native first, then translation fallback) ─────────
    ukrainian_subs = []
    uk_transcript = None
    try:
        uk_transcript = transcript_list.find_transcript(['uk'])
        ukrainian_subs = _snippets_to_list(uk_transcript.fetch())
    except Exception:
        pass

    if not ukrainian_subs:
        ukrainian_subs = _fetch_ukrainian_translation(transcript_list)

    # ── English (best effort) ────────────────────────────────────────
    english_subs = _fetch_english(transcript_list, uk_transcript)

    if not ukrainian_subs and not english_subs:
        raise Exception(f"No subtitles available for {video_id}")

    # ── Merge ────────────────────────────────────────────────────────
    if ukrainian_subs and english_subs:
        merged = merge_subtitles_ukrainian(english_subs, ukrainian_subs)
    elif ukrainian_subs:
        merged = [
            {
                'start': s['start'], 'duration': s['duration'],
                'end': s['start'] + s['duration'],
                'english': s['text'], 'ukrainian': s['text'],
            }
            for s in ukrainian_subs
            if s['text'] and s['text'].strip()
        ]
    else:
        merged = [
            {
                'start': s['start'], 'duration': s['duration'],
                'end': s['start'] + s['duration'],
                'english': s['text'], 'ukrainian': '',
            }
            for s in english_subs
            if s['text'] and s['text'].strip()
        ]

    data = {
        'video_id': video_id,
        'total_subtitles': len(merged),
        'has_ukrainian': len(ukrainian_subs) > 0,
        'subtitles': merged,
    }

    with open(cache_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Calculate and save video duration from last subtitle
    if merged:
        last_sub = merged[-1]
        duration_seconds = int(last_sub.get('end', last_sub['start'] + last_sub['duration']))
        try:
            update_video_duration(video_id, duration_seconds)
        except Exception:
            pass

    return data


def check_ukrainian_available(video_id: str) -> bool:
    """Quick check if Ukrainian subtitles exist (uses cache if available)."""
    cache_file = _cache_path_uk(video_id)
    if cache_file.exists():
        with open(cache_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data.get('has_ukrainian', False)

    try:
        api = YouTubeTranscriptApi()
        transcript_list = api.list(video_id)
        transcript_list.find_transcript(['uk'])
        return True
    except Exception:
        return False


def load_cached_subtitles_ukrainian(video_id: str) -> dict | None:
    """Load Ukrainian subtitle cache from disk, no network call."""
    cache_file = _cache_path_uk(video_id)
    if cache_file.exists():
        with open(cache_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None
