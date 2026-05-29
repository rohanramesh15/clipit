from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional
from pydantic import BaseModel
from app.services.subtitle_service import (
    fetch_and_cache_subtitles,
    fetch_and_cache_subtitles_ukrainian,
    save_client_youtube_subtitles,
    save_subtitles_from_extension,
)
from app.api.routes.netflix import load_cached_netflix_subtitles
from app.services.video_store import update_korean_status

router = APIRouter()


class SubtitleEntry(BaseModel):
    start: float
    duration: float
    text: str


class YouTubeSubtitlesRequest(BaseModel):
    video_id: str
    korean: List[SubtitleEntry] = []
    english: List[SubtitleEntry] = []


@router.post("/youtube/subtitles")
async def receive_youtube_subtitles(req: YouTubeSubtitlesRequest):
    """
    Receive YouTube subtitles fetched client-side by the Chrome extension.
    This bypasses YouTube's IP blocking of cloud servers.
    """
    try:
        has_korean = len(req.korean) > 0
        has_english = len(req.english) > 0

        # Convert to our merged format
        merged = merge_client_subtitles(req.korean, req.english)

        # Save to cache
        save_client_youtube_subtitles(req.video_id, merged, has_korean)

        # Update the video's has_korean status
        if has_korean:
            update_korean_status(req.video_id, True)

        return {
            "success": True,
            "video_id": req.video_id,
            "has_korean": has_korean,
            "has_english": has_english,
            "subtitle_count": len(merged),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save subtitles: {str(e)}")


def merge_client_subtitles(korean: List[SubtitleEntry], english: List[SubtitleEntry]) -> list:
    """Merge Korean and English subtitles by timestamp."""
    if not korean and not english:
        return []

    if korean and english:
        # Match Korean subtitles with closest English ones
        merged = []
        for ko_sub in korean:
            ko_start = ko_sub.start
            # Find closest English subtitle
            best_match = None
            best_diff = float('inf')
            for en_sub in english:
                diff = abs(en_sub.start - ko_start)
                if diff < best_diff and diff < 5:  # Within 5 seconds
                    best_diff = diff
                    best_match = en_sub

            merged.append({
                'start': ko_sub.start,
                'duration': ko_sub.duration,
                'end': ko_sub.start + ko_sub.duration,
                'korean': ko_sub.text,
                'english': best_match.text if best_match else '',
            })
        return merged
    elif korean:
        return [
            {
                'start': s.start,
                'duration': s.duration,
                'end': s.start + s.duration,
                'korean': s.text,
                'english': '',
            }
            for s in korean
        ]
    else:
        return [
            {
                'start': s.start,
                'duration': s.duration,
                'end': s.start + s.duration,
                'korean': '',
                'english': s.text,
            }
            for s in english
        ]
class SubtitleUpload(BaseModel):
    video_id: str
    lang: str
    subtitles: list
    has_korean: bool = False
    has_ukrainian: bool = False
    has_spanish: bool = False


@router.get("/subtitles/{video_id}")
async def get_subtitles(video_id: str, lang: str = Query('ko')):
    """
    Get cached subtitles for a YouTube or Netflix video.
    NOTE: This endpoint now only returns cached subtitles.
    Subtitles are fetched by the extension to avoid IP blocking.
    lang: 'ko' (Korean), 'uk' (Ukrainian), or 'es' (Spanish). Defaults to 'ko'.
    """
    try:
        # Handle Netflix videos (prefixed with netflix_)
        if video_id.startswith('netflix_'):
            from app.services.subtitle_service import load_cached_subtitles, load_cached_subtitles_ukrainian, load_cached_subtitles_spanish
            data = load_cached_netflix_subtitles(video_id, lang)
            if not data:
                raise HTTPException(status_code=404, detail=f"No Netflix subtitles found for {video_id}")
            if lang == 'uk':
                target_key = 'ukrainian'
            elif lang == 'es':
                target_key = 'spanish'
            else:
                target_key = 'korean'
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
        from app.services.subtitle_service import load_cached_subtitles, load_cached_subtitles_ukrainian, load_cached_subtitles_spanish

        if lang == 'uk':
            data = load_cached_subtitles_ukrainian(video_id)
            target_key = 'ukrainian'
        elif lang == 'es':
            data = load_cached_subtitles_spanish(video_id)
            target_key = 'spanish'
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
            has_ukrainian=data.has_ukrainian,
            has_spanish=data.has_spanish
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

