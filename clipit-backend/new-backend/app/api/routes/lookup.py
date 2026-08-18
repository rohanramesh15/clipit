from typing import List, Optional
from fastapi import APIRouter, HTTPException, Body, Query
from app.api.routes.vocabulary import get_frequency_map
from app.api.routes.flashcards import strip_korean_particles, load_definitions
from app.services.deepl_service import translate

router = APIRouter()


def get_part_of_speech(korean: str, english: str) -> str:
    """Determine part of speech from Korean word pattern and English definition."""
    english_lower = english.lower()

    # Check for adjectives first (to be X patterns)
    if english_lower.startswith('to be ') or 'to be ' in english_lower:
        return 'adjective'

    # Check for verbs (to X patterns)
    if english_lower.startswith('to '):
        return 'verb'

    # Korean patterns - verbs/adjectives end in 다
    if korean.endswith('다'):
        return 'verb'

    # Common adverb endings
    if korean.endswith('히') or korean.endswith('게') or korean.endswith('로'):
        return 'adverb'

    # Default to noun
    return 'noun'


@router.get("/dictionary")
async def get_dictionary(
    search: Optional[str] = Query(None),
    pos: Optional[str] = Query(None),
    lang: str = Query('ko')
):
    """
    Get all dictionary entries with optional search and part of speech filter.
    Search matches words or English definitions.
    pos can be: noun, verb, adjective, adverb
    lang can be: 'ko' (Korean) or 'uk' (Ukrainian)
    """
    frequency_map = get_frequency_map(lang)
    deepl_source_lang = 'UK' if lang == 'uk' else 'KO'

    # For Korean, use the local definitions.json
    # For Ukrainian, generate definitions from frequency list using DeepL
    if lang == 'ko':
        definitions = load_definitions()
        entries = []
        for word, english in definitions.items():
            rank = frequency_map.get(word, 10001)
            part_of_speech = get_part_of_speech(word, english)
            entries.append({
                'word': word,
                'english': english,
                'rank': rank,
                'pos': part_of_speech,
                'language': lang,
            })
    else:
        # For Ukrainian, use the frequency list and translate top words
        entries = []
        sorted_words = sorted(frequency_map.items(), key=lambda x: x[1])[:500]  # Top 500 words
        for word, rank in sorted_words:
            english = translate(word, source_lang=deepl_source_lang) or "definition not available"
            entries.append({
                'word': word,
                'english': english,
                'rank': rank,
                'pos': 'noun',  # Default for Ukrainian (no morphology analysis yet)
                'language': lang,
            })

    # Sort by frequency rank (most common first)
    entries.sort(key=lambda x: x['rank'])

    # Filter by part of speech if provided (only effective for Korean)
    if pos and lang == 'ko':
        entries = [e for e in entries if e['pos'] == pos.lower()]

    # Filter by search term if provided
    if search:
        search_lower = search.lower()
        entries = [
            e for e in entries
            if search_lower in e['word'].lower() or search_lower in e['english'].lower()
        ]

    return {
        'total': len(entries),
        'entries': entries,
        'language': lang
    }


@router.post("/lookup-words")
async def lookup_words(word_list: List[str] = Body(...), lang: str = Query('ko')):
    """
    Look up frequency rank and definition for a list of words.
    lang: 'ko' (Korean) or 'uk' (Ukrainian). Defaults to 'ko'.
    """
    if not word_list:
        raise HTTPException(status_code=400, detail="word_list cannot be empty")

    frequency_map = get_frequency_map(lang)
    definitions = load_definitions()
    deepl_source_lang = 'UK' if lang == 'uk' else 'KO'
    results = []

    for word in word_list:
        rank = frequency_map.get(word)
        found_form = word

        if not rank and lang == 'ko':
            for form in strip_korean_particles(word):
                rank = frequency_map.get(form)
                if rank:
                    found_form = form
                    break

        definition = definitions.get(found_form) or definitions.get(word)
        if not definition:
            definition = (
                translate(found_form, source_lang=deepl_source_lang)
                or translate(word, source_lang=deepl_source_lang)
                or "definition not available"
            )

        results.append({
            'word': word,
            'dictionary_form': found_form,
            'definition': definition,
            'rank': rank or 10001,
            'language': lang,
        })

    return {"words": results}
