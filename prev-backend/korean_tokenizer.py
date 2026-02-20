"""
Korean Text Tokenizer - Extract Korean Words from Text
Simple space-based word extraction for Korean language learning.

Author: Claude
Date: 2026-02-06
"""

import re
from typing import List


def is_korean_char(char: str) -> bool:
    """
    Check if a character is Korean (Hangul).

    Korean Unicode ranges:
    - Hangul Syllables: U+AC00 to U+D7A3
    - Hangul Jamo: U+1100 to U+11FF
    - Hangul Compatibility Jamo: U+3130 to U+318F

    Args:
        char: Single character to check

    Returns:
        True if character is Korean
    """
    if not char:
        return False

    code = ord(char)

    # Check main Hangul syllables range
    if 0xAC00 <= code <= 0xD7A3:
        return True

    # Check Hangul Jamo
    if 0x1100 <= code <= 0x11FF:
        return True

    # Check Hangul Compatibility Jamo
    if 0x3130 <= code <= 0x318F:
        return True

    return False


def extract_korean_words(text: str) -> List[str]:
    """
    Extract Korean words from text using space-based splitting.

    This is a simple approach that:
    1. Splits text on whitespace
    2. Filters tokens to keep only those with Korean characters
    3. Removes duplicates
    4. Returns unique Korean words

    Note: This approach is simple and may include particles.
    For more advanced tokenization, consider using konlpy library.

    Args:
        text: Input text containing Korean

    Returns:
        List of unique Korean words
    """
    if not text:
        return []

    # Split on whitespace
    tokens = text.split()

    korean_words = []

    for token in tokens:
        # Remove punctuation and special characters
        cleaned = re.sub(r'[^\w\s]', '', token)

        if not cleaned:
            continue

        # Check if token contains Korean characters
        has_korean = any(is_korean_char(char) for char in cleaned)

        if has_korean:
            korean_words.append(cleaned)

    # Return unique words (preserving order)
    seen = set()
    unique_words = []
    for word in korean_words:
        if word not in seen:
            seen.add(word)
            unique_words.append(word)

    return unique_words


def extract_korean_words_from_subtitles(subtitles: List[dict]) -> List[str]:
    """
    Extract all Korean words from a list of subtitle objects.

    Args:
        subtitles: List of subtitle dicts with 'korean' field

    Returns:
        List of unique Korean words from all subtitles
    """
    all_words = []

    for subtitle in subtitles:
        korean_text = subtitle.get('korean')

        if korean_text:
            words = extract_korean_words(korean_text)
            all_words.extend(words)

    # Remove duplicates while preserving order
    seen = set()
    unique_words = []
    for word in all_words:
        if word not in seen:
            seen.add(word)
            unique_words.append(word)

    return unique_words


# Example usage
if __name__ == '__main__':
    test_texts = [
        "오늘은 제가 진짜 기대하던 주제예요",
        "학교에 가서 친구를 만났어요",
        "이 영화는 정말 재미있었어요",
        "Hello 안녕하세요 World",  # Mixed Korean/English
    ]

    print('🧪 Testing Korean Tokenizer...\n')

    for text in test_texts:
        words = extract_korean_words(text)
        print(f"Text: {text}")
        print(f"Words: {words}")
        print()

    # Test with subtitle format
    print('\n📝 Testing with subtitle format:')
    subtitles = [
        {'korean': '오늘은 날씨가 좋아요'},
        {'korean': '학교에서 공부했어요'},
        {'korean': None},  # No Korean text
        {'korean': '친구와 영화를 봤어요'}
    ]

    all_words = extract_korean_words_from_subtitles(subtitles)
    print(f"All words: {all_words}")
    print(f"Total unique words: {len(all_words)}")
