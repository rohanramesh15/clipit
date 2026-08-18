# Korean Word Frequency Lists

This directory contains Korean word frequency lists used for vocabulary extraction.

## Available Lists

### TOPIK Combined List (Recommended)
**File**: `korean_freq_topik.txt`
- **Source**: Combined NIKL/TOPIK vocabulary list from [julienshim/combined_korean_vocabulary_list](https://github.com/julienshim/combined_korean_vocabulary_list)
- **Words**: 5,897 entries with frequency ranks
- **Rank range**: 1 - 57,151
- **Format**: `word<tab>rank`
- **Usage**: Default for all processing

### TOPIK Level-Specific Lists

Based on official TOPIK (Test of Proficiency in Korean) difficulty levels:

**Level A (Beginner)** - `korean_freq_topik_a.txt`
- 960 words
- Basic everyday vocabulary
- Suitable for TOPIK I (levels 1-2)

**Level B (Intermediate)** - `korean_freq_topik_b.txt`
- 2,081 words
- Intermediate conversational vocabulary
- Suitable for TOPIK II (levels 3-4)

**Level C (Advanced)** - `korean_freq_topik_c.txt`
- 2,856 words
- Advanced academic/professional vocabulary
- Suitable for TOPIK II (levels 5-6)

## Data Sources

The vocabulary lists are derived from two authoritative Korean language sources:

1. **National Institute of Korean Language (NIKL)** - 국립국어원
   - Official Korean language research institute
   - 2003 vocabulary list

2. **TOPIK (Test of Proficiency in Korean)**
   - Official Korean language proficiency test
   - 2015 vocabulary list

## File Format

All files use tab-separated format:
```
word<tab>rank
```

Example:
```
것	1
하다	2
있다	3
```

Where:
- **word**: Korean word (Hangul)
- **rank**: Frequency rank (lower = more common)

## Usage with Batch Processor

### Default (all levels combined):
```bash
python src/batch_processor.py data/test_videos.txt --language ko --level intermediate
```

### Using custom difficulty levels:

Our system maps TOPIK levels to difficulty as follows:
- **Beginner**: ranks 1-1000 (mostly TOPIK A words)
- **Intermediate**: ranks 1001-3000 (mostly TOPIK B words)
- **Advanced**: ranks 3001-10000 (mostly TOPIK C words)

To use a specific TOPIK level file:
```bash
# Beginner (TOPIK Level A)
python src/batch_processor.py videos.txt --frequency-list data/frequency_lists/korean_freq_topik_a.txt --level beginner

# Intermediate (TOPIK Level B)
python src/batch_processor.py videos.txt --frequency-list data/frequency_lists/korean_freq_topik_b.txt --level intermediate

# Advanced (TOPIK Level C)
python src/batch_processor.py videos.txt --frequency-list data/frequency_lists/korean_freq_topik_c.txt --level advanced
```

## Converting New Word Lists

If you have a TOPIK-format TSV file, you can convert it using:

```bash
# Convert to unified format
python src/convert_topik_frequency.py input.tsv output.txt

# Split by TOPIK level (A, B, C)
python src/convert_topik_frequency.py input.tsv --by-level data/frequency_lists/
```

## Top 20 Most Common Words

From `korean_freq_topik.txt`:

| Rank | Word | Meaning |
|------|------|---------|
| 1 | 것 | thing |
| 2 | 하다 | to do |
| 3 | 있다 | to exist, have |
| 4 | 있다 | to be (located) |
| 5 | 되다 | to become |
| 6 | 수 | number, ability |
| 7 | 하다 | to do (verb suffix) |
| 8 | 나 | I, me |
| 9 | 그 | that, the |
| 10 | 없다 | to not exist |
| 11 | 않다 | to not do |
| 12 | 사람 | person |
| 13 | 우리 | we, us, our |
| 14 | 이 | this |
| 15 | 그 | that (determiner) |
| 16 | 아니다 | to not be |
| 17 | 보다 | to see, look |
| 18 | 등 | etc., and so on |
| 19 | 때 | time, when |
| 20 | 거 | thing (informal) |

## References

- [GitHub: julienshim/combined_korean_vocabulary_list](https://github.com/julienshim/combined_korean_vocabulary_list)
- [TOPIK Guide - 6000 Most Common Korean Words](https://www.topikguide.com/korean-frequency-list-top-6000-words/)
- [National Institute of Korean Language](https://www.korean.go.kr)

## License

The word frequency data is derived from public Korean language resources. Please refer to the original sources for licensing information.
