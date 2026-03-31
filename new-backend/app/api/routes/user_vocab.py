import csv
import io
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.user_vocabulary_list import UserVocabularyList
from app.models.user_vocabulary_word import UserVocabularyWord
from app.models.user_vocabulary_settings import UserVocabularySettings

router = APIRouter()


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class VocabListResponse(BaseModel):
    id: int
    name: str
    language: str
    word_count: int
    created_at: str

    class Config:
        from_attributes = True


class VocabWordResponse(BaseModel):
    id: int
    word: str
    translation: str
    sort_order: int

    class Config:
        from_attributes = True


class VocabListDetailResponse(BaseModel):
    id: int
    name: str
    language: str
    word_count: int
    words: List[VocabWordResponse]

    class Config:
        from_attributes = True


class VocabSettingsResponse(BaseModel):
    priority_mode: str
    new_cards_per_day: int = 10

    class Config:
        from_attributes = True


class VocabSettingsUpdate(BaseModel):
    priority_mode: Optional[str] = None  # 'uploaded_only', 'frequency_only', 'mixed'
    new_cards_per_day: Optional[int] = None  # Number of new cards per day


class WordCreate(BaseModel):
    word: str
    translation: str


# ── Vocabulary List Routes ───────────────────────────────────────────────────

@router.post("/lists/upload", response_model=VocabListResponse)
async def upload_vocabulary_list(
    file: UploadFile = File(...),
    name: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a CSV file with Korean vocabulary words.
    CSV format: word,translation (with optional header row)
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    try:
        decoded = content.decode('utf-8')
    except UnicodeDecodeError:
        decoded = content.decode('utf-8-sig')  # Handle BOM

    # Parse CSV
    reader = csv.reader(io.StringIO(decoded))
    rows = list(reader)

    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    # Skip header if it looks like a header
    start_idx = 0
    if rows[0] and rows[0][0].lower() in ['word', 'korean', '단어', 'vocabulary']:
        start_idx = 1

    # Create vocabulary list
    list_name = name or file.filename.replace('.csv', '')
    vocab_list = UserVocabularyList(
        user_id=current_user.id,
        name=list_name,
        language='ko',
        word_count=0
    )
    db.add(vocab_list)
    db.flush()  # Get the ID

    # Add words in batches (skip duplicates within the file)
    BATCH_SIZE = 500
    words_added = 0
    seen_words = set()
    batch = []

    for idx, row in enumerate(rows[start_idx:]):
        if len(row) >= 2:
            word = row[0].strip()
            translation = row[1].strip()
            if word and translation and word not in seen_words:
                seen_words.add(word)
                batch.append(UserVocabularyWord(
                    list_id=vocab_list.id,
                    word=word,
                    translation=translation,
                    sort_order=words_added
                ))
                words_added += 1

                # Commit in batches to avoid timeout
                if len(batch) >= BATCH_SIZE:
                    db.bulk_save_objects(batch)
                    db.commit()
                    print(f"[VOCAB UPLOAD] Batch committed: {words_added} words so far")
                    batch = []

    # Commit remaining words
    if batch:
        db.bulk_save_objects(batch)
        db.commit()

    # Refresh and update word count (object may be stale after bulk operations)
    db.refresh(vocab_list)
    vocab_list.word_count = words_added
    db.commit()

    print(f"[VOCAB UPLOAD] User {current_user.id} uploaded '{list_name}' with {words_added} words")
    db.refresh(vocab_list)

    return VocabListResponse(
        id=vocab_list.id,
        name=vocab_list.name,
        language=vocab_list.language,
        word_count=vocab_list.word_count,
        created_at=vocab_list.created_at.isoformat()
    )


@router.get("/lists", response_model=List[VocabListResponse])
def get_vocabulary_lists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all vocabulary lists for the current user."""
    lists = db.query(UserVocabularyList).filter(
        UserVocabularyList.user_id == current_user.id
    ).order_by(UserVocabularyList.created_at.desc()).all()

    return [
        VocabListResponse(
            id=vl.id,
            name=vl.name,
            language=vl.language,
            word_count=vl.word_count,
            created_at=vl.created_at.isoformat()
        )
        for vl in lists
    ]


@router.get("/lists/flashcards")
def get_vocab_list_flashcards(
    list_id: Optional[int] = None,
    language: str = 'ko',
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get flashcard-formatted data from user vocabulary lists.
    If list_id is provided, returns cards from that list only.
    Otherwise returns cards from all lists for the user.

    Returns TTS cards by default, but auto-upgrades to video cards
    if the word appeared in any watched video.
    """
    from app.models.user_video_watch import UserVideoWatch
    from app.services.subtitle_service import load_cached_subtitles, load_cached_subtitles_ukrainian
    from app.services.card_upgrade_service import find_sentence_for_word_simple

    query = (
        db.query(UserVocabularyWord)
        .join(UserVocabularyList)
        .filter(
            UserVocabularyList.user_id == current_user.id,
            UserVocabularyList.language == language
        )
    )

    if list_id:
        query = query.filter(UserVocabularyList.id == list_id)

    words = query.order_by(
        UserVocabularyList.created_at,
        UserVocabularyWord.sort_order
    ).all()

    # Get user's watched videos (most recent first)
    watched_videos = db.query(UserVideoWatch).filter(
        UserVideoWatch.user_id == current_user.id
    ).order_by(UserVideoWatch.watched_at.desc()).limit(50).all()

    print(f"[VOCAB FLASHCARDS DEBUG] User {current_user.id}: Found {len(watched_videos)} watched videos")
    if watched_videos:
        print(f"[VOCAB FLASHCARDS DEBUG] Video IDs: {[v.video_id for v in watched_videos[:5]]}")

    # Load subtitles for all watched videos
    video_subtitles = {}
    for watch in watched_videos:
        video_id = watch.video_id
        if video_id not in video_subtitles:
            if language == 'uk':
                subtitle_data = load_cached_subtitles_ukrainian(video_id)
            else:
                subtitle_data = load_cached_subtitles(video_id)
            video_subtitles[video_id] = subtitle_data.get('subtitles', []) if subtitle_data else []

    # Build flashcards, checking if each word appears in any watched video
    flashcards = []
    upgraded_count = 0

    for w in words:
        video_context = None

        # Check each watched video for this word
        for video_id, subtitles in video_subtitles.items():
            if not subtitles:
                continue
            sentence_data = find_sentence_for_word_simple(w.word, subtitles, language)
            if sentence_data and sentence_data.get('sentence') != w.word:
                # Found word in video subtitles
                video_context = {
                    'video_id': video_id,
                    'sentence': sentence_data['sentence'],
                    'sentence_translation': sentence_data['sentence_translation'],
                    'timestamp': sentence_data['timestamp'],
                    'end_timestamp': sentence_data['end_timestamp'],
                }
                break  # Use first video where word appears

        if video_context:
            # Word found in video - return as video card
            upgraded_count += 1
            flashcards.append({
                "target_word": w.word,
                "dictionary_form": w.word,
                "english": w.translation,
                "sentence": video_context['sentence'],
                "sentence_translation": video_context['sentence_translation'],
                "timestamp": video_context['timestamp'],
                "end_timestamp": video_context['end_timestamp'],
                "video_id": video_context['video_id'],
                "card_type": "video",
                "language": language,
            })
        else:
            # TTS-only card
            flashcards.append({
                "target_word": w.word,
                "dictionary_form": w.word,
                "english": w.translation,
                "sentence": None,
                "sentence_translation": None,
                "timestamp": None,
                "end_timestamp": None,
                "video_id": None,
                "card_type": "tts",
                "language": language,
            })

    if upgraded_count > 0:
        print(f"[VOCAB FLASHCARDS] User {current_user.id}: {upgraded_count} of {len(flashcards)} cards have video context")

    return {
        "total_cards": len(flashcards),
        "upgraded_cards": upgraded_count,
        "flashcards": flashcards
    }


@router.get("/lists/{list_id}", response_model=VocabListDetailResponse)
def get_vocabulary_list(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific vocabulary list with all words."""
    vocab_list = db.query(UserVocabularyList).filter(
        UserVocabularyList.id == list_id,
        UserVocabularyList.user_id == current_user.id
    ).first()

    if not vocab_list:
        raise HTTPException(status_code=404, detail="Vocabulary list not found")

    words = db.query(UserVocabularyWord).filter(
        UserVocabularyWord.list_id == list_id
    ).order_by(UserVocabularyWord.sort_order).all()

    return VocabListDetailResponse(
        id=vocab_list.id,
        name=vocab_list.name,
        language=vocab_list.language,
        word_count=vocab_list.word_count,
        words=[
            VocabWordResponse(
                id=w.id,
                word=w.word,
                translation=w.translation,
                sort_order=w.sort_order
            )
            for w in words
        ]
    )


@router.delete("/lists/{list_id}")
def delete_vocabulary_list(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a vocabulary list and all its words."""
    vocab_list = db.query(UserVocabularyList).filter(
        UserVocabularyList.id == list_id,
        UserVocabularyList.user_id == current_user.id
    ).first()

    if not vocab_list:
        raise HTTPException(status_code=404, detail="Vocabulary list not found")

    db.delete(vocab_list)
    db.commit()

    return {"status": "ok", "deleted_list_id": list_id}


@router.post("/lists/{list_id}/words", response_model=VocabWordResponse)
def add_word_to_list(
    list_id: int,
    word_data: WordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a single word to an existing vocabulary list."""
    vocab_list = db.query(UserVocabularyList).filter(
        UserVocabularyList.id == list_id,
        UserVocabularyList.user_id == current_user.id
    ).first()

    if not vocab_list:
        raise HTTPException(status_code=404, detail="Vocabulary list not found")

    # Get max sort_order
    max_order = db.query(UserVocabularyWord.sort_order).filter(
        UserVocabularyWord.list_id == list_id
    ).order_by(UserVocabularyWord.sort_order.desc()).first()

    new_order = (max_order[0] + 1) if max_order else 0

    word = UserVocabularyWord(
        list_id=list_id,
        word=word_data.word,
        translation=word_data.translation,
        sort_order=new_order
    )
    db.add(word)
    vocab_list.word_count += 1
    db.commit()
    db.refresh(word)

    return VocabWordResponse(
        id=word.id,
        word=word.word,
        translation=word.translation,
        sort_order=word.sort_order
    )


@router.delete("/words/{word_id}")
def delete_word(
    word_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a word from a vocabulary list."""
    word = db.query(UserVocabularyWord).join(UserVocabularyList).filter(
        UserVocabularyWord.id == word_id,
        UserVocabularyList.user_id == current_user.id
    ).first()

    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    vocab_list = word.vocabulary_list
    db.delete(word)
    vocab_list.word_count -= 1
    db.commit()

    return {"status": "ok", "deleted_word_id": word_id}


# ── Settings Routes ──────────────────────────────────────────────────────────

@router.get("/settings", response_model=VocabSettingsResponse)
def get_vocabulary_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the user's vocabulary and study settings."""
    settings = db.query(UserVocabularySettings).filter(
        UserVocabularySettings.user_id == current_user.id
    ).first()

    if not settings:
        return VocabSettingsResponse(priority_mode="mixed", new_cards_per_day=10)  # Defaults

    return VocabSettingsResponse(
        priority_mode=settings.priority_mode,
        new_cards_per_day=settings.new_cards_per_day
    )


@router.put("/settings", response_model=VocabSettingsResponse)
def update_vocabulary_settings(
    settings_data: VocabSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the user's vocabulary and study settings."""
    valid_modes = ['uploaded_only', 'frequency_only', 'mixed']
    if settings_data.priority_mode is not None and settings_data.priority_mode not in valid_modes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid priority_mode. Must be one of: {valid_modes}"
        )

    if settings_data.new_cards_per_day is not None and settings_data.new_cards_per_day < 0:
        raise HTTPException(
            status_code=400,
            detail="new_cards_per_day must be 0 or greater"
        )

    settings = db.query(UserVocabularySettings).filter(
        UserVocabularySettings.user_id == current_user.id
    ).first()

    if settings:
        if settings_data.priority_mode is not None:
            settings.priority_mode = settings_data.priority_mode
        if settings_data.new_cards_per_day is not None:
            settings.new_cards_per_day = settings_data.new_cards_per_day
    else:
        settings = UserVocabularySettings(
            user_id=current_user.id,
            priority_mode=settings_data.priority_mode or "mixed",
            new_cards_per_day=settings_data.new_cards_per_day if settings_data.new_cards_per_day is not None else 10
        )
        db.add(settings)

    db.commit()
    return VocabSettingsResponse(
        priority_mode=settings.priority_mode,
        new_cards_per_day=settings.new_cards_per_day
    )


# ── Helper: Get all user vocab words ─────────────────────────────────────────

def get_user_vocabulary_words(user_id: int, db: Session, language: str = 'ko') -> List[dict]:
    """
    Get all vocabulary words for a user across all their lists.
    Returns list of {"word": "...", "translation": "..."}
    """
    words = (
        db.query(UserVocabularyWord)
        .join(UserVocabularyList)
        .filter(
            UserVocabularyList.user_id == user_id,
            UserVocabularyList.language == language
        )
        .order_by(UserVocabularyList.created_at, UserVocabularyWord.sort_order)
        .all()
    )

    return [{"word": w.word, "translation": w.translation} for w in words]


def get_user_priority_mode(user_id: int, db: Session) -> str:
    """Get user's priority mode setting, defaults to 'mixed'."""
    settings = db.query(UserVocabularySettings).filter(
        UserVocabularySettings.user_id == user_id
    ).first()

    return settings.priority_mode if settings else "mixed"


def get_user_new_cards_per_day(user_id: int, db: Session) -> int:
    """Get user's new cards per day setting, defaults to 20."""
    settings = db.query(UserVocabularySettings).filter(
        UserVocabularySettings.user_id == user_id
    ).first()

    return settings.new_cards_per_day if settings else 10
