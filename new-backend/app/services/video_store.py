import time
from app.core.database import SessionLocal
from app.models.video import TrackedVideo


def _db():
    return SessionLocal()


def add_video(video_id: str, title: str, season: int = None, episode: int = None, episode_title: str = None) -> bool:
    """Insert video if not already tracked. Returns True if newly added."""
    db = _db()
    try:
        existing = db.query(TrackedVideo).filter(TrackedVideo.video_id == video_id).first()
        if existing:
            # Update episode info if provided and not already set
            if season and not existing.season:
                existing.season = season
            if episode and not existing.episode:
                existing.episode = episode
            if episode_title and not existing.episode_title:
                existing.episode_title = episode_title
            db.commit()
            return False
        video = TrackedVideo(
            video_id=video_id,
            title=title,
            youtube_url=f"https://www.youtube.com/watch?v={video_id}",
            tracked_at=time.time(),
            season=season,
            episode=episode,
            episode_title=episode_title,
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
                "has_ukrainian": r.has_ukrainian,
                "season": r.season,
                "episode": r.episode,
                "episode_title": r.episode_title,
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


def update_video_title(video_id: str, title: str) -> bool:
    """Update the title for a video. Only updates if current title is generic."""
    db = _db()
    try:
        video = db.query(TrackedVideo).filter(TrackedVideo.video_id == video_id).first()
        if not video:
            return False
        # Only update if current title is generic/unknown
        generic_titles = ['Unknown', 'Netflix Video', 'Netflix', '']
        if video.title in generic_titles or video.title is None:
            video.title = title
            db.commit()
            return True
        return False
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
                "has_ukrainian": r.has_ukrainian,
                "season": r.season,
                "episode": r.episode,
                "episode_title": r.episode_title,
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


def update_ukrainian_status(video_id: str, has_ukrainian: bool) -> None:
    db = _db()
    try:
        db.query(TrackedVideo).filter(TrackedVideo.video_id == video_id).update(
            {"has_ukrainian": has_ukrainian}
        )
        db.commit()
    finally:
        db.close()


def get_ukrainian_filtered_videos() -> list[dict]:
    """Return only videos confirmed to have Ukrainian vocabulary."""
    db = _db()
    try:
        rows = (
            db.query(TrackedVideo)
            .filter(TrackedVideo.has_ukrainian == True)
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
                "has_ukrainian": r.has_ukrainian,
                "season": r.season,
                "episode": r.episode,
                "episode_title": r.episode_title,
            }
            for r in rows
        ]
    finally:
        db.close()


def get_unchecked_ukrainian_videos() -> list[dict]:
    """Return videos where Ukrainian subtitle availability hasn't been checked yet."""
    db = _db()
    try:
        rows = (
            db.query(TrackedVideo)
            .filter(TrackedVideo.has_ukrainian == None)
            .order_by(TrackedVideo.tracked_at.desc())
            .all()
        )
        return [{"video_id": r.video_id, "title": r.title, "tracked_at": r.tracked_at} for r in rows]
    finally:
        db.close()


def update_video_duration(video_id: str, duration_seconds: int) -> None:
    """Update the duration of a video in seconds."""
    db = _db()
    try:
        db.query(TrackedVideo).filter(TrackedVideo.video_id == video_id).update(
            {"duration_seconds": duration_seconds}
        )
        db.commit()
    finally:
        db.close()


def get_total_watch_time(lang: str = "ko") -> dict:
    """Get total watch time stats for videos in the target language."""
    db = _db()
    try:
        if lang == "uk":
            rows = db.query(TrackedVideo).filter(TrackedVideo.has_ukrainian == True).all()
        else:
            rows = db.query(TrackedVideo).filter(TrackedVideo.has_korean == True).all()

        total_seconds = sum(r.duration_seconds or 0 for r in rows)
        video_count = len(rows)
        videos_with_duration = sum(1 for r in rows if r.duration_seconds)

        return {
            "total_seconds": total_seconds,
            "total_hours": round(total_seconds / 3600, 1),
            "video_count": video_count,
            "videos_with_duration": videos_with_duration,
        }
    finally:
        db.close()
