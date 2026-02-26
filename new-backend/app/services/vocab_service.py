from pathlib import Path
from typing import Dict, List, Optional

LANGUAGE_PARTICLES = {
    'ko': ['이', '가', '을', '를', '에', '에서', '와', '과', '의', '로', '으로', '도', '만', '은', '는']
}

DIFFICULTY_THRESHOLDS = {
    'ko': {
        'beginner':     {'min': 101,  'max': 1000},
        'intermediate': {'min': 1001, 'max': 3000},
        'advanced':     {'min': 3001, 'max': 10000}
    }
}

# Path relative to the new-backend root (where main.py lives)
_DATA_DIR = Path(__file__).parent.parent.parent / 'data'


def load_frequency_map(language: str = 'ko', custom_path: Optional[str] = None) -> Dict[str, int]:
    default_paths = {
        'ko': _DATA_DIR / 'frequency_lists' / 'korean_freq_topik.txt'
    }
    full_path = Path(custom_path) if custom_path else default_paths.get(language)
    if not full_path:
        raise ValueError(f"No frequency list for language: {language}")

    frequency_map: Dict[str, int] = {}
    with open(full_path, 'r', encoding='utf-8') as f:
        for line in f:
            parts = line.strip().split('\t')
            if len(parts) >= 2:
                word, rank = parts[0].strip(), parts[1].strip()
                if word and rank:
                    frequency_map[word] = int(rank)
    return frequency_map


def get_difficulty(rank: int, language: str = 'ko') -> str:
    if rank <= 1000:
        return 'beginner'
    elif rank <= 3000:
        return 'intermediate'
    elif rank <= 10000:
        return 'advanced'
    return 'very_advanced'


def is_common_particle(word: str, rank: int, language: str = 'ko') -> bool:
    if rank <= 100:
        return True
    return word in LANGUAGE_PARTICLES.get(language, [])


def filter_vocabulary(
    words: List[str],
    frequency_map: Dict[str, int],
    user_level: str = 'intermediate',
    language: str = 'ko'
) -> List[Dict]:
    thresholds = DIFFICULTY_THRESHOLDS.get(language, DIFFICULTY_THRESHOLDS['ko'])
    level = thresholds.get(user_level, thresholds['intermediate'])
    min_rank, max_rank = level['min'], level['max']

    filtered = []
    for word in set(words):
        rank = frequency_map.get(word)
        if rank is None:
            continue
        if rank < min_rank or rank > max_rank:
            continue
        if is_common_particle(word, rank, language):
            continue
        filtered.append({
            'word': word,
            'rank': rank,
            'difficulty': get_difficulty(rank, language),
            'language': language
        })

    filtered.sort(key=lambda x: x['rank'])
    return filtered


def get_vocab_stats(filtered_vocab: List[Dict]) -> Dict:
    stats: Dict = {
        'total': len(filtered_vocab),
        'by_difficulty': {'beginner': 0, 'intermediate': 0, 'advanced': 0, 'very_advanced': 0}
    }
    for item in filtered_vocab:
        stats['by_difficulty'][item['difficulty']] += 1
    return stats
