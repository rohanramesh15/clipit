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

    class Config:
        from_attributes = True


class VocabSettingsUpdate(BaseModel):
    priority_mode: str  # 'uploaded_only', 'frequency_only', 'mixed'


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

    # Add words (skip duplicates within the file)
    words_added = 0
    seen_words = set()
    for idx, row in enumerate(rows[start_idx:]):
        if len(row) >= 2:
            word = row[0].strip()
            translation = row[1].strip()
            if word and translation and word not in seen_words:
                seen_words.add(word)
                vocab_word = UserVocabularyWord(
                    list_id=vocab_list.id,
                    word=word,
                    translation=translation,
                    sort_order=words_added
                )
                db.add(vocab_word)
                words_added += 1

    vocab_list.word_count = words_added

    print(f"[VOCAB UPLOAD] User {current_user.id} uploaded '{list_name}' with {words_added} words")
    db.commit()
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
    """Get the user's vocabulary priority settings."""
    settings = db.query(UserVocabularySettings).filter(
        UserVocabularySettings.user_id == current_user.id
    ).first()

    if not settings:
        return VocabSettingsResponse(priority_mode="mixed")  # Default

    return VocabSettingsResponse(priority_mode=settings.priority_mode)


@router.put("/settings", response_model=VocabSettingsResponse)
def update_vocabulary_settings(
    settings_data: VocabSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the user's vocabulary priority settings."""
    valid_modes = ['uploaded_only', 'frequency_only', 'mixed']
    if settings_data.priority_mode not in valid_modes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid priority_mode. Must be one of: {valid_modes}"
        )

    settings = db.query(UserVocabularySettings).filter(
        UserVocabularySettings.user_id == current_user.id
    ).first()

    if settings:
        settings.priority_mode = settings_data.priority_mode
    else:
        settings = UserVocabularySettings(
            user_id=current_user.id,
            priority_mode=settings_data.priority_mode
        )
        db.add(settings)

    db.commit()
    return VocabSettingsResponse(priority_mode=settings.priority_mode)


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
