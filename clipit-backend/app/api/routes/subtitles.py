import json
import time

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from app.services.subtitle_service import (
    fetch_and_cache_subtitles,
    fetch_and_cache_subtitles_ukrainian,
    save_subtitles_from_extension,
)
from app.api.routes.netflix import load_cached_netflix_subtitles
from app.api.deps import get_current_user
from app.core.database import SessionLocal, get_db
from app.models.transcript_ingestion import TranscriptIngestionChunk, TranscriptIngestionJob
from app.models.user import User
from app.models.user_video_watch import UserVideoWatch
from app.services.transcript_ingestion_service import enqueue_transcript_chunk

router = APIRouter()


class SubtitleEntry(BaseModel):
    start: float
    duration: float
    text: str


class YouTubeSubtitlesRequest(BaseModel):
    video_id: str
    korean: List[SubtitleEntry] = Field(default_factory=list)
    ukrainian: List[SubtitleEntry] = Field(default_factory=list)
    english: List[SubtitleEntry] = Field(default_factory=list)


class YouTubeSubtitleBatchRequest(YouTubeSubtitlesRequest):
    language: str = Field(pattern="^(ko|uk)$")
    batch_index: int = Field(ge=0)
    total_batches: int = Field(ge=1, le=500)


def _progress_payload(job: TranscriptIngestionJob) -> dict:
    return {
        "video_id": job.video_id,
        "language": job.language,
        "status": job.status,
        "total_batches": job.total_chunks,
        "received_batches": job.received_chunks,
        "processed_batches": job.processed_chunks,
        "words": job.words or [],
        "error": job.error,
    }


@router.post("/youtube/subtitles/batches")
async def receive_youtube_subtitle_batch(
    req: YouTubeSubtitleBatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Persist one caption batch and hand it to the low-latency worker."""
    target = req.ukrainian if req.language == "uk" else req.korean
    if not target:
        raise HTTPException(status_code=400, detail="target-language caption batch is required")
    if req.batch_index >= req.total_batches:
        raise HTTPException(status_code=400, detail="batch_index must be lower than total_batches")
    watched = db.query(UserVideoWatch.id).filter(
        UserVideoWatch.user_id == current_user.id,
        UserVideoWatch.video_id == req.video_id,
    ).first()
    if watched is None:
        raise HTTPException(status_code=409, detail="Track video metadata before uploading transcript batches")

    job = db.query(TranscriptIngestionJob).filter(
        TranscriptIngestionJob.user_id == current_user.id,
        TranscriptIngestionJob.video_id == req.video_id,
        TranscriptIngestionJob.language == req.language,
    ).first()
    if job is None:
        job = TranscriptIngestionJob(
            user_id=current_user.id,
            video_id=req.video_id,
            language=req.language,
            status="receiving",
            total_chunks=req.total_batches,
            received_chunks=0,
            processed_chunks=0,
            words=[],
        )
        db.add(job)
        db.flush()
    elif job.total_chunks != req.total_batches:
        raise HTTPException(status_code=409, detail="Transcript batch count does not match the active upload")

    existing = db.query(TranscriptIngestionChunk).filter(
        TranscriptIngestionChunk.job_id == job.id,
        TranscriptIngestionChunk.chunk_index == req.batch_index,
    ).first()
    if existing is not None:
        return {"success": True, "duplicate": True, "progress": _progress_payload(job)}

    merged = merge_client_subtitles(target, req.english, req.language)
    chunk = TranscriptIngestionChunk(
        job_id=job.id,
        chunk_index=req.batch_index,
        subtitles=merged,
        status="queued",
        words=[],
    )
    db.add(chunk)
    db.flush()
    job.received_chunks += 1
    job.status = "processing"
    db.commit()
    db.refresh(job)
    enqueue_transcript_chunk(chunk.id)
    return {"success": True, "progress": _progress_payload(job)}


@router.get("/youtube/subtitles/{video_id}/progress")
async def stream_youtube_transcript_progress(
    video_id: str,
    lang: str = Query("ko", pattern="^(ko|uk)$"),
    current_user: User = Depends(get_current_user),
):
    """Stream word batches as the durable worker completes them."""
    def event_stream():
        last_version: tuple | None = None
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            stream_db = SessionLocal()
            try:
                job = stream_db.query(TranscriptIngestionJob).filter(
                    TranscriptIngestionJob.user_id == current_user.id,
                    TranscriptIngestionJob.video_id == video_id,
                    TranscriptIngestionJob.language == lang,
                ).first()
                if job is None:
                    yield "event: error\ndata: {\"detail\": \"Transcript job not found\"}\n\n"
                    return
                payload = _progress_payload(job)
                version = (job.status, job.received_chunks, job.processed_chunks, len(job.words or []), job.error)
                if version != last_version:
                    yield f"event: progress\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
                    last_version = version
                if job.status in {"complete", "failed"}:
                    yield f"event: {job.status}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
                    return
            finally:
                stream_db.close()
            time.sleep(0.25)
        yield "event: timeout\ndata: {}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/youtube/subtitles")
async def receive_youtube_subtitles(req: YouTubeSubtitlesRequest):
    """
    Receive YouTube subtitles fetched client-side by the Chrome extension.
    This bypasses YouTube's IP blocking of cloud servers.
    """
    try:
        has_korean = len(req.korean) > 0
        has_ukrainian = len(req.ukrainian) > 0
        has_english = len(req.english) > 0
        lang = 'uk' if has_ukrainian else 'ko'

        # Convert to our merged format
        merged = merge_client_subtitles(
            req.ukrainian if has_ukrainian else req.korean,
            req.english,
            lang,
        )

        # Save to the language-specific cache and update video language status.
        persisted = save_subtitles_from_extension(
            req.video_id,
            lang,
            merged,
            has_korean=has_korean,
            has_ukrainian=has_ukrainian,
        )
        if not persisted:
            raise HTTPException(status_code=500, detail="Subtitle upload could not be persisted")

        return {
            "success": True,
            "video_id": req.video_id,
            "has_korean": has_korean,
            "has_ukrainian": has_ukrainian,
            "has_english": has_english,
            "subtitle_count": len(merged),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save subtitles: {str(e)}")


def merge_client_subtitles(target_subtitles: List[SubtitleEntry], english: List[SubtitleEntry], lang: str = 'ko') -> list:
    """Merge target-language and English subtitles by timestamp."""
    target_key = 'ukrainian' if lang == 'uk' else 'korean'

    if not target_subtitles and not english:
        return []

    if target_subtitles and english:
        # Match target-language subtitles with closest English ones
        merged = []
        for target_sub in target_subtitles:
            target_start = target_sub.start
            # Find closest English subtitle
            best_match = None
            best_diff = float('inf')
            for en_sub in english:
                diff = abs(en_sub.start - target_start)
                if diff < best_diff and diff < 5:  # Within 5 seconds
                    best_diff = diff
                    best_match = en_sub

            merged.append({
                'start': target_sub.start,
                'duration': target_sub.duration,
                'end': target_sub.start + target_sub.duration,
                target_key: target_sub.text,
                'english': best_match.text if best_match else '',
            })
        return merged
    elif target_subtitles:
        return [
            {
                'start': s.start,
                'duration': s.duration,
                'end': s.start + s.duration,
                target_key: s.text,
                'english': '',
            }
            for s in target_subtitles
        ]
    else:
        return [
            {
                'start': s.start,
                'duration': s.duration,
                'end': s.start + s.duration,
                target_key: '',
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
            if lang == 'uk':
                target_key = 'ukrainian'
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
            has_ukrainian=data.has_ukrainian,
        )
        if not result:
            raise HTTPException(status_code=500, detail="Subtitle upload could not be persisted")

        return {
            "status": "ok",
            "video_id": data.video_id,
            "lang": data.lang,
            "total_subtitles": len(data.subtitles),
            "saved": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save subtitles: {str(e)}")
