from typing import List
from fastapi import APIRouter, HTTPException, Body
from app.api.routes.vocabulary import get_frequency_map
from app.api.routes.flashcards import strip_korean_particles

router = APIRouter()


@router.post("/lookup-words")
async def lookup_words(word_list: List[str] = Body(...)):
    """
    Look up frequency rank and difficulty for a list of Korean words.
    Tries particle stripping if exact match not found.
    """
    if not word_list:
        raise HTTPException(status_code=400, detail="word_list cannot be empty")

    frequency_map = get_frequency_map()
    results = []

    for word in word_list:
        rank = frequency_map.get(word)
        found_form = word

        if not rank:
            for form in strip_korean_particles(word):
                rank = frequency_map.get(form)
                if rank:
                    found_form = form
                    break

        if rank:
            results.append({
                'word': word,
                'rank': rank,
                'language': 'ko'
            })
        else:
            results.append({
                'word': word,
                'rank': 10001,
                'language': 'ko'
            })

    return {"words": results}
