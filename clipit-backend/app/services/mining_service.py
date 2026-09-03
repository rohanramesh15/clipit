"""
Vocabulary Mining Limits Service

Implements mining limits for Netflix/YouTube playback:
- Cap mining at ~4 cards per 10 minutes of content
- Enforce 20-second gap between mined moments
- Prioritize words appearing 2+ times in subtitles
- Exclude words already mined in previous watches
"""

from datetime import datetime
from typing import List, Dict, Optional, Set
from collections import Counter
from dataclasses import dataclass
from sqlalchemy.orm import Session

from app.models.user_mined_word import UserMinedWord
from app.models.user_mined_word_source import UserMinedWordSource


# Mining configuration
CARDS_PER_10_MIN = 4  # Default: 4 cards per 10 minutes
MIN_GAP_SECONDS = 20  # Minimum 20 seconds between mined moments
MIN_CARDS = 4  # Minimum cards for videos under 10 min


@dataclass
class MiningSession:
    """Tracks state for a single mining session."""
    video_id: str
    duration_seconds: float
    session_cap: int
    session_mined_count: int = 0
    last_mined_timestamp: Optional[float] = None
    mined_words_this_session: Set[str] = None

    def __post_init__(self):
        if self.mined_words_this_session is None:
            self.mined_words_this_session = set()


def calculate_session_cap(duration_seconds: float) -> int:
    """
    Calculate the mining cap based on video duration.

    Formula: Math.floor(durationMinutes / 10) * 4
    Minimum: 4 cards for anything under 10 min
    """
    duration_minutes = duration_seconds / 60
    cap = int(duration_minutes // 10) * CARDS_PER_10_MIN
    return max(cap, MIN_CARDS)


def get_previously_mined_words(
    user_id: int,
    video_id: str,
    language: str,
    db: Session
) -> Set[str]:
    """Get words already mined from this video in previous sessions."""
    mined = (
        db.query(UserMinedWord.word)
        .join(UserMinedWordSource, UserMinedWordSource.mined_word_id == UserMinedWord.id)
        .filter(
            UserMinedWord.user_id == user_id,
            UserMinedWord.language == language,
            UserMinedWordSource.video_id == video_id,
        )
        .all()
    )
    return {w[0] for w in mined}


def count_word_occurrences(
    subtitles: List[Dict],
    words: List[str],
    language_key: str = "korean"
) -> Counter:
    """
    Count how many times each word appears across all subtitles.
    Returns Counter with word -> count mapping.
    """
    word_counts = Counter()
    word_set = set(words)

    for subtitle in subtitles:
        text = subtitle.get(language_key, "") or ""
        # Simple word splitting - could be enhanced with tokenizer
        subtitle_words = text.split()
        for w in subtitle_words:
            # Strip common punctuation
            w_clean = w.strip(".,!?~…·\"'()[]{}:;")
            if w_clean in word_set:
                word_counts[w_clean] += 1

    return word_counts


def get_word_timestamps(
    subtitles: List[Dict],
    word: str,
    language_key: str = "korean"
) -> List[float]:
    """Get all timestamps where a word appears in subtitles."""
    timestamps = []
    for subtitle in subtitles:
        text = subtitle.get(language_key, "") or ""
        if word in text:
            start = subtitle.get("start", 0)
            timestamps.append(float(start))
    return timestamps


def apply_mining_limits(
    vocabulary: List[Dict],
    subtitles: List[Dict],
    duration_seconds: float,
    user_id: Optional[int],
    video_id: str,
    language: str,
    db: Optional[Session] = None
) -> Dict:
    """
    Apply mining limits to vocabulary list.

    Args:
        vocabulary: List of vocab dicts with 'word', 'rank', etc.
        subtitles: Full subtitle list for word frequency counting
        duration_seconds: Video duration in seconds
        user_id: User ID (None if unauthenticated)
        video_id: Video ID for mining history
        language: Language code ('ko', 'uk')
        db: Database session (required if user_id provided)

    Returns:
        Dict with:
        - vocabulary: Filtered/limited vocabulary list
        - session_cap: Calculated cap for this session
        - applied_limits: Whether limits were applied
        - excluded_previously_mined: Count of words excluded
    """
    if language == "uk":
        language_key = "ukrainian"
    elif language == "es":
        language_key = "spanish"
    elif language == "en":
        language_key = "english"
    else:
        language_key = "korean"

    # Calculate session cap
    session_cap = calculate_session_cap(duration_seconds)

    # Get previously mined words (if authenticated)
    previously_mined: Set[str] = set()
    if user_id and db:
        previously_mined = get_previously_mined_words(user_id, video_id, language, db)

    # Filter out previously mined words
    available_vocab = [v for v in vocabulary if v['word'] not in previously_mined]
    excluded_count = len(vocabulary) - len(available_vocab)

    # Count word occurrences in subtitles for prioritization
    all_words = [v['word'] for v in available_vocab]
    word_counts = count_word_occurrences(subtitles, all_words, language_key)

    # Separate into high-frequency (2+) and single-occurrence
    high_freq_vocab = []
    single_vocab = []

    for v in available_vocab:
        count = word_counts.get(v['word'], 0)
        v['occurrence_count'] = count
        if count >= 2:
            high_freq_vocab.append(v)
        else:
            single_vocab.append(v)

    # Sort high-frequency by occurrence count (descending), then by rank
    high_freq_vocab.sort(key=lambda x: (-x['occurrence_count'], x.get('rank', 99999)))

    # Sort single-occurrence by rank
    single_vocab.sort(key=lambda x: x.get('rank', 99999))

    # Combine: high-frequency first, then single-occurrence
    prioritized_vocab = high_freq_vocab + single_vocab

    # Apply session cap
    limited_vocab = []
    last_timestamp: Optional[float] = None

    for v in prioritized_vocab:
        if len(limited_vocab) >= session_cap:
            break

        # Get first timestamp for this word
        timestamps = get_word_timestamps(subtitles, v['word'], language_key)
        word_timestamp = timestamps[0] if timestamps else None

        # Enforce 20-second gap
        if word_timestamp is not None and last_timestamp is not None:
            if abs(word_timestamp - last_timestamp) < MIN_GAP_SECONDS:
                # Try to find a later timestamp that satisfies the gap
                valid_timestamp = None
                for ts in timestamps:
                    if abs(ts - last_timestamp) >= MIN_GAP_SECONDS:
                        valid_timestamp = ts
                        break

                if valid_timestamp is None:
                    # Skip this word - no valid timestamp
                    continue
                word_timestamp = valid_timestamp

        v['mined_timestamp'] = word_timestamp
        limited_vocab.append(v)

        if word_timestamp is not None:
            last_timestamp = word_timestamp

    return {
        'vocabulary': limited_vocab,
        'session_cap': session_cap,
        'applied_limits': True,
        'excluded_previously_mined': excluded_count,
        'high_frequency_count': len([v for v in limited_vocab if v.get('occurrence_count', 0) >= 2]),
        'duration_minutes': round(duration_seconds / 60, 1)
    }


def _upsert_mined_word(
    db: Session,
    user_id: int,
    video_id: str,
    word: str,
    language: str,
    *,
    lemma: Optional[str] = None,
    rank: Optional[int] = None,
    video_occurrence_count: int = 1,
    timestamp: Optional[float] = None,
) -> bool:
    """Upsert one word's identity row plus its per-video source row — the
    single write path into the mined-word source of truth. Returns True if
    this created a brand-new identity row (word never seen before by this
    user), False if it only updated an existing one."""
    mined = db.query(UserMinedWord).filter(
        UserMinedWord.user_id == user_id,
        UserMinedWord.word == word,
        UserMinedWord.language == language,
    ).first()

    is_new = mined is None
    if mined is None:
        mined = UserMinedWord(
            user_id=user_id,
            word=word,
            language=language,
            lemma=lemma,
            rank=rank,
            occurrence_count=0,
            first_seen_at=datetime.utcnow(),
        )
        db.add(mined)
        db.flush()
    else:
        if lemma and not mined.lemma:
            mined.lemma = lemma
        if rank is not None and mined.rank is None:
            mined.rank = rank

    source = db.query(UserMinedWordSource).filter(
        UserMinedWordSource.mined_word_id == mined.id,
        UserMinedWordSource.video_id == video_id,
    ).first()
    if source is None:
        source = UserMinedWordSource(
            mined_word_id=mined.id,
            video_id=video_id,
            timestamp=timestamp,
            occurrence_count=video_occurrence_count,
        )
        db.add(source)
        mined.occurrence_count += video_occurrence_count
    else:
        # Re-processing the same video (e.g. re-ingested) replaces rather
        # than double-counts this source's contribution to the total.
        mined.occurrence_count += video_occurrence_count - source.occurrence_count
        source.occurrence_count = video_occurrence_count
        if timestamp is not None:
            source.timestamp = timestamp

    return is_new


def record_mined_words(
    user_id: int,
    video_id: str,
    words: List[Dict],
    language: str,
    db: Session
) -> int:
    """
    Record words that were mined from a video (e.g. when the user creates
    flashcards from mined words). Upserts into the user_mined_words /
    user_mined_word_sources source of truth.

    Returns: Number of new words recorded (never seen by this user before)
    """
    new_count = 0
    for word_data in words:
        word = word_data.get('word') if isinstance(word_data, dict) else word_data
        timestamp = word_data.get('mined_timestamp') if isinstance(word_data, dict) else None
        if _upsert_mined_word(db, user_id, video_id, word, language, timestamp=timestamp):
            new_count += 1

    db.commit()
    return new_count


def record_mined_words_from_transcript(
    db: Session,
    user_id: int,
    video_id: str,
    language: str,
    subtitles: List[Dict],
) -> int:
    """
    Called once, automatically, when a video's transcript finishes ingesting
    (see transcript_ingestion_service._finish_if_ready). Extracts and filters
    vocabulary from the complete transcript and writes it into the
    mined-word source of truth that Home/Flashcards/Mad Libs/History read
    from — this is what actually populates it; record_mined_words above is
    only ever reached by a currently-dead endpoint.

    Returns: Number of distinct words recorded for this video.
    """
    from app.services.korean_tokenizer import extract_korean_words_from_subtitles
    from app.services.ukrainian_tokenizer import extract_ukrainian_words_from_subtitles
    from app.services.vocab_service import filter_vocabulary
    # Lazy import: avoids the vocabulary router importing this module while
    # FastAPI constructs its router tree (same reason transcript_ingestion_
    # service does this for the same function).
    from app.api.routes.vocabulary import get_frequency_map

    language_key = "ukrainian" if language == "uk" else "korean"
    extract_fn = extract_ukrainian_words_from_subtitles if language == "uk" else extract_korean_words_from_subtitles

    words = extract_fn(subtitles)
    if not words:
        return 0

    frequency_map = get_frequency_map(language)
    filtered = filter_vocabulary(words, frequency_map, language=language)
    if not filtered:
        return 0

    word_list = [item['word'] for item in filtered]
    occurrences = count_word_occurrences(subtitles, word_list, language_key)

    count = 0
    for item in filtered:
        word = item['word']
        timestamps = get_word_timestamps(subtitles, word, language_key)
        _upsert_mined_word(
            db,
            user_id,
            video_id,
            word,
            language,
            rank=item.get('rank'),
            video_occurrence_count=occurrences.get(word, 1),
            timestamp=timestamps[0] if timestamps else None,
        )
        count += 1

    db.commit()
    return count


def get_user_mined_words(
    db: Session,
    user_id: int,
    language: str,
    video_id: Optional[str] = None,
    limit: Optional[int] = None,
) -> List[Dict]:
    """
    Read from the mined-word source of truth — the replacement for
    re-tokenizing tracked_videos.subtitles on every request. Returns one
    dict per word (shaped like the old live-extraction output: word, rank,
    occurrence_count, ...) with the video it's associated with — the most
    recently-updated source when video_id isn't given, since a word can come
    from more than one watched video.
    """
    query = (
        db.query(UserMinedWord, UserMinedWordSource)
        .join(UserMinedWordSource, UserMinedWordSource.mined_word_id == UserMinedWord.id)
        .filter(UserMinedWord.user_id == user_id, UserMinedWord.language == language)
    )
    if video_id:
        query = query.filter(UserMinedWordSource.video_id == video_id)

    by_word: Dict[str, Dict] = {}
    for mined, source in query.all():
        existing = by_word.get(mined.word)
        if existing is not None and existing['_source_updated_at'] >= source.updated_at:
            continue
        by_word[mined.word] = {
            'word': mined.word,
            'lemma': mined.lemma,
            'rank': mined.rank,
            'language': mined.language,
            'occurrence_count': source.occurrence_count if video_id else mined.occurrence_count,
            'video_id': source.video_id,
            'mined_timestamp': source.timestamp,
            '_source_updated_at': source.updated_at,
        }

    results = list(by_word.values())
    for item in results:
        item.pop('_source_updated_at', None)
    results.sort(key=lambda x: (x['rank'] is None, x['rank'] or 0))
    if limit:
        results = results[:limit]
    return results


def get_mining_stats(
    user_id: int,
    video_id: str,
    language: str,
    db: Session
) -> Dict:
    """Get mining statistics for a user/video combination."""
    mined_count = (
        db.query(UserMinedWordSource)
        .join(UserMinedWord, UserMinedWord.id == UserMinedWordSource.mined_word_id)
        .filter(
            UserMinedWord.user_id == user_id,
            UserMinedWord.language == language,
            UserMinedWordSource.video_id == video_id,
        )
        .count()
    )

    return {
        'video_id': video_id,
        'mined_count': mined_count,
        'language': language
    }
