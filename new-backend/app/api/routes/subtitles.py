from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.services.subtitle_service import (
    fetch_and_cache_subtitles,
    fetch_and_cache_subtitles_ukrainian,
    save_subtitles_from_extension,
)
from app.api.routes.netflix import load_cached_netflix_subtitles

router = APIRouter()


class SubtitleUpload(BaseModel):
    video_id: str
    lang: str
    subtitles: list
    has_korean: bool = False
    has_ukrainian: bool = False


@router.get("/subtitles/{video_id}")
async def get_subtitles(video_id: str, lang: str = Query('ko')):
    """
    Get cached subtitles for a YouTube or Netflix video.
    NOTE: This endpoint now only returns cached subtitles.
    Subtitles are fetched by the extension to avoid IP blocking.
    lang: 'ko' (Korean) or 'uk' (Ukrainian). Defaults to 'ko'.
    """
    try:
        # Handle Netflix videos (prefixed with netflix_)
        if video_id.startswith('netflix_'):
            from app.services.subtitle_service import load_cached_subtitles, load_cached_subtitles_ukrainian
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

        # Handle YouTube videos - only load from cache
        from app.services.subtitle_service import load_cached_subtitles, load_cached_subtitles_ukrainian

        if lang == 'uk':
            data = load_cached_subtitles_ukrainian(video_id)
            target_key = 'ukrainian'
        else:
            data = load_cached_subtitles(video_id)
            target_key = 'korean'

        if not data:
            raise HTTPException(
                status_code=404,
                detail=f"Subtitles not cached yet. The extension will fetch and upload them automatically."
            )

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
        raise HTTPException(status_code=500, detail=f"Error loading subtitles: {str(e)}")


@router.post("/subtitles/upload")
async def upload_subtitles(data: SubtitleUpload):
    """
    Receive subtitles fetched by the extension.
    This endpoint stores subtitles that were fetched in the user's browser,
    avoiding YouTube IP blocking issues.
    """
    try:
        # Save subtitles using the subtitle service
        result = save_subtitles_from_extension(
            video_id=data.video_id,
            lang=data.lang,
            subtitles=data.subtitles,
            has_korean=data.has_korean,
            has_ukrainian=data.has_ukrainian
        )

        return {
            "status": "ok",
            "video_id": data.video_id,
            "lang": data.lang,
            "total_subtitles": len(data.subtitles),
            "saved": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save subtitles: {str(e)}")
