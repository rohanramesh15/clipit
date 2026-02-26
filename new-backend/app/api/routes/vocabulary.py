from fastapi import APIRouter, HTTPException
from pathlib import Path
from app.services.subtitle_service import load_cached_subtitles
from app.services.korean_tokenizer import extract_korean_words_from_subtitles
from app.services.vocab_service import load_frequency_map, filter_vocabulary, get_vocab_stats

router = APIRouter()

# Cache frequency map in memory (loaded once at first request)
_FREQUENCY_MAP: dict | None = None


def get_frequency_map() -> dict:
    global _FREQUENCY_MAP
    if _FREQUENCY_MAP is None:
        _FREQUENCY_MAP = load_frequency_map('ko')
    return _FREQUENCY_MAP


@router.get("/vocabulary/{video_id}")
async def get_vocabulary(video_id: str, level: str = "intermediate", limit: int = 20):
    """
    Extract and filter Korean vocabulary from cached video subtitles.
    Subtitles must be fetched first via GET /api/subtitles/{video_id}.
    """
    subtitle_data = load_cached_subtitles(video_id)
    if not subtitle_data:
        raise HTTPException(
            status_code=404,
            detail=f"Subtitles not found for {video_id}. Fetch them first via /api/subtitles/{video_id}"
        )

    if not subtitle_data.get("has_korean"):
        return {
            "video_id": video_id,
            "user_level": level,
            "total_words": 0,
            "vocabulary": [],
            "stats": {"total": 0, "by_difficulty": {"beginner": 0, "intermediate": 0, "advanced": 0, "very_advanced": 0}}
        }

    korean_words = extract_korean_words_from_subtitles(subtitle_data["subtitles"])
    frequency_map = get_frequency_map()
    filtered = filter_vocabulary(korean_words, frequency_map, user_level=level, language='ko')
    limited = filtered[:limit]
    stats = get_vocab_stats(limited)

    return {
        "video_id": video_id,
        "user_level": level,
        "total_words": len(limited),
        "vocabulary": limited,
        "stats": stats
    }
