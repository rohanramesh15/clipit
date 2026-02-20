/**
 * Vocabulary Filter - Common Words Algorithm
 * Supports multiple languages with frequency-based filtering
 * 
 * @author Julian
 * @date 2026-02-03
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Language-specific particle lists
const LANGUAGE_PARTICLES = {
  ko: ['이', '가', '을', '를', '에', '에서', '와', '과', '의', '로', '으로', '도', '만', '은', '는'],
  // Future: add other languages
  // es: ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'a', 'en'],
  // ja: ['は', 'が', 'を', 'に', 'で', 'と', 'の', 'や'],
};

// Language-specific difficulty thresholds
const DIFFICULTY_THRESHOLDS = {
  ko: {
    beginner: { min: 101, max: 1000 },
    intermediate: { min: 101, max: 3000 },
    advanced: { min: 101, max: 10000 }
  },
  // Future: adjust thresholds per language
};

/**
 * Load frequency map from file
 * @param {string} language - Language code (e.g., 'ko', 'es', 'ja')
 * @param {string} customPath - Optional custom file path
 * @returns {Map<string, number>} Map of word -> frequency rank
 */
export function loadFrequencyMap(language = 'ko', customPath = null) {
  const defaultPaths = {
    ko: '../../data/frequency_lists/korean_freq_topik.txt',
    // Future: add other languages
    // es: '../../data/frequency_lists/spanish_freq.txt',
    // ja: '../../data/frequency_lists/japanese_freq.txt',
  };
  
  const filePath = customPath || defaultPaths[language];
  if (!filePath) {
    throw new Error(`No frequency list available for language: ${language}`);
  }
  
  const frequencyMap = new Map();
  
  try {
    const fullPath = path.resolve(__dirname, filePath);
    const data = fs.readFileSync(fullPath, 'utf-8');
    const lines = data.split('\n');
    
    lines.forEach(line => {
      const [word, rank] = line.split('\t');
      if (word && rank) {
        frequencyMap.set(word.trim(), parseInt(rank.trim(), 10));
      }
    });
    
    console.log(`✓ Loaded ${frequencyMap.size} words for ${language.toUpperCase()}`);
    return frequencyMap;
  } catch (error) {
    console.error(`Error loading frequency map for ${language}:`, error);
    throw error;
  }
}

/**
 * Get difficulty level based on frequency rank
 * @param {number} rank - Frequency rank
 * @param {string} language - Language code
 * @returns {string} Difficulty level
 */
function getDifficulty(rank, language = 'ko') {
  // Use language-specific thresholds, fallback to Korean
  const thresholds = DIFFICULTY_THRESHOLDS[language] || DIFFICULTY_THRESHOLDS.ko;
  
  if (rank <= 1000) return 'beginner';
  if (rank <= 3000) return 'intermediate';
  if (rank <= 10000) return 'advanced';
  return 'very_advanced';
}

/**
 * Check if word is a common particle/grammar word
 * @param {string} word - Word to check
 * @param {number} rank - Frequency rank
 * @param {string} language - Language code
 * @returns {boolean} True if word should be excluded
 */
function isCommonParticle(word, rank, language = 'ko') {
  // Exclude top 100 most common words
  if (rank <= 100) return true;
  
  // Check language-specific particles
  const particles = LANGUAGE_PARTICLES[language] || [];
  return particles.includes(word);
}

/**
 * Filter vocabulary words based on frequency and user level
 * @param {string[]} words - Array of words to filter
 * @param {Map<string, number>} frequencyMap - Frequency map
 * @param {string} userLevel - User's proficiency level
 * @param {string} language - Language code
 * @returns {Object[]} Filtered vocabulary with metadata
 */
export function filterVocabulary(words, frequencyMap, userLevel = 'intermediate', language = 'ko') {
  // Get language-specific thresholds
  const thresholds = DIFFICULTY_THRESHOLDS[language] || DIFFICULTY_THRESHOLDS.ko;
  const { min, max } = thresholds[userLevel] || thresholds.intermediate;
  
  // Remove duplicates
  const uniqueWords = [...new Set(words)];
  
  // Filter and map words
  const filtered = uniqueWords
    .map(word => {
      const rank = frequencyMap.get(word);
      
      if (!rank) return null;
      if (rank < min || rank > max) return null;
      if (isCommonParticle(word, rank, language)) return null;
      
      return {
        word,
        rank,
        difficulty: getDifficulty(rank, language),
        language,
        isInUserLevel: rank <= thresholds[userLevel].max
      };
    })
    .filter(item => item !== null)
    .sort((a, b) => a.rank - b.rank);
  
  return filtered;
}

/**
 * Get statistics about filtered vocabulary
 * @param {Object[]} filteredVocab - Filtered vocabulary array
 * @returns {Object} Statistics object
 */
export function getVocabStats(filteredVocab) {
  const stats = {
    total: filteredVocab.length,
    byDifficulty: {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
      very_advanced: 0
    }
  };
  
  filteredVocab.forEach(item => {
    stats.byDifficulty[item.difficulty]++;
  });
  
  return stats;
}

// Example usage
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sampleWords = [
    '것', '하다', '있다', '학교', '친구', '컴퓨터', 
    '영화', '음식', '여행', '이', '가', '은'
  ];
  
  console.log('🧪 Testing Vocabulary Filter...\n');
  
  const frequencyMap = loadFrequencyMap('ko');
  const filtered = filterVocabulary(sampleWords, frequencyMap, 'intermediate', 'ko');
  const stats = getVocabStats(filtered);
  
  console.log('\n📊 Filtered Vocabulary:');
  filtered.forEach(item => {
    console.log(`  ${item.word} - Rank: ${item.rank} - Difficulty: ${item.difficulty}`);
  });
  
  console.log('\n📈 Statistics:', stats);
}