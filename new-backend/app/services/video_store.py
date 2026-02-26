import time
from app.core.database import SessionLocal
from app.models.video import TrackedVideo


def _db():
    return SessionLocal()


def add_video(video_id: str, title: str) -> bool:
    """Insert video if not already tracked. Returns True if newly added."""
    db = _db()
    try:
        existing = db.query(TrackedVideo).filter(TrackedVideo.video_id == video_id).first()
        if existing:
            return False
        video = TrackedVideo(
            video_id=video_id,
            title=title,
            youtube_url=f"https://www.youtube.com/watch?v={video_id}",
            tracked_at=time.time(),
        )
        db.add(video)
        db.commit()
        return True
    finally:
        db.close()


def get_all_videos() -> list[dict]:
    db = _db()
    try:
        rows = db.query(TrackedVideo).order_by(TrackedVideo.tracked_at.desc()).all()
        return [
            {
                "video_id": r.video_id,
                "title": r.title,
                "youtube_url": r.youtube_url,
                "tracked_at": r.tracked_at,
                "has_korean": r.has_korean,
            }
            for r in rows
        ]
    finally:
        db.close()


def update_korean_status(video_id: str, has_korean: bool) -> None:
    db = _db()
    try:
        db.query(TrackedVideo).filter(TrackedVideo.video_id == video_id).update(
            {"has_korean": has_korean}
        )
        db.commit()
    finally:
        db.close()


def save_subtitles(video_id: str, subtitle_data: dict) -> None:
    """Store subtitle JSON in Neon for the tracked video."""
    db = _db()
    try:
        db.query(TrackedVideo).filter(TrackedVideo.video_id == video_id).update(
            {"subtitles": subtitle_data}
        )
        db.commit()
    finally:
        db.close()


def get_subtitles(video_id: str) -> dict | None:
    """Retrieve stored subtitles from Neon. Returns None if not saved yet."""
    db = _db()
    try:
        row = db.query(TrackedVideo).filter(TrackedVideo.video_id == video_id).first()
        if row and row.subtitles:
            return row.subtitles
        return None
    finally:
        db.close()


def get_filtered_videos() -> list[dict]:
    """Return only videos confirmed to have Korean vocabulary."""
    db = _db()
    try:
        rows = (
            db.query(TrackedVideo)
            .filter(TrackedVideo.has_korean == True)
            .order_by(TrackedVideo.tracked_at.desc())
            .all()
        )
        return [
            {
                "video_id": r.video_id,
                "title": r.title,
                "youtube_url": r.youtube_url,
                "tracked_at": r.tracked_at,
                "has_korean": r.has_korean,
            }
            for r in rows
        ]
    finally:
        db.close()


def get_unchecked_videos() -> list[dict]:
    """Return videos where Korean subtitle availability hasn't been checked yet."""
    db = _db()
    try:
        rows = (
            db.query(TrackedVideo)
            .filter(TrackedVideo.has_korean == None)
            .order_by(TrackedVideo.tracked_at.desc())
            .all()
        )
        return [{"video_id": r.video_id, "title": r.title, "tracked_at": r.tracked_at} for r in rows]
    finally:
        db.close()
