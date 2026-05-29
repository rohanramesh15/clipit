"""
Spanish text tokenizer.

Detects Spanish (Latin-script) characters and extracts vocabulary words
from subtitle data, mirroring the interface of korean_tokenizer.py
and ukrainian_tokenizer.py.
"""

import re
from typing import List


def is_spanish_char(char: str) -> bool:
    """Return True if the character is a Latin letter used in Spanish.

    Covers basic ASCII A-Z/a-z plus the Latin-1 Supplement and Latin Extended-A
    blocks that contain Spanish-specific characters (á, é, í, ó, ú, ñ, ü, ¿, ¡).
    """
    if not char:
        return False
    code = ord(char)
    # Basic Latin letters
    if 0x0041 <= code <= 0x005A:  # A-Z
        return True
    if 0x0061 <= code <= 0x007A:  # a-z
        return True
    # Latin-1 Supplement (accented letters): À-ÿ
    if 0x00C0 <= code <= 0x00FF:
        return True
    return False


def extract_spanish_words(text: str) -> List[str]:
    """
    Split text into tokens and return only tokens that contain Spanish
    (Latin-script) characters. Strips punctuation and lowercases results.
    """
    if not text:
        return []

    tokens = text.split()
    words = []
    for token in tokens:
        # Strip punctuation but keep accented Latin letters
        clean = re.sub(r'[^\w\s]', '', token, flags=re.UNICODE).strip()
        if clean and any(is_spanish_char(c) for c in clean):
            words.append(clean.lower())
    return words


def extract_spanish_words_from_subtitles(subtitles: List[dict]) -> List[str]:
    """
    Extract unique Spanish words from a list of subtitle dicts.
    Expects each subtitle to have a 'spanish' key (or 'target' key as fallback).
    """
    seen = set()
    words = []
    for sub in subtitles:
        text = sub.get('spanish') or sub.get('target', '')
        if not text:
            continue
        for word in extract_spanish_words(text):
            if word not in seen:
                seen.add(word)
                words.append(word)
    return words
