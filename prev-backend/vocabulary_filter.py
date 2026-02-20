"""
Vocabulary Filter - Korean Word Filtering for Language Learning
Filters Korean words based on frequency rank and difficulty level.

Author: Ported from vocabularyFilter.js
Date: 2026-02-06
"""

import os
from pathlib import Path
from typing import Dict, List, Optional

# Language-specific particle lists
LANGUAGE_PARTICLES = {
    'ko': ['이', '가', '을', '를', '에', '에서', '와', '과', '의', '로', '으로', '도', '만', '은', '는']
}

# Language-specific difficulty thresholds (exclusive ranges)
DIFFICULTY_THRESHOLDS = {
    'ko': {
        'beginner': {'min': 101, 'max': 1000},
        'intermediate': {'min': 1001, 'max': 3000},
        'advanced': {'min': 3001, 'max': 10000}
    }
}


def load_frequency_map(language: str = 'ko', custom_path: Optional[str] = None) -> Dict[str, int]:
    """
    Load frequency map from TSV file.

    Args:
        language: Language code (e.g., 'ko', 'es', 'ja')
        custom_path: Optional custom file path

    Returns:
        Dictionary mapping word -> frequency rank
    """
    default_paths = {
        'ko': 'frequency_lists/korean_freq_topik.txt'
    }

    file_path = custom_path or default_paths.get(language)
    if not file_path:
        raise ValueError(f"No frequency list available for language: {language}")

    # Get absolute path relative to this file
    base_dir = Path(__file__).parent
    full_path = base_dir / file_path

    frequency_map = {}

    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                parts = line.split('\t')
                if len(parts) >= 2:
                    word = parts[0].strip()
                    rank = int(parts[1].strip())
                    frequency_map[word] = rank

        print(f"✓ Loaded {len(frequency_map)} words for {language.upper()}")
        return frequency_map

    except FileNotFoundError:
        raise FileNotFoundError(f"Frequency file not found: {full_path}")
    except Exception as e:
        raise Exception(f"Error loading frequency map for {language}: {e}")


def get_difficulty(rank: int, language: str = 'ko') -> str:
    """
    Get difficulty level based on frequency rank.

    Args:
        rank: Frequency rank (lower = more common)
        language: Language code

    Returns:
        Difficulty level string
    """
    if rank <= 1000:
        return 'beginner'
    elif rank <= 3000:
        return 'intermediate'
    elif rank <= 10000:
        return 'advanced'
    else:
        return 'very_advanced'


def is_common_particle(word: str, rank: int, language: str = 'ko') -> bool:
    """
    Check if word is a common particle/grammar word that should be excluded.

    Args:
        word: Word to check
        rank: Frequency rank
        language: Language code

    Returns:
        True if word should be excluded
    """
    # Exclude top 100 most common words
    if rank <= 100:
        return True

    # Check language-specific particles
    particles = LANGUAGE_PARTICLES.get(language, [])
    return word in particles


def filter_vocabulary(
    words: List[str],
    frequency_map: Dict[str, int],
    user_level: str = 'intermediate',
    language: str = 'ko'
) -> List[Dict]:
    """
    Filter vocabulary words based on frequency and user level.

    Args:
        words: List of words to filter
        frequency_map: Dictionary mapping word -> rank
        user_level: User's proficiency level ('beginner', 'intermediate', 'advanced')
        language: Language code

    Returns:
        List of filtered vocabulary objects with metadata
    """
    # Get language-specific thresholds
    thresholds = DIFFICULTY_THRESHOLDS.get(language, DIFFICULTY_THRESHOLDS['ko'])
    level_threshold = thresholds.get(user_level, thresholds['intermediate'])
    min_rank = level_threshold['min']
    max_rank = level_threshold['max']

    # Remove duplicates
    unique_words = list(set(words))

    # Filter and map words
    filtered = []
    for word in unique_words:
        rank = frequency_map.get(word)

        # Skip if not in frequency map
        if rank is None:
            continue

        # Skip if outside rank range
        if rank < min_rank or rank > max_rank:
            continue

        # Skip common particles
        if is_common_particle(word, rank, language):
            continue

        filtered.append({
            'word': word,
            'rank': rank,
            'difficulty': get_difficulty(rank, language),
            'language': language
        })

    # Sort by rank (most common first)
    filtered.sort(key=lambda x: x['rank'])

    return filtered


def get_vocab_stats(filtered_vocab: List[Dict]) -> Dict:
    """
    Get statistics about filtered vocabulary.

    Args:
        filtered_vocab: List of filtered vocabulary objects

    Returns:
        Statistics dictionary
    """
    stats = {
        'total': len(filtered_vocab),
        'by_difficulty': {
            'beginner': 0,
            'intermediate': 0,
            'advanced': 0,
            'very_advanced': 0
        }
    }

    for item in filtered_vocab:
        difficulty = item['difficulty']
        stats['by_difficulty'][difficulty] += 1

    return stats


# Example usage
if __name__ == '__main__':
    sample_words = [
        '것', '하다', '있다', '학교', '친구', '컴퓨터',
        '영화', '음식', '여행', '이', '가', '은'
    ]

    print('🧪 Testing Vocabulary Filter...\n')

    frequency_map = load_frequency_map('ko')
    filtered = filter_vocabulary(sample_words, frequency_map, 'intermediate', 'ko')
    stats = get_vocab_stats(filtered)

    print('\n📊 Filtered Vocabulary:')
    for item in filtered:
        print(f"  {item['word']} - Rank: {item['rank']} - Difficulty: {item['difficulty']}")

    print('\n📈 Statistics:', stats)
