from fastapi import APIRouter, HTTPException, Query
from app.services.subtitle_service import (
    fetch_and_cache_subtitles,
    fetch_and_cache_subtitles_ukrainian,
)

router = APIRouter()


@router.get("/subtitles/{video_id}")
async def get_subtitles(video_id: str, lang: str = Query('ko')):
    """
    Fetch and cache subtitles for a YouTube video.
    lang: 'ko' (Korean) or 'uk' (Ukrainian). Defaults to 'ko'.
    Returns cached version on subsequent requests.
    """
    try:
        if lang == 'uk':
            data = fetch_and_cache_subtitles_ukrainian(video_id)
            target_key = 'ukrainian'
        else:
            data = fetch_and_cache_subtitles(video_id)
            target_key = 'korean'

        return {
            "video_id": video_id,
            "lang": lang,
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
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Could not fetch subtitles: {str(e)}")
