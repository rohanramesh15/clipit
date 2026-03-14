from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel as PydanticModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.user_flashcard_progress import UserFlashcardProgress
from app.models.user_review_history import UserReviewHistory

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CardUpsert(PydanticModel):
    word: str
    language: str
    due: str                        # ISO datetime string from ts-fsrs
    stability: float = 0.0
    difficulty: float = 0.0
    elapsed_days: int = 0
    scheduled_days: int = 0
    reps: int = 0
    lapses: int = 0
    state: int = 0                  # 0=New 1=Learning 2=Review 3=Relearning
    last_review: Optional[str] = None
    video_id: Optional[str] = None  # YouTube video ID for deck organization


class CardBulkUpsert(PydanticModel):
    cards: list[CardUpsert]


class ReviewCreate(PydanticModel):
    word: str
    language: str
    rating: int                     # 1=Again 2=Hard 3=Good 4=Easy
    clip_duration: Optional[float] = None
    reviewed_at: str                # ISO datetime string


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_dt(dt_str: Optional[str]) -> Optional[datetime]:
    """Parse an ISO 8601 datetime string, handling the 'Z' UTC suffix."""
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return datetime.utcnow()


def _apply_card_upsert(
    db: Session, user_id: int, card: CardUpsert
) -> UserFlashcardProgress:
    due = _parse_dt(card.due) or datetime.utcnow()
    last_review = _parse_dt(card.last_review)

    existing = (
        db.query(UserFlashcardProgress)
        .filter(
            UserFlashcardProgress.user_id == user_id,
            UserFlashcardProgress.word == card.word,
            UserFlashcardProgress.language == card.language,
        )
        .first()
    )
    if existing:
        existing.due = due
        existing.stability = card.stability
        existing.difficulty = card.difficulty
        existing.elapsed_days = card.elapsed_days
        existing.scheduled_days = card.scheduled_days
        existing.reps = card.reps
        existing.lapses = card.lapses
        existing.state = card.state
        existing.last_review = last_review
        # Only update video_id if provided and not already set
        if card.video_id and not existing.video_id:
            existing.video_id = card.video_id
        return existing
    else:
        progress = UserFlashcardProgress(
            user_id=user_id,
            word=card.word,
            language=card.language,
            video_id=card.video_id,
            due=due,
            stability=card.stability,
            difficulty=card.difficulty,
            elapsed_days=card.elapsed_days,
            scheduled_days=card.scheduled_days,
            reps=card.reps,
            lapses=card.lapses,
            state=card.state,
            last_review=last_review,
        )
        db.add(progress)
        return progress


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/cards")
def get_cards(
    limit: int = 500,
    offset: int = 0,
    video_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return FSRS card states for the current user, with optional pagination and filtering."""
    query = (
        db.query(UserFlashcardProgress)
        .filter(UserFlashcardProgress.user_id == current_user.id)
    )

    # Filter by specific video (deck)
    if video_id:
        query = query.filter(UserFlashcardProgress.video_id == video_id)

    query = query.order_by(UserFlashcardProgress.word)
    total = query.count()
    rows = query.offset(offset).limit(limit).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "cards": [
            {
                "word": r.word,
                "language": r.language,
                "video_id": r.video_id,
                "due": r.due.isoformat() if r.due else None,
                "stability": r.stability,
                "difficulty": r.difficulty,
                "elapsed_days": r.elapsed_days,
                "scheduled_days": r.scheduled_days,
                "reps": r.reps,
                "lapses": r.lapses,
                "state": r.state,
                "last_review": r.last_review.isoformat() if r.last_review else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ],
    }


@router.post("/cards")
def upsert_card(
    card: CardUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upsert a single FSRS card state for the current user."""
    _apply_card_upsert(db, current_user.id, card)
    db.commit()
    return {"status": "ok", "word": card.word, "language": card.language}


@router.post("/cards/bulk")
def upsert_cards_bulk(
    body: CardBulkUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upsert many FSRS card states at once (for initial localStorage migration)."""
    for card in body.cards:
        _apply_card_upsert(db, current_user.id, card)
    db.commit()
    return {"status": "ok", "upserted": len(body.cards)}


@router.post("/reviews")
def add_review(
    review: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Append a review log entry for the current user."""
    reviewed_at = _parse_dt(review.reviewed_at) or datetime.utcnow()
    entry = UserReviewHistory(
        user_id=current_user.id,
        word=review.word,
        language=review.language,
        rating=review.rating,
        clip_duration=review.clip_duration,
        reviewed_at=reviewed_at,
    )
    db.add(entry)
    db.commit()
    return {"status": "ok"}


@router.get("/reviews")
def get_reviews(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return review history for the current user (analytics), newest first."""
    query = (
        db.query(UserReviewHistory)
        .filter(UserReviewHistory.user_id == current_user.id)
        .order_by(UserReviewHistory.reviewed_at.desc())
    )
    total = query.count()
    rows = query.offset(offset).limit(limit).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "reviews": [
            {
                "word": r.word,
                "language": r.language,
                "rating": r.rating,
                "clip_duration": r.clip_duration,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            }
            for r in rows
        ],
    }


@router.delete("/cards/{word}")
def delete_card(
    word: str,
    language: str = "ko",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a flashcard from the user's progress. Also removes review history."""
    # Delete the card progress
    deleted = (
        db.query(UserFlashcardProgress)
        .filter(
            UserFlashcardProgress.user_id == current_user.id,
            UserFlashcardProgress.word == word,
            UserFlashcardProgress.language == language,
        )
        .delete()
    )

    # Also delete review history for this word
    db.query(UserReviewHistory).filter(
        UserReviewHistory.user_id == current_user.id,
        UserReviewHistory.word == word,
        UserReviewHistory.language == language,
    ).delete()

    db.commit()

    if not deleted:
        raise HTTPException(status_code=404, detail="Card not found")

    return {"status": "ok", "word": word, "language": language}
