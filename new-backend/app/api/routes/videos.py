from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.video_store import (
    add_video, get_all_videos, get_filtered_videos,
    get_unchecked_videos, update_korean_status,
    get_ukrainian_filtered_videos, get_unchecked_ukrainian_videos,
    update_ukrainian_status, get_total_watch_time,
)
from app.services.subtitle_service import check_korean_available, check_ukrainian_available

router = APIRouter()


class TrackVideoRequest(BaseModel):
    video_id: str
    title: str = "Unknown"
    caption_languages: list[str] = []


class StatusUpdate(BaseModel):
    has_korean: bool


class UkrainianStatusUpdate(BaseModel):
    has_ukrainian: bool


@router.post("/track")
async def track_video(req: TrackVideoRequest):
    """Receive a video ID from the Chrome extension and store it."""
    if not req.video_id:
        raise HTTPException(status_code=400, detail="video_id is required")
    is_new = add_video(req.video_id, req.title)
    if req.caption_languages:
        has_ko = any(l == 'ko' or l.startswith('ko-') for l in req.caption_languages)
        has_uk = any(l == 'uk' or l.startswith('uk-') for l in req.caption_languages)
        has_en = any(l == 'en' or l.startswith('en-') for l in req.caption_languages)
        update_korean_status(req.video_id, has_ko and has_en)
        update_ukrainian_status(req.video_id, has_uk and has_en)
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
    lang: 'ko' or 'uk'. Lazily checks unchecked videos on each request.
    """
    if lang == 'uk':
        unchecked = get_unchecked_ukrainian_videos()
        for video in unchecked:
            has_uk = check_ukrainian_available(video["video_id"])
            update_ukrainian_status(video["video_id"], has_uk)
        videos = get_ukrainian_filtered_videos()
    else:
        unchecked = get_unchecked_videos()
        for video in unchecked:
            has_korean = check_korean_available(video["video_id"])
            update_korean_status(video["video_id"], has_korean)
        videos = get_filtered_videos()

    return {"total": len(videos), "lang": lang, "videos": videos}


@router.put("/{video_id}/status")
async def update_video_status(video_id: str, body: StatusUpdate):
    """Update the has_korean status for a video."""
    update_korean_status(video_id, body.has_korean)
    return {"status": "ok", "video_id": video_id, "has_korean": body.has_korean}


@router.put("/{video_id}/status/ukrainian")
async def update_video_ukrainian_status(video_id: str, body: UkrainianStatusUpdate):
    """Update the has_ukrainian status for a video."""
    update_ukrainian_status(video_id, body.has_ukrainian)
    return {"status": "ok", "video_id": video_id, "has_ukrainian": body.has_ukrainian}


@router.get("/stats/watch-time")
async def get_watch_time_stats(lang: str = "ko"):
    """Get total watch time statistics for videos in the target language."""
    stats = get_total_watch_time(lang)
    return stats
