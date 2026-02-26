from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.video_store import (
    add_video, get_all_videos, get_filtered_videos,
    get_unchecked_videos, update_korean_status
)
from app.services.subtitle_service import check_korean_available

router = APIRouter()


class TrackVideoRequest(BaseModel):
    video_id: str
    title: str = "Unknown"
    caption_languages: list[str] = []


@router.post("/track")
async def track_video(req: TrackVideoRequest):
    """Receive a video ID from the Chrome extension and store it."""
    if not req.video_id:
        raise HTTPException(status_code=400, detail="video_id is required")
    is_new = add_video(req.video_id, req.title)
    # If caption languages were provided by the extension, set Korean status immediately
    if req.caption_languages:
        has_ko = any(l == 'ko' or l.startswith('ko-') for l in req.caption_languages)
        has_en = any(l == 'en' or l.startswith('en-') for l in req.caption_languages)
        update_korean_status(req.video_id, has_ko and has_en)
    return {"status": "ok", "video_id": req.video_id, "is_new": is_new}


@router.get("/history")
async def get_history():
    """Return all tracked videos."""
    videos = get_all_videos()
    return {"total": len(videos), "videos": videos}


@router.get("/history/filtered")
async def get_filtered_history(lang: str = "ko"):
    """
    Return videos that have subtitles in the target language.
    Lazily checks any unchecked videos on each request.
    """
    # Check any videos whose subtitle status is still unknown
    unchecked = get_unchecked_videos()
    for video in unchecked:
        has_korean = check_korean_available(video["video_id"])
        update_korean_status(video["video_id"], has_korean)

    videos = get_filtered_videos()
    return {"total": len(videos), "lang": lang, "videos": videos}
