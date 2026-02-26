from fastapi import APIRouter, HTTPException
from app.services.subtitle_service import fetch_and_cache_subtitles

router = APIRouter()


@router.get("/subtitles/{video_id}")
async def get_subtitles(video_id: str):
    """
    Fetch and cache Korean+English subtitles for a YouTube video.
    Returns cached version on subsequent requests.
    """
    try:
        data = fetch_and_cache_subtitles(video_id)
        return {
            "video_id": video_id,
            "subtitles": [
                {
                    "start": sub["start"],
                    "duration": sub["duration"],
                    "english": sub["english"],
                    "korean": sub.get("korean")
                }
                for sub in data["subtitles"]
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Could not fetch subtitles: {str(e)}")
