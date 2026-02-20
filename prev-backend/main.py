from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from youtube_transcript_api import YouTubeTranscriptApi
import json
from pathlib import Path
from typing import List
from vocabulary_filter import load_frequency_map, filter_vocabulary, get_vocab_stats, get_difficulty
from korean_tokenizer import extract_korean_words_from_subtitles

app = FastAPI()

# CORS - allow requests from anywhere
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def merge_subtitles_by_timestamp(english_subs, korean_subs):
    """
    Merge English and Korean subtitles by matching timestamps.
    Returns a list of subtitle objects with both languages.
    """
    merged = []

    # Create a map of Korean subtitles by start time for quick lookup
    korean_map = {sub['start']: sub for sub in korean_subs}

    # Process each English subtitle
    for eng_sub in english_subs:
        eng_start = eng_sub['start']
        eng_end = eng_start + eng_sub['duration']

        # Try to find matching Korean subtitle
        # Look for Korean subs that overlap with this English sub
        matching_korean = None
        for kor_sub in korean_subs:
            kor_start = kor_sub['start']
            kor_end = kor_start + kor_sub['duration']

            # Check if they overlap (within 1 second tolerance)
            if abs(eng_start - kor_start) < 1.0:
                matching_korean = kor_sub
                break

        merged.append({
            'start': eng_start,
            'duration': eng_sub['duration'],
            'end': eng_end,
            'english': eng_sub['text'],
            'korean': matching_korean['text'] if matching_korean else None
        })

    return merged

@app.get("/subtitles/{video_id}")
async def get_subtitles(video_id: str, lang: str = "en"):
    """
    Fetch subtitles for a video in both English and Korean.
    Creates a JSON file with merged subtitles (only once - uses cache if exists).
    """
    try:
        output_file = Path(f'subtitles_{video_id}.json')

        # Check if JSON already exists (cached)
        if output_file.exists():
            print(f"\n{'='*60}")
            print(f"✓ Using CACHED subtitles for: {video_id}")
            print(f"✓ File: {output_file.absolute()}")
            print(f"{'='*60}\n")

            # Load from cache
            with open(output_file, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)

            # Return both English and Korean subtitles for frontend
            return {
                "video_id": video_id,
                "subtitles": [
                    {
                        'start': sub['start'],
                        'duration': sub['duration'],
                        'english': sub['english'],
                        'korean': sub.get('korean')  # May be None if no Korean available
                    }
                    for sub in cached_data['subtitles']
                ]
            }

        # If not cached, fetch new subtitles
        api = YouTubeTranscriptApi()

        print(f"\n{'='*60}")
        print(f"Fetching NEW subtitles for video: {video_id}")
        print(f"{'='*60}\n")

        # Fetch English subtitles
        english_result = api.fetch(video_id, languages=['en'])
        english_subs = [
            {
                'text': snippet.text,
                'start': snippet.start,
                'duration': snippet.duration
            }
            for snippet in english_result.snippets
        ]
        print(f"✓ Fetched {len(english_subs)} English subtitles")

        # Try to fetch Korean subtitles
        korean_subs = []
        try:
            korean_result = api.fetch(video_id, languages=['ko'])
            korean_subs = [
                {
                    'text': snippet.text,
                    'start': snippet.start,
                    'duration': snippet.duration
                }
                for snippet in korean_result.snippets
            ]
            print(f"✓ Fetched {len(korean_subs)} Korean subtitles")
        except Exception as e:
            print(f"⚠ Korean subtitles not available: {str(e)}")

        # Merge subtitles by timestamp
        if korean_subs:
            merged_subtitles = merge_subtitles_by_timestamp(english_subs, korean_subs)
            print(f"✓ Merged subtitles by timestamp")
        else:
            # If no Korean, just use English with null Korean
            merged_subtitles = [
                {
                    'start': sub['start'],
                    'duration': sub['duration'],
                    'end': sub['start'] + sub['duration'],
                    'english': sub['text'],
                    'korean': None
                }
                for sub in english_subs
            ]

        # Create output JSON
        output_data = {
            'video_id': video_id,
            'total_subtitles': len(merged_subtitles),
            'has_korean': len(korean_subs) > 0,
            'subtitles': merged_subtitles
        }

        # Save to JSON file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)

        print(f"\n✓ Saved to: {output_file.absolute()}")

        # Print first few entries to terminal
        print(f"\n{'='*60}")
        print("SUBTITLE PREVIEW (first 3 entries):")
        print(f"{'='*60}\n")

        for i, sub in enumerate(merged_subtitles[:3], 1):
            print(f"[{i}] Time: {sub['start']:.2f}s - {sub['end']:.2f}s")
            print(f"    EN: {sub['english']}")
            if sub['korean']:
                print(f"    KO: {sub['korean']}")
            print()

        print(f"{'='*60}")
        print(f"✓ JSON saved! Future requests will use cached version.")
        print(f"{'='*60}\n")

        # Return both English and Korean subtitles to frontend
        return {
            "video_id": video_id,
            "subtitles": [
                {
                    'start': sub['start'],
                    'duration': sub['duration'],
                    'english': sub['english'],
                    'korean': sub.get('korean')  # May be None if no Korean available
                }
                for sub in merged_subtitles
            ]
        }

    except Exception as e:
        print(f"\n✗ Error: {str(e)}\n")
        raise HTTPException(
            status_code=404,
            detail=f"Could not fetch subtitles: {str(e)}"
        )


# Load frequency map once at startup (cache in memory)
FREQUENCY_MAP = None

def get_frequency_map():
    """Get cached frequency map, loading if needed"""
    global FREQUENCY_MAP
    if FREQUENCY_MAP is None:
        FREQUENCY_MAP = load_frequency_map('ko')
    return FREQUENCY_MAP


@app.get("/vocabulary/{video_id}")
async def get_vocabulary(
    video_id: str,
    level: str = "intermediate",
    limit: int = 20
):
    """
    Extract and filter Korean vocabulary from video subtitles.

    Args:
        video_id: YouTube video ID
        level: User proficiency level (beginner/intermediate/advanced)
        limit: Maximum number of words to return

    Returns:
        Filtered vocabulary list with metadata
    """
    try:
        # Load cached subtitles
        subtitle_file = Path(f'subtitles_{video_id}.json')

        if not subtitle_file.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Subtitles not found for video: {video_id}. Please load the video first."
            )

        print(f"\n{'='*60}")
        print(f"Extracting vocabulary for: {video_id}")
        print(f"User level: {level}")
        print(f"{'='*60}\n")

        # Load subtitle data
        with open(subtitle_file, 'r', encoding='utf-8') as f:
            subtitle_data = json.load(f)

        subtitles = subtitle_data['subtitles']
        has_korean = subtitle_data.get('has_korean', False)

        if not has_korean:
            print("⚠ No Korean subtitles available")
            return {
                "video_id": video_id,
                "user_level": level,
                "total_words": 0,
                "vocabulary": [],
                "stats": {
                    "total": 0,
                    "by_difficulty": {
                        "beginner": 0,
                        "intermediate": 0,
                        "advanced": 0,
                        "very_advanced": 0
                    }
                }
            }

        # Extract Korean words from subtitles
        korean_words = extract_korean_words_from_subtitles(subtitles)
        print(f"✓ Extracted {len(korean_words)} unique Korean words")

        # Load frequency map
        frequency_map = get_frequency_map()

        # Filter vocabulary by user level
        filtered_vocab = filter_vocabulary(
            korean_words,
            frequency_map,
            user_level=level,
            language='ko'
        )
        print(f"✓ Filtered to {len(filtered_vocab)} words for {level} level")

        # Limit to top N words
        limited_vocab = filtered_vocab[:limit]

        # Get statistics
        stats = get_vocab_stats(limited_vocab)

        # Print preview
        print(f"\n{'='*60}")
        print(f"VOCABULARY PREVIEW (first 5 words):")
        print(f"{'='*60}\n")

        for i, word in enumerate(limited_vocab[:5], 1):
            print(f"[{i}] {word['word']} - Rank: {word['rank']} - {word['difficulty']}")

        print(f"\n{'='*60}")
        print(f"✓ Returning {len(limited_vocab)} vocabulary words")
        print(f"{'='*60}\n")

        return {
            "video_id": video_id,
            "user_level": level,
            "total_words": len(limited_vocab),
            "vocabulary": limited_vocab,
            "stats": stats
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"\n✗ Error extracting vocabulary: {str(e)}\n")
        raise HTTPException(
            status_code=500,
            detail=f"Error extracting vocabulary: {str(e)}"
        )


def strip_korean_particles(word: str) -> List[str]:
    """
    Strip common Korean particles and endings to get base word forms.
    Returns a list of possible base forms to try.
    """
    if not word:
        return []

    # Common Korean particles and endings to strip
    particles = [
        '으로', '로',  # directional particles
        '에서', '에게', '에',  # location/target particles
        '이', '가',  # subject particles
        '을', '를',  # object particles
        '은', '는',  # topic particles
        '과', '와',  # and/with particles
        '의',  # possessive particle
        '도',  # also particle
        '만',  # only particle
        '부터', '까지',  # from/to particles
        '예요', '이에요', '여요',  # copula endings
        '이다', '입니다',  # copula endings
        '했다', '합니다', '해요',  # verb endings
        '던', '았', '었', '였',  # past/adjective endings
        '고', '니', '지',  # connective endings
    ]

    possible_forms = [word]  # Start with original word

    # Try stripping each particle/ending
    for particle in particles:
        if word.endswith(particle) and len(word) > len(particle):
            base = word[:-len(particle)]
            if base:
                possible_forms.append(base)

                # For verb stems ending in 하, add 하다 form
                if base.endswith('하'):
                    possible_forms.append(base + '다')

                # For other verb stems, also try adding 다
                if len(base) >= 2:
                    possible_forms.append(base + '다')

    return possible_forms


@app.post("/lookup-words")
async def lookup_words(word_list: List[str] = Body(...)):
    """
    Look up frequency rank and difficulty for a list of words.

    Args:
        word_list: List of Korean words to look up

    Returns:
        List of word metadata (word, rank, difficulty)
    """
    try:
        # Load frequency map
        frequency_map = get_frequency_map()

        print(f"\n{'='*60}")
        print(f"Looking up {len(word_list)} words")
        print(f"Words: {word_list}")
        print(f"{'='*60}\n")

        results = []
        for word in word_list:
            # Try exact match first
            rank = frequency_map.get(word)
            found_form = word

            # If not found, try stripping particles
            if not rank:
                possible_forms = strip_korean_particles(word)
                print(f"  Trying forms for '{word}': {possible_forms}")

                for form in possible_forms:
                    rank = frequency_map.get(form)
                    if rank:
                        found_form = form
                        break

            if rank:
                results.append({
                    'word': word,  # Keep original word for display
                    'rank': rank,
                    'difficulty': get_difficulty(rank, 'ko'),
                    'language': 'ko'
                })
                print(f"✓ Found: {word} (as '{found_form}') - Rank: {rank} - Difficulty: {get_difficulty(rank, 'ko')}")
            else:
                # Word not in frequency list - mark as very_advanced
                results.append({
                    'word': word,
                    'rank': 10001,  # Outside known range
                    'difficulty': 'very_advanced',
                    'language': 'ko'
                })
                print(f"⚠ Not found: {word} - Marked as very_advanced")

        print(f"\n{'='*60}")
        print(f"✓ Returning {len(results)} word metadata")
        print(f"{'='*60}\n")

        return {"words": results}

    except Exception as e:
        print(f"\n✗ Error looking up words: {str(e)}\n")
        raise HTTPException(
            status_code=500,
            detail=f"Error looking up words: {str(e)}"
        )


# Load definitions dictionary once at startup
DEFINITIONS = None

def load_definitions():
    """Load Korean word definitions from JSON file"""
    global DEFINITIONS
    if DEFINITIONS is None:
        definitions_file = Path('definitions.json')

        if not definitions_file.exists():
            print("⚠ definitions.json not found, using empty definitions")
            DEFINITIONS = {}
        else:
            with open(definitions_file, 'r', encoding='utf-8') as f:
                DEFINITIONS = json.load(f)
            print(f"✓ Loaded {len(DEFINITIONS)} word definitions")

    return DEFINITIONS


def find_sentence_for_word(word: str, subtitles: List[dict]) -> dict:
    """
    Find first subtitle containing the target word.
    Returns sentence and translation.
    """
    for sub in subtitles:
        korean = sub.get('korean', '')
        if korean and word in korean:
            return {
                'sentence': korean,
                'translation': sub.get('english', 'No translation available')
            }

    # Fallback if word not found in subtitles
    return {
        'sentence': word,
        'translation': 'No translation available'
    }


@app.post("/flashcard-data")
async def get_flashcard_data(request: dict = Body(...)):
    """
    Generate flashcard data with sentences and translations.

    Args:
        video_id: YouTube video ID
        words: List of Korean words to create flashcards for
        word_source: 'essential' or 'selected'

    Returns:
        Flashcard data with sentences, translations, and metadata
    """
    try:
        video_id = request.get('video_id')
        words = request.get('words', [])
        word_source = request.get('word_source', 'essential')

        if not video_id or not words:
            raise HTTPException(
                status_code=400,
                detail="video_id and words are required"
            )

        # Load cached subtitles
        subtitle_file = Path(f'subtitles_{video_id}.json')
        if not subtitle_file.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Subtitles not found for video: {video_id}"
            )

        print(f"\n{'='*60}")
        print(f"Generating flashcard data for {len(words)} words")
        print(f"Video: {video_id}, Source: {word_source}")
        print(f"{'='*60}\n")

        with open(subtitle_file, 'r', encoding='utf-8') as f:
            subtitle_data = json.load(f)

        subtitles = subtitle_data['subtitles']
        frequency_map = get_frequency_map()
        definitions = load_definitions()

        flashcards = []
        for word in words:
            # Find sentence containing word
            sentence_data = find_sentence_for_word(word, subtitles)

            # Get dictionary form
            possible_forms = strip_korean_particles(word)
            dictionary_form = word  # Default to original word

            # Look up in frequency map to find actual base form
            rank = frequency_map.get(word)
            if not rank:
                for form in possible_forms:
                    rank = frequency_map.get(form)
                    if rank:
                        dictionary_form = form
                        break

            # If still no rank, use last possible form as dictionary form
            if not rank and possible_forms:
                dictionary_form = possible_forms[-1] if possible_forms else word
                rank = 10001
            elif not rank:
                rank = 10001

            # Get definition (try dictionary form first, then original word)
            definition = definitions.get(dictionary_form,
                                       definitions.get(word,
                                       "definition not available"))

            flashcard = {
                'target_word': word,
                'dictionary_form': dictionary_form,
                'english': definition,
                'sentence': sentence_data['sentence'],
                'sentence_translation': sentence_data['translation'],
                'difficulty': get_difficulty(rank, 'ko'),
                'rank': rank,
                'language': 'ko'
            }

            flashcards.append(flashcard)
            print(f"✓ Created flashcard: {word} -> {dictionary_form} ({definition[:30]}...)")

        print(f"\n{'='*60}")
        print(f"✓ Returning {len(flashcards)} flashcards")
        print(f"{'='*60}\n")

        return {
            'video_id': video_id,
            'word_source': word_source,
            'total_cards': len(flashcards),
            'flashcards': flashcards
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"\n✗ Error generating flashcard data: {str(e)}\n")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error generating flashcard data: {str(e)}"
        )
