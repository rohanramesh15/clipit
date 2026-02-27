import json
from pathlib import Path
from typing import List
from fastapi import APIRouter, HTTPException, Body
from app.services.subtitle_service import load_cached_subtitles
from app.services.vocab_service import load_frequency_map
from app.services.deepl_service import translate
from app.api.routes.vocabulary import get_frequency_map

router = APIRouter()

# Definitions loaded once at first request
_DEFINITIONS: dict | None = None
_DATA_DIR = Path(__file__).parent.parent.parent.parent / 'data'


def load_definitions() -> dict:
    global _DEFINITIONS
    if _DEFINITIONS is None:
        defs_file = _DATA_DIR / 'definitions.json'
        if defs_file.exists():
            with open(defs_file, 'r', encoding='utf-8') as f:
                _DEFINITIONS = json.load(f)
        else:
            _DEFINITIONS = {}
    return _DEFINITIONS


def strip_korean_particles(word: str) -> List[str]:
    if not word:
        return []
    particles = [
        '으로', '로', '에서', '에게', '에',
        '이', '가', '을', '를', '은', '는',
        '과', '와', '의', '도', '만', '부터', '까지',
        '예요', '이에요', '여요', '이다', '입니다',
        '했다', '합니다', '해요',
        '던', '았', '었', '였', '고', '니', '지',
    ]
    possible_forms = [word]
    for particle in particles:
        if word.endswith(particle) and len(word) > len(particle):
            base = word[:-len(particle)]
            if base:
                possible_forms.append(base)
                if base.endswith('하'):
                    possible_forms.append(base + '다')
                if len(base) >= 2:
                    possible_forms.append(base + '다')
    return possible_forms


def get_verb_stem(word: str) -> str | None:
    """Extract verb stem from dictionary form (ends in 다)."""
    if word.endswith('다') and len(word) >= 2:
        return word[:-1]
    return None


def find_sentence_for_word(word: str, subtitles: list) -> dict:
    # Common Korean particles that can follow a noun
    particles = ['이', '가', '을', '를', '은', '는', '의', '에', '도', '만', '와', '과', '로', '으로', '에서', '에게', '부터', '까지', '요', '야', ' ', ',', '.', '?', '!']

    # Common verb endings for conjugated forms
    verb_endings = [
        '요', '어요', '아요', '여요',  # polite present
        '었어요', '았어요', '였어요',  # polite past
        '을게요', '을래요', '을까요',  # future/intention
        '고', '서', '면', '니까', '지만',  # connective
        '는', '은', '을', '던',  # modifiers
        '습니다', '습니까', '세요', '셨어요',  # formal
        '어', '아', '여', '지', '네', '군', '냐',  # casual
        '었어', '았어', '였어',  # casual past
    ]

    # First pass: exact word match (followed by particle/punctuation/space/end)
    for sub in subtitles:
        korean = sub.get('korean', '')
        if not korean or word not in korean:
            continue

        idx = korean.find(word)
        while idx != -1:
            end_idx = idx + len(word)
            if end_idx == len(korean) or any(korean[end_idx:].startswith(p) for p in particles):
                if idx == 0 or korean[idx-1] == ' ':
                    start = sub.get('start', 0)
                    end = sub.get('end', start + 5)
                    return {
                        'sentence': korean,
                        'translation': sub.get('english', 'No translation available'),
                        'timestamp': int(start),
                        'end_timestamp': int(end) + 1,
                        'matched_form': word,
                    }
            idx = korean.find(word, end_idx)

    # Second pass: if word is a verb (ends in 다), search for conjugated forms
    stem = get_verb_stem(word)
    if stem:
        for sub in subtitles:
            korean = sub.get('korean', '')
            if not korean or stem not in korean:
                continue

            idx = korean.find(stem)
            while idx != -1:
                # Check if stem is followed by a verb ending
                after_stem = korean[idx + len(stem):]
                matched_ending = None
                for ending in verb_endings:
                    if after_stem.startswith(ending):
                        matched_ending = ending
                        break

                if matched_ending:
                    # Make sure it's not part of a compound (check char before)
                    if idx == 0 or korean[idx-1] == ' ':
                        start = sub.get('start', 0)
                        end = sub.get('end', start + 5)
                        return {
                            'sentence': korean,
                            'translation': sub.get('english', 'No translation available'),
                            'timestamp': int(start),
                            'end_timestamp': int(end) + 1,
                            'matched_form': stem + matched_ending,
                        }
                idx = korean.find(stem, idx + 1)

    # Third pass: fall back to any substring match
    for sub in subtitles:
        korean = sub.get('korean', '')
        if korean and word in korean:
            start = sub.get('start', 0)
            end = sub.get('end', start + 5)
            return {
                'sentence': korean,
                'translation': sub.get('english', 'No translation available'),
                'timestamp': int(start),
                'end_timestamp': int(end) + 1,
                'matched_form': word,
            }

    return {'sentence': word, 'translation': 'No translation available', 'timestamp': 0, 'end_timestamp': 5, 'matched_form': word}


@router.post("/flashcard-data")
async def get_flashcard_data(request: dict = Body(...)):
    """
    Generate flashcard data for a list of Korean words from a video.
    Body: { video_id, words: [...], word_source: "essential"|"selected" }
    """
    video_id = request.get('video_id')
    words = request.get('words', [])
    word_source = request.get('word_source', 'essential')

    if not video_id or not words:
        raise HTTPException(status_code=400, detail="video_id and words are required")

    subtitle_data = load_cached_subtitles(video_id)
    if not subtitle_data:
        raise HTTPException(status_code=404, detail=f"Subtitles not found for {video_id}")

    subtitles = subtitle_data['subtitles']
    frequency_map = get_frequency_map()
    definitions = load_definitions()

    flashcards = []
    for word in words:
        sentence_data = find_sentence_for_word(word, subtitles)

        possible_forms = strip_korean_particles(word)
        dictionary_form = word
        rank = frequency_map.get(word)

        if not rank:
            for form in possible_forms:
                rank = frequency_map.get(form)
                if rank:
                    dictionary_form = form
                    break

        if not rank:
            dictionary_form = possible_forms[-1] if possible_forms else word
            rank = 10001

        # definitions.json first, DeepL as fallback
        definition = definitions.get(dictionary_form) or definitions.get(word)
        if not definition:
            definition = translate(dictionary_form) or translate(word) or "definition not available"

        # Use DeepL for sentence translation when no English subtitle is available
        sentence_translation = sentence_data['translation']
        if (not sentence_translation or sentence_translation == 'No translation available') and sentence_data['sentence']:
            sentence_translation = translate(sentence_data['sentence']) or 'No translation available'

        flashcards.append({
            'target_word': word,
            'dictionary_form': dictionary_form,
            'english': definition,
            'sentence': sentence_data['sentence'],
            'sentence_translation': sentence_translation,
            'timestamp': sentence_data['timestamp'],
            'end_timestamp': sentence_data['end_timestamp'],
            'video_id': video_id,
            'rank': rank,
            'language': 'ko'
        })

    return {
        'video_id': video_id,
        'word_source': word_source,
        'total_cards': len(flashcards),
        'flashcards': flashcards
    }
