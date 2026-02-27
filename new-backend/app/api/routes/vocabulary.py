from fastapi import APIRouter, HTTPException, Query
from app.services.subtitle_service import load_cached_subtitles, load_cached_subtitles_ukrainian
from app.services.korean_tokenizer import extract_korean_words_from_subtitles
from app.services.ukrainian_tokenizer import extract_ukrainian_words_from_subtitles
from app.services.vocab_service import load_frequency_map, filter_vocabulary, get_vocab_stats

router = APIRouter()

# Cache frequency maps in memory (loaded once at first request)
_FREQUENCY_MAP_KO: dict | None = None
_FREQUENCY_MAP_UK: dict | None = None


def get_frequency_map(lang: str = 'ko') -> dict:
    global _FREQUENCY_MAP_KO, _FREQUENCY_MAP_UK
    if lang == 'uk':
        if _FREQUENCY_MAP_UK is None:
            _FREQUENCY_MAP_UK = load_frequency_map('uk')
        return _FREQUENCY_MAP_UK
    else:
        if _FREQUENCY_MAP_KO is None:
            _FREQUENCY_MAP_KO = load_frequency_map('ko')
        return _FREQUENCY_MAP_KO


@router.get("/vocabulary/{video_id}")
async def get_vocabulary(video_id: str, limit: int = 20, lang: str = Query('ko')):
    """
    Extract vocabulary found in the frequency list from cached video subtitles.
    lang: 'ko' (Korean) or 'uk' (Ukrainian). Subtitles must be fetched first.
    """
    if lang == 'uk':
        subtitle_data = load_cached_subtitles_ukrainian(video_id)
        lang_key = 'has_ukrainian'
        extract_fn = extract_ukrainian_words_from_subtitles
    else:
        subtitle_data = load_cached_subtitles(video_id)
        lang_key = 'has_korean'
        extract_fn = extract_korean_words_from_subtitles

    if not subtitle_data:
        raise HTTPException(
            status_code=404,
            detail=f"Subtitles not found for {video_id}. Fetch them first via /api/subtitles/{video_id}?lang={lang}"
        )

    if not subtitle_data.get(lang_key):
        return {
            "video_id": video_id,
            "lang": lang,
            "total_words": 0,
            "vocabulary": [],
            "stats": {"total": 0}
        }

    words = extract_fn(subtitle_data["subtitles"])
    frequency_map = get_frequency_map(lang)
    filtered = filter_vocabulary(words, frequency_map, language=lang)
    limited = filtered[:limit]
    stats = get_vocab_stats(limited)

    return {
        "video_id": video_id,
        "lang": lang,
        "total_words": len(limited),
        "vocabulary": limited,
        "stats": stats
    }
