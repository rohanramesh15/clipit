"""Shared helpers for attaching English translations to word lists.

Prefers the locally cached definition lookups (populated by prior
translations across the app) and falls back to bounded-concurrency live
DeepL lookups for cache misses.
"""

import asyncio
from typing import Optional

_UNUSABLE_TRANSLATIONS = {
    "#",
    "definition available in practice",
    "definition not available",
    "translation unavailable",
}

_SOURCE_LANGUAGE = {"ko": "KO", "uk": "UK", "en": "EN"}


def usable_translation(value: object) -> Optional[str]:
    """Return a display-ready English translation, rejecting old placeholders."""
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    if not cleaned or cleaned.lower() in _UNUSABLE_TRANSLATIONS:
        return None
    return cleaned


def saved_translation(word: str, language: str, definitions: dict, user_definitions: dict) -> Optional[str]:
    return usable_translation(
        user_definitions.get(f"{language}:{word}")
        or definitions.get(word)
    )


async def fill_translations(
    items: list[dict],
    language: str,
    *,
    key: str = "english",
    word_key: str = "target_word",
    concurrency: int = 4,
) -> None:
    """Fill each item's missing `key` translation with a bounded, cached lookup.

    The translation service persists successful word lookups in its local
    cache, so a word normally pays this cost once.
    """
    from app.services.deepl_service import translate

    source_language = _SOURCE_LANGUAGE.get(language, "KO")
    semaphore = asyncio.Semaphore(concurrency)

    async def fill(item: dict) -> None:
        if usable_translation(item.get(key)):
            return
        word = (item.get(word_key) or "").strip()
        if not word:
            item[key] = "Translation unavailable"
            return
        async with semaphore:
            translated = await asyncio.to_thread(translate, word, source_lang=source_language)
        item[key] = usable_translation(translated) or "Translation unavailable"

    await asyncio.gather(*(fill(item) for item in items))
