from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional
from pydantic import BaseModel
from app.services.subtitle_service import (
    fetch_and_cache_subtitles,
    fetch_and_cache_subtitles_ukrainian,
    save_client_youtube_subtitles,
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
