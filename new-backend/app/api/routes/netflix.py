"""
Netflix subtitle handling routes.
Receives subtitles captured by the Chrome extension and stores them for vocabulary extraction.
"""
import json
import base64
from pathlib import Path
from typing import List, Set
from fastapi import APIRouter, HTTPException, Body
from app.core.config import settings
from app.services.video_store import update_video_duration
from app.services.vocab_service import load_frequency_map, is_common_particle
from app.services.korean_tokenizer import extract_korean_words
from app.services.ukrainian_tokenizer import extract_ukrainian_words

router = APIRouter()

# Cache frequency maps in memory
_FREQUENCY_MAP_KO: dict | None = None
_FREQUENCY_MAP_UK: dict | None = None


def get_frequency_map_cached(lang: str = 'ko') -> dict:
    """Get cached frequency map for a language."""
    global _FREQUENCY_MAP_KO, _FREQUENCY_MAP_UK
    if lang == 'uk':
        if _FREQUENCY_MAP_UK is None:
            _FREQUENCY_MAP_UK = load_frequency_map('uk')
        return _FREQUENCY_MAP_UK
    else:
        if _FREQUENCY_MAP_KO is None:
            _FREQUENCY_MAP_KO = load_frequency_map('ko')
        return _FREQUENCY_MAP_KO


def extract_keyword_timestamps(subtitles: List[dict], language: str) -> List[int]:
    """
    Identify which subtitle timestamps contain vocabulary words.
    Returns list of timestamps (in seconds) where keywords appear.
    """
    frequency_map = get_frequency_map_cached(language)
    extract_fn = extract_ukrainian_words if language == 'uk' else extract_korean_words
    text_key = 'ukrainian' if language == 'uk' else 'korean'

    keyword_timestamps: List[int] = []

    for sub in subtitles:
        text = sub.get(text_key, '')
        if not text:
            continue

        words = extract_fn(text)
        for word in words:
            rank = frequency_map.get(word)
            if rank is not None and not is_common_particle(word, rank, language):
                # This subtitle contains a keyword
                timestamp = int(sub.get('start', 0))
                keyword_timestamps.append(timestamp)
                break  # Only need one keyword per subtitle

    # Remove duplicates and sort
    return sorted(set(keyword_timestamps))

# Cache directory for Netflix subtitles
NETFLIX_CACHE_DIR = Path(settings.SUBTITLES_CACHE_DIR) / "netflix"
SCREENSHOTS_DIR = NETFLIX_CACHE_DIR / "screenshots"


def get_netflix_cache_path(video_id: str, lang: str) -> Path:
    """Get cache file path for Netflix subtitles."""
    NETFLIX_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return NETFLIX_CACHE_DIR / f"{video_id}_{lang}.json"


@router.post("/subtitles")
async def save_netflix_subtitles(request: dict = Body(...)):
    """
    Save Netflix subtitles captured by the Chrome extension.
    Body: { video_id, language, subtitles: [...] }
    """
    video_id = request.get("video_id")
    language = request.get("language", "ko")
    subtitles = request.get("subtitles", [])

    if not video_id or not subtitles:
        raise HTTPException(status_code=400, detail="video_id and subtitles are required")

    # Extract and save screenshots, remove from subtitle data
    screenshots_saved = 0
    clean_subtitles = []
    for sub in subtitles:
        screenshot = sub.pop("screenshot", None)
        if screenshot and screenshot.startswith("data:image"):
            # Save screenshot to file
            timestamp = int(sub.get("start", 0))
            screenshot_path = save_screenshot_file(video_id, timestamp, screenshot)
            if screenshot_path:
                sub["screenshot_path"] = screenshot_path
                screenshots_saved += 1
        clean_subtitles.append(sub)

    # Build subtitle data structure matching YouTube format
    data = {
        "video_id": video_id,
        "platform": "netflix",
        "total_subtitles": len(clean_subtitles),
        "has_korean": language == "ko",
        "has_ukrainian": language == "uk",
        "subtitles": clean_subtitles,
    }

    # Save to cache
    cache_file = get_netflix_cache_path(video_id, language)
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Calculate and save video duration from last subtitle
    if clean_subtitles:
        last_sub = clean_subtitles[-1]
        duration_seconds = int(last_sub.get("end", last_sub["start"] + last_sub.get("duration", 5)))
        try:
            update_video_duration(video_id, duration_seconds)
        except Exception:
            pass

    # Identify keyword timestamps for targeted screenshot capture
    keyword_timestamps = extract_keyword_timestamps(clean_subtitles, language)

    return {
        "status": "ok",
        "video_id": video_id,
        "language": language,
        "subtitle_count": len(clean_subtitles),
        "screenshots_saved": screenshots_saved,
        "keyword_timestamps": keyword_timestamps,
    }


def save_screenshot_file(video_id: str, timestamp: int, data_url: str) -> str | None:
    """Save a screenshot from data URL to file, return the relative path."""
    try:
        SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

        # Extract base64 data from data URL
        # Format: data:image/jpeg;base64,/9j/4AAQ...
        if "," not in data_url:
            return None
        header, b64_data = data_url.split(",", 1)

        # Determine file extension
        ext = "jpg" if "jpeg" in header else "png"

        # Create filename
        filename = f"{video_id}_{timestamp}.{ext}"
        filepath = SCREENSHOTS_DIR / filename

        # Decode and save
        with open(filepath, "wb") as f:
            f.write(base64.b64decode(b64_data))

        return f"screenshots/{filename}"
    except Exception as e:
        print(f"[Deadbird] Failed to save screenshot: {e}")
        return None


@router.get("/subtitles/{video_id}")
async def get_netflix_subtitles(video_id: str, lang: str = "ko"):
    """
    Get cached Netflix subtitles.
    """
    cache_file = get_netflix_cache_path(video_id, lang)

    if not cache_file.exists():
        raise HTTPException(status_code=404, detail=f"No {lang} subtitles found for {video_id}")

    with open(cache_file, "r", encoding="utf-8") as f:
        return json.load(f)


@router.post("/screenshot")
async def save_screenshot(request: dict = Body(...)):
    """
    Save a single screenshot from the extension.
    Body: { video_id, timestamp, data_url }
    """
    video_id = request.get("video_id")
    timestamp = request.get("timestamp")
    data_url = request.get("data_url")

    if not video_id or timestamp is None or not data_url:
        raise HTTPException(status_code=400, detail="video_id, timestamp, and data_url required")

    path = save_screenshot_file(video_id, int(timestamp), data_url)
    return {"status": "ok", "path": path}


@router.api_route("/screenshot/{video_id}/{timestamp}", methods=["GET", "HEAD"])
async def get_netflix_screenshot(video_id: str, timestamp: int):
    """
    Get a screenshot for a specific video and timestamp.
    Also checks nearby timestamps (within 3 seconds) for a match.
    """
    from fastapi.responses import FileResponse

    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    # Check exact timestamp and nearby (within 3 seconds)
    for offset in range(0, 4):
        for t in [timestamp + offset, timestamp - offset]:
            if t < 0:
                continue
            for ext in ["jpg", "png"]:
                filepath = SCREENSHOTS_DIR / f"{video_id}_{t}.{ext}"
                if filepath.exists():
                    return FileResponse(filepath, media_type=f"image/{ext}")

    raise HTTPException(status_code=404, detail="Screenshot not found")


def load_cached_netflix_subtitles(video_id: str, lang: str = "ko") -> dict | None:
    """Load Netflix subtitles from cache (for use by vocabulary service)."""
    cache_file = get_netflix_cache_path(video_id, lang)
    if cache_file.exists():
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return None
