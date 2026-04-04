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


class RevertToTTSRequest(BaseModel):
    word: str
    language: str = 'ko'


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
    from sqlalchemy import func

    # Get lists with actual word counts (calculated, not stored)
    lists_with_counts = db.query(
        UserVocabularyList,
        func.count(UserVocabularyWord.id).label('actual_word_count')
    ).outerjoin(
        UserVocabularyWord,
        UserVocabularyWord.list_id == UserVocabularyList.id
    ).filter(
        UserVocabularyList.user_id == current_user.id
    ).group_by(
        UserVocabularyList.id
    ).order_by(
        UserVocabularyList.created_at.desc()
    ).all()

    return [
        VocabListResponse(
            id=vl.id,
            name=vl.name,
            language=vl.language,
            word_count=actual_count,  # Use calculated count
            created_at=vl.created_at.isoformat()
        )
        for vl, actual_count in lists_with_counts
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
    from app.api.routes.netflix import load_cached_netflix_subtitles

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

    # Load subtitles for all watched videos (YouTube and Netflix)
    video_subtitles = {}
    for watch in watched_videos:
        video_id = watch.video_id
        if video_id not in video_subtitles:
            if video_id.startswith('netflix_'):
                subtitle_data = load_cached_netflix_subtitles(video_id, language)
            elif language == 'uk':
                subtitle_data = load_cached_subtitles_ukrainian(video_id)
            else:
                subtitle_data = load_cached_subtitles(video_id)
            video_subtitles[video_id] = subtitle_data.get('subtitles', []) if subtitle_data else []

    # Build flashcards, checking if each word appears in any watched video
    flashcards = []
    upgraded_count = 0

    for w in words:
        video_context = None

        # Skip video upgrade if user prefers TTS for this word
        if not w.prefer_tts:
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
            # TTS-only card - use example sentence if available
            flashcards.append({
                "target_word": w.word,
                "dictionary_form": w.word,
                "english": w.translation,
                "sentence": w.example,  # Example sentence from vocab list
                "sentence_translation": w.example_translation,
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


@router.post("/words/revert-to-tts")
def revert_word_to_tts(
    request: RevertToTTSRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Revert a video card back to TTS-only.
    Sets prefer_tts=True so the word won't be auto-upgraded to video again.
    """
    # Find the word in user's vocab
    word_record = (
        db.query(UserVocabularyWord)
        .join(UserVocabularyList)
        .filter(
            UserVocabularyList.user_id == current_user.id,
            UserVocabularyList.language == request.language,
            UserVocabularyWord.word == request.word
        )
        .first()
    )

    if not word_record:
        raise HTTPException(status_code=404, detail="Word not found in vocabulary")

    # Mark word as preferring TTS
    word_record.prefer_tts = True
    db.commit()

    return {"status": "ok", "word": request.word, "card_type": "tts"}


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


# ── Join Class Endpoint ──────────────────────────────────────────────────────

# Korean 3 vocab organized by lesson and conversation
# Format: (word, translation, example_sentence)
KOREAN3_VOCAB = {
    "L11_C1": {
        "name": "Lesson 11 - Conversation 1",
        "words": [
            ("갈비", "ribs (Korean BBQ)", "제가 좋아하는 한국 음식은 갈비예요."),
            ("물", "water", "깨끗한 물을 마시세요!"),
            ("바닷가", "beach", "주말에 친구하고 바닷가에서 놀 거예요."),
            ("밴쿠버", "Vancouver", "밴쿠버는 캐나다에 있는 큰 도시예요."),
            ("불고기", "bulgogi", "제 동생은 불고기를 무척 좋아해서 매일 먹어요."),
            ("생활", "life; living", "대학교 생활이 바쁘지만 재미있어요."),
            ("어젯밤", "last night", "어젯밤에 잠을 잘 못 잤어요."),
            ("차", "tea; car", "지금 너무 더워서 차가운 차를 마시고 싶어요."),
            ("청바지", "jeans", "백화점에서 청바지하고 스웨터를 샀어요."),
            ("캐나다", "Canada", "캐나다에 한국 사람들이 많이 살아요?"),
            ("잔", "counter for cups/glasses", "아침에 커피 두 잔을 마셨어요."),
            ("어떤", "what kind of", "어떤 사람을 좋아해요?"),
            ("되다", "to become", "저는 의사가 되고 싶어요."),
            ("눈이 오다", "to snow", "밤에 눈이 많이 왔어요."),
            ("사귀다", "to make friends; to date", "한국 친구를 사귀고 싶어요."),
            ("쓰다", "to use", "제니는 친구와 같이 부엌을 써요."),
            ("착하다", "to be kind-hearted", "저는 착한 사람이 좋아요."),
            ("친절하다", "to be friendly; kind", "미나는 친절한 사람이에요."),
            ("-(으)ㄹ래요", "Do you want to...? / I want to...", "이번 주말에 같이 한국 식당에 갈래요?"),
            ("-고 있다", "to be doing (progressive)", "지금 앤디가 음악을 듣고 있어요."),
            ("-고 계시다", "to be doing (honorific progressive)", "선생님께서 케이크를 만들고 계세요."),
            ("잘 됐네요", "That's great / It sounds good", "시험이 끝났어요. 잘 됐네요!"),
            ("1이 어떻게 됩니까/돼요/되세요?", "What is your [noun]? (polite inquiry form)", "성함이 어떻게 되세요?"),
        ]
    },
    "L11_C2": {
        "name": "Lesson 11 - Conversation 2",
        "words": [
            ("골프", "golf", "저는 골프를 못 쳐요. 하지만 샘은 골프를 잘 쳐요."),
            ("기차", "train", "기차를 타고 놀러 갔어요."),
            ("연극", "play (theater)", "저녁에 같이 연극을 볼래요?"),
            ("인터넷", "internet", "인터넷으로 콘서트 표를 샀어요."),
            ("입구", "entrance", "미나하고 제니를 지하철역 입구에서 만났어요."),
            ("끝나다", "to be over; finished", "오늘 수업이 일찍 끝났어요."),
            ("쉬다", "to rest", "피곤해서 오늘은 좀 쉬고 싶어요."),
            ("알아보다", "to find out; check out", "지금 한국 비행기 가격을 인터넷으로 알아보고 있어요."),
            ("찾다", "to find; look for", "뭐 찾으세요? 남자 모자를 찾고 있어요."),
            ("춤을 추다", "to dance", "수지는 춤을 잘 추는데 미나는 못 춰요."),
            ("힘이 들다", "to be hard; difficult", "요즘 일이 많아서 피곤하고 힘들어요."),
            ("다", "all", "배고파서 음식을 다 먹고 싶어요."),
            ("벌써", "already", "벌써 12시예요? 몰랐어요."),
            ("N까지", "to / until / through (time)", "집에서 학교까지 한 시간이 걸려요."),
            ("N밖에", "nothing but; only", "집에서 학교까지 걸어서 5분밖에 안 걸려요."),
            ("N부터", "from (time)", "매일 7시 45분부터 8시 35분까지 한국어 수업을 들어요."),
            ("N이나", "as much/many as", "지난 학기에 다섯 과목이나 들었어요?"),
            ("V-(으)ㄹ까요?", "Shall I/we...? / Do you think...?", "내일 같이 영화 볼까요?"),
            ("글쎄요", "Well; It's hard to say", "글쎄요. 잘 모르겠어요."),
            ("몇 과목", "how many subjects", "이번 학기에 몇 과목을 들어요?"),
            ("스무 명", "20 people", "우리 반에 스무 명이 있어요."),
            ("스물 한 명", "21 people", "파티에 스물 한 명이 왔어요."),
            ("공연하다", "to perform", "토요일 저녁에 저희 밴드가 Hop에서 공연합니다."),
            ("소극장", "small theater", "우리는 소극장에서 공연할 거예요."),
            ("골프장", "golf course", "골프장에서 골프를 쳤어요."),
        ]
    },
    "L12_C1": {
        "name": "Lesson 12 - Conversation 1",
        "words": [
            ("데", "place", "항상 서울 식당만 갔는데 오늘은 다른 데에 가고 싶어요."),
            ("동부", "East Coast", "제 할머니께서 미국 동부에 살고 계세요."),
            ("막내", "youngest child", "저는 막내예요. 그래서 동생이 없어요."),
            ("바지", "pants", "제니가 바지를 입었어요."),
            ("밤", "night", "밤에 안 자고 공부했어요."),
            ("부엌", "kitchen", "부엌에서 음식을 만들어서 친구하고 같이 먹었어요."),
            ("셔츠", "shirt", "셔츠를 입고 있는 사람이 마이클이에요."),
            ("형제", "siblings", "저는 형제가 없어요. 외동이에요."),
            ("첫", "first (pre-noun)", "첫눈이 왔어요."),
            ("다르다", "to be different", "한국이 미국하고 문화가 달라요."),
            ("피곤하다", "to be tired", "어제 늦게 자서 지금 피곤해요."),
            ("결혼하다", "to get married", "저희 부모님이 22년 전에 결혼하셨어요."),
            ("기다리다", "to wait", "친구를 기다리고 있어요."),
            ("자라다", "to grow up", "아이가 자라서 어른이 되었어요."),
            ("태어나다", "to be born", "제가 태어난 곳은 한국이에요."),
            ("아직", "still; yet", "숙제를 아직 못 했어요."),
            ("N까지", "including (particle)", "1시부터 2시까지 카페에서 아르바이트해요."),
            ("째", "ordinal number counter", "저는 셋째예요."),
            ("번째", "ordinal number counter", "첫 번째 문제가 어려웠어요."),
            ("-겠-", "may/will (conjecture)", "늦게 자서 피곤하겠어요."),
            ("-아서/어서", "clausal connective (sequential)", "도서관에 가서 공부했어요."),
            ("자매", "sisters; female siblings", "저는 언니만 있어요. 우리는 자매예요."),
            ("배고프다", "to be hungry", "아침을 못 먹어서 너무 배고파요."),
            ("배부르다", "to be full", "많이 먹어서 배불러요."),
            ("기분이 좋다", "to be in a good mood", "숙제를 다 해서 기분이 좋아요."),
        ]
    },
    "L12_C2": {
        "name": "Lesson 12 - Conversation 2",
        "words": [
            ("눈", "1) eyes  2) snow", "제 눈은 갈색이에요."),
            ("색", "color", "저는 흰색을 좋아해요."),
            ("색깔", "color", "무슨 색깔을 좋아해요?"),
            ("안경", "eyeglasses", "미나는 안경을 샀어요. 눈이 나빠요."),
            ("한복", "traditional Korean dress", "설날에 한복을 많이 입어요."),
            ("형님", "older brother (honorific)", "형님께 선물을 드렸어요."),
            ("끼다", "to wear (glasses/gloves/rings)", "수지는 손에 반지를 꼈어요."),
            ("나오다", "to come out", "아침 일찍 집에서 나왔어요."),
            ("다니다", "to attend", "앤디는 다트머스 대학에 다녀요."),
            ("닮다", "to resemble", "미나하고 수지는 얼굴이 닮았어요."),
            ("쓰다", "to wear headgear", "모자를 쓴 사람이 누구예요?"),
            ("입다", "to wear; put on (clothes)", "마이클은 오늘 멋있는 옷을 입었어요."),
            ("벗다", "to take off (clothes)", "더워서 패딩을 벗었어요."),
            ("N이랑", "with; and", "유미랑 미나는 베프예요."),
            ("까맣다", "to be black", "제 눈은 까만 색이에요."),
            ("노랗다", "to be yellow", "노란 옷을 입은 사람이 제니예요."),
            ("빨갛다", "to be red", "빨간 사과를 먹고 싶어요."),
            ("파랗다", "to be blue", "파란 하늘이 참 예뻐요."),
            ("하얗다", "to be white", "하얀 눈이 많이 왔어요."),
            ("키가 크다", "to be tall", "톰은 키가 커요."),
            ("키가 작다", "to be short (height)", "제리는 키가 작아요."),
            ("오래", "for a long time", "저는 한국에서 오래 살았어요."),
            ("어머", "Oh my! Dear me!", "어머! 정말요?"),
            ("V/A-네요", "sentence ending indicating speaker's reaction", "날씨가 정말 좋네요!"),
            ("V-(으)ㄴ", "noun-modifying form (past tense verb)", "어제 먹은 음식이 뭐예요?"),
        ]
    },
}

# Hardcoded class definitions (can be moved to database later)
CLASS_DEFINITIONS = {
    "DARTKOR3": {
        "name": "Korean 3 - Prof Hwang",
        "language": "ko",
        "type": "multi_list",  # Creates multiple vocab lists
        "lists": [
            {"key": "L11_C1", "name": "Korean 3 - L11 Conversation 1"},
            {"key": "L11_C2", "name": "Korean 3 - L11 Conversation 2"},
            {"key": "L12_C1", "name": "Korean 3 - L12 Conversation 1"},
            {"key": "L12_C2", "name": "Korean 3 - L12 Conversation 2"},
            {"key": "L11_ALL", "name": "Korean 3 - Lesson 11 (All)"},
            {"key": "L12_ALL", "name": "Korean 3 - Lesson 12 (All)"},
            {"key": "ALL", "name": "Korean 3 - All Vocab"},
        ]
    },
}


class JoinClassRequest(BaseModel):
    class_code: str


class JoinClassResponse(BaseModel):
    status: str
    class_name: str
    words_added: int
    lists_created: int = 1


class LeaveClassRequest(BaseModel):
    class_code: str


class LeaveClassResponse(BaseModel):
    success: bool
    class_name: str
    lists_deleted: int
    words_deleted: int


class EnrolledClass(BaseModel):
    class_code: str
    class_name: str
    lists_count: int
    words_count: int


class EnrolledClassesResponse(BaseModel):
    classes: list[EnrolledClass]


def _get_words_for_key(key: str) -> list:
    """Get words for a given vocab key (supports combined keys like L11_ALL, ALL).
    Deduplicates words by word field, keeping the first occurrence.
    """
    def dedupe_words(words_list: list) -> list:
        """Remove duplicate words, keeping first occurrence."""
        seen = set()
        result = []
        for word_tuple in words_list:
            word = word_tuple[0]
            if word not in seen:
                seen.add(word)
                result.append(word_tuple)
        return result

    if key == "ALL":
        # Combine all lessons
        all_words = []
        for vocab_key in KOREAN3_VOCAB:
            all_words.extend(KOREAN3_VOCAB[vocab_key]["words"])
        return dedupe_words(all_words)
    elif key == "L11_ALL":
        # Combine L11 conversations
        words = []
        words.extend(KOREAN3_VOCAB["L11_C1"]["words"])
        words.extend(KOREAN3_VOCAB["L11_C2"]["words"])
        return dedupe_words(words)
    elif key == "L12_ALL":
        # Combine L12 conversations
        words = []
        words.extend(KOREAN3_VOCAB["L12_C1"]["words"])
        words.extend(KOREAN3_VOCAB["L12_C2"]["words"])
        return dedupe_words(words)
    elif key in KOREAN3_VOCAB:
        return KOREAN3_VOCAB[key]["words"]
    return []


@router.post("/join-class", response_model=JoinClassResponse)
def join_class(
    request: JoinClassRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Join a class by code and get pre-made vocab lists.
    Creates multiple vocab lists for study by lesson/conversation.
    """
    class_code = request.class_code.upper().strip()

    if class_code not in CLASS_DEFINITIONS:
        raise HTTPException(status_code=404, detail="Class not found. Please check your class code.")

    class_def = CLASS_DEFINITIONS[class_code]
    class_name = class_def["name"]
    language = class_def["language"]

    # Check if user already has any list from this class
    first_list_name = class_def["lists"][0]["name"] if class_def.get("type") == "multi_list" else class_name
    existing_list = db.query(UserVocabularyList).filter(
        UserVocabularyList.user_id == current_user.id,
        UserVocabularyList.name == first_list_name
    ).first()

    if existing_list:
        raise HTTPException(status_code=400, detail="You've already joined this class!")

    total_words = 0
    lists_created = 0

    if class_def.get("type") == "multi_list":
        # Create multiple vocab lists
        for list_config in class_def["lists"]:
            vocab_list = UserVocabularyList(
                user_id=current_user.id,
                name=list_config["name"],
                language=language,
                word_count=0,
            )
            db.add(vocab_list)
            db.flush()

            words = _get_words_for_key(list_config["key"])
            for idx, (word, translation, example) in enumerate(words):
                vocab_word = UserVocabularyWord(
                    list_id=vocab_list.id,
                    word=word,
                    translation=translation,
                    example=example,
                    sort_order=idx,
                )
                db.add(vocab_word)

            # Update word count
            vocab_list.word_count = len(words)
            total_words += len(words)
            lists_created += 1
    else:
        # Single list (legacy format)
        vocab_list = UserVocabularyList(
            user_id=current_user.id,
            name=class_name,
            language=language,
            word_count=0,
        )
        db.add(vocab_list)
        db.flush()

        words = class_def.get("words", [])
        for idx, word_data in enumerate(words):
            if len(word_data) == 3:
                word, translation, example = word_data
            else:
                word, translation = word_data
                example = None

            vocab_word = UserVocabularyWord(
                list_id=vocab_list.id,
                word=word,
                translation=translation,
                example=example,
                sort_order=idx,
            )
            db.add(vocab_word)

        # Update word count
        vocab_list.word_count = len(words)
        total_words = len(words)
        lists_created = 1

    db.commit()

    return JoinClassResponse(
        status="ok",
        class_name=class_name,
        words_added=total_words,
        lists_created=lists_created
    )


@router.get("/enrolled-classes", response_model=EnrolledClassesResponse)
def get_enrolled_classes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get list of classes the user is enrolled in.
    """
    enrolled = []

    for class_code, class_def in CLASS_DEFINITIONS.items():
        if class_def.get("type") == "multi_list":
            # Check if user has any of the class lists
            list_names = [lst["name"] for lst in class_def["lists"]]
            user_lists = db.query(UserVocabularyList).filter(
                UserVocabularyList.user_id == current_user.id,
                UserVocabularyList.name.in_(list_names)
            ).all()

            if user_lists:
                total_words = sum(lst.word_count for lst in user_lists)
                enrolled.append(EnrolledClass(
                    class_code=class_code,
                    class_name=class_def["name"],
                    lists_count=len(user_lists),
                    words_count=total_words
                ))
        else:
            # Single list class
            user_list = db.query(UserVocabularyList).filter(
                UserVocabularyList.user_id == current_user.id,
                UserVocabularyList.name == class_def["name"]
            ).first()

            if user_list:
                enrolled.append(EnrolledClass(
                    class_code=class_code,
                    class_name=class_def["name"],
                    lists_count=1,
                    words_count=user_list.word_count
                ))

    return EnrolledClassesResponse(classes=enrolled)


@router.post("/leave-class", response_model=LeaveClassResponse)
def leave_class(
    request: LeaveClassRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Leave a class and remove all associated vocabulary lists.
    This deletes all lists created when joining the class.
    """
    class_code = request.class_code.upper().strip()

    if class_code not in CLASS_DEFINITIONS:
        raise HTTPException(status_code=404, detail="Class not found")

    class_def = CLASS_DEFINITIONS[class_code]
    class_name = class_def["name"]

    # Find all vocabulary lists from this class by their exact names
    lists_to_delete = []

    if class_def.get("type") == "multi_list":
        # For multi-list classes, find lists by their exact names
        list_names = [lst["name"] for lst in class_def["lists"]]
        lists_to_delete = db.query(UserVocabularyList).filter(
            UserVocabularyList.user_id == current_user.id,
            UserVocabularyList.name.in_(list_names)
        ).all()
    else:
        # For single-list classes, find by class name
        lists_to_delete = db.query(UserVocabularyList).filter(
            UserVocabularyList.user_id == current_user.id,
            UserVocabularyList.name == class_name
        ).all()

    if not lists_to_delete:
        raise HTTPException(
            status_code=404,
            detail=f"You are not enrolled in {class_name}"
        )

    # Count words before deletion
    total_words = sum(lst.word_count for lst in lists_to_delete)
    lists_count = len(lists_to_delete)

    # Delete all lists (CASCADE will delete words)
    for vocab_list in lists_to_delete:
        db.delete(vocab_list)

    db.commit()

    return LeaveClassResponse(
        success=True,
        class_name=class_name,
        lists_deleted=lists_count,
        words_deleted=total_words
    )
