import sqlite3
import time
from app.core.config import settings


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tracked_videos (
            video_id TEXT PRIMARY KEY,
            title TEXT,
            tracked_at REAL NOT NULL,
            has_korean INTEGER DEFAULT NULL
        )
    """)
    conn.commit()
    return conn


def add_video(video_id: str, title: str) -> bool:
    """Insert video if not already tracked. Returns True if newly added."""
    conn = _get_conn()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO tracked_videos (video_id, title, tracked_at) VALUES (?, ?, ?)",
            (video_id, title, time.time())
        )
        conn.commit()
        return conn.total_changes > 0
    finally:
        conn.close()


def get_all_videos() -> list[dict]:
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT video_id, title, tracked_at, has_korean FROM tracked_videos ORDER BY tracked_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def update_korean_status(video_id: str, has_korean: bool) -> None:
    conn = _get_conn()
    try:
        conn.execute(
            "UPDATE tracked_videos SET has_korean = ? WHERE video_id = ?",
            (1 if has_korean else 0, video_id)
        )
        conn.commit()
    finally:
        conn.close()


def get_filtered_videos() -> list[dict]:
    """Return only videos confirmed to have Korean subtitles."""
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT video_id, title, tracked_at, has_korean FROM tracked_videos WHERE has_korean = 1 ORDER BY tracked_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_unchecked_videos() -> list[dict]:
    """Return videos where Korean subtitle availability hasn't been checked yet."""
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT video_id, title, tracked_at FROM tracked_videos WHERE has_korean IS NULL"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
