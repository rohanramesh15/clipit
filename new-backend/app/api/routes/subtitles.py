from fastapi import APIRouter, HTTPException, Query
from app.services.subtitle_service import (
    fetch_and_cache_subtitles,
    fetch_and_cache_subtitles_ukrainian,
)
from app.api.routes.netflix import load_cached_netflix_subtitles

router = APIRouter()


@router.get("/subtitles/{video_id}")
async def get_subtitles(video_id: str, lang: str = Query('ko')):
    """
    Fetch and cache subtitles for a YouTube or Netflix video.
    lang: 'ko' (Korean) or 'uk' (Ukrainian). Defaults to 'ko'.
    Returns cached version on subsequent requests.
    """
    try:
        # Handle Netflix videos (prefixed with netflix_)
        if video_id.startswith('netflix_'):
            data = load_cached_netflix_subtitles(video_id, lang)
            if not data:
                raise HTTPException(status_code=404, detail=f"No Netflix subtitles found for {video_id}")
            target_key = 'ukrainian' if lang == 'uk' else 'korean'
            return {
                "video_id": video_id,
                "lang": lang,
                "platform": "netflix",
                "subtitles": [
                    {
                        "start": sub["start"],
                        "duration": sub.get("duration", sub.get("end", sub["start"] + 5) - sub["start"]),
                        "english": sub.get("english", ""),
                        target_key: sub.get(target_key, ""),
                    }
                    for sub in data["subtitles"]
                ]
            }

        # Handle YouTube videos
        if lang == 'uk':
            data = fetch_and_cache_subtitles_ukrainian(video_id)
            target_key = 'ukrainian'
        else:
            data = fetch_and_cache_subtitles(video_id)
            target_key = 'korean'

        return {
            "video_id": video_id,
            "lang": lang,
            "platform": "youtube",
            "subtitles": [
                {
                    "start": sub["start"],
                    "duration": sub["duration"],
                    "english": sub["english"],
                    target_key: sub.get(target_key),
                }
                for sub in data["subtitles"]
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Could not fetch subtitles: {str(e)}")
