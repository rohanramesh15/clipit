from typing import List
from fastapi import APIRouter, HTTPException, Body, Query
from app.api.routes.vocabulary import get_frequency_map
from app.api.routes.flashcards import strip_korean_particles, load_definitions
from app.services.deepl_service import translate

router = APIRouter()


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
