import json
from pathlib import Path
from typing import List
from fastapi import APIRouter, HTTPException, Body
from app.services.subtitle_service import load_cached_subtitles
from app.services.vocab_service import load_frequency_map, get_difficulty
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


def find_sentence_for_word(word: str, subtitles: list) -> dict:
    for sub in subtitles:
        korean = sub.get('korean', '')
        if korean and word in korean:
            return {
                'sentence': korean,
                'translation': sub.get('english', 'No translation available'),
                'timestamp': int(sub.get('start', 0)),
            }
    return {'sentence': word, 'translation': 'No translation available', 'timestamp': 0}


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

        definition = definitions.get(dictionary_form, definitions.get(word, "definition not available"))

        flashcards.append({
            'target_word': word,
            'dictionary_form': dictionary_form,
            'english': definition,
            'sentence': sentence_data['sentence'],
            'sentence_translation': sentence_data['translation'],
            'timestamp': sentence_data['timestamp'],
            'video_id': video_id,
            'difficulty': get_difficulty(rank, 'ko'),
            'rank': rank,
            'language': 'ko'
        })

    return {
        'video_id': video_id,
        'word_source': word_source,
        'total_cards': len(flashcards),
        'flashcards': flashcards
    }
