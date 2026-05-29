import React, { useState, useEffect } from 'react';
import { Search, Volume2, Loader2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { getCardStats } from '../services/fsrs';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { HelpOverlay, HelpTip } from '../components/HelpOverlay';
import { API_BASE_URL } from '../config';

const dictionaryPageTips: HelpTip[] = [
  {
    id: 'search',
    text: 'Search for any word in our frequency dictionary.',
    targetId: 'section-search',
    position: 'bottom',
  },
  {
    id: 'word-list',
    text: 'Words ranked by frequency. Progress bar shows your mastery level. Click speaker icon to hear pronunciation.',
    targetId: 'section-word-list',
    position: 'right',
  },
];


interface DictionaryEntry {
  word: string;
  english: string;
  rank: number;
  pos: 'noun' | 'verb' | 'adjective' | 'adverb';
  language: string;
  source?: 'user' | 'dictionary';
}

const POS_LABELS: Record<string, string> = {
  noun: 'Noun',
  verb: 'Verb',
  adjective: 'Adj',
  adverb: 'Adv',
};

// Calculate mastery percentage from FSRS stability (0-90 days = 0-100%)
function getMasteryPercent(word: string): number {
  const stats = getCardStats(word);
  if (!stats || stats.isNew) return 0;
  // Cap at 90 days stability = 100% mastery
  return Math.min(100, Math.round((stats.stability / 90) * 100));
}

// Play pronunciation using Web Speech API
function playAudio(word: string, lang: string) {
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = lang === 'uk' ? 'uk-UA' : lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-US' : 'ko-KR';
  utterance.rate = 0.9;

  // Try to find a voice for the language (preferably Google)
  const voices = window.speechSynthesis.getVoices();
  const langPrefix = lang === 'uk' ? 'uk' : lang === 'es' ? 'es' : lang === 'en' ? 'en' : 'ko';
  const targetVoice = voices.find(v => v.lang.startsWith(langPrefix) && v.name.includes('Google'))
    || voices.find(v => v.lang.startsWith(langPrefix));

  if (targetVoice) {
    utterance.voice = targetVoice;
  }

  window.speechSynthesis.speak(utterance);
}

export function DictionaryPage() {
  const { language, languageName } = useLanguage();
  const { token } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posFilter, setPosFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Preload speech synthesis voices
  useEffect(() => {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }, []);

  useEffect(() => {
    async function fetchDictionary() {
      try {
        setLoading(true);
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`${API_BASE_URL}/dictionary?lang=${language}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch dictionary');
        const data = await res.json();
        setEntries(data.entries);
        setError(null);
      } catch (err) {
        setError('Could not load dictionary');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchDictionary();
  }, [language, token]);

  // Filter entries by search term and part of speech
  const filteredEntries = entries.filter((entry) => {
    // Filter by part of speech
    if (posFilter && entry.pos !== posFilter) return false;

    // Filter by search term
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      entry.word.toLowerCase().includes(term) ||
      entry.english.toLowerCase().includes(term)
    );
  });

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, posFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredEntries.length);
  const paginatedEntries = filteredEntries.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-secondary">Loading dictionary...</p>
      </div>
    );
  }

  if (error || entries.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-3xl">
          {language === 'uk' ? '🇺🇦' : language === 'es' ? '🇪🇸' : language === 'en' ? '🇬🇧' : '🇰🇷'}
        </div>
        <p className="text-primary font-semibold">No words in your dictionary yet</p>
        <p className="text-secondary text-sm text-center max-w-sm">
          Watch a {languageName} video and start practicing to build your personal dictionary.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 max-w-5xl mx-auto px-4 pt-8">
      <HelpOverlay tips={dictionaryPageTips} />

      {/* Header & Search */}
      <div className="sticky top-0 bg-app/95 backdrop-blur-md z-10 pb-6 border-b border-white/5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-heading font-bold text-primary">
            {languageName} Dictionary
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">
              {filteredEntries.length > 0
                ? `Showing ${startIndex + 1}-${endIndex} of ${filteredEntries.length} words`
                : '0 words found'}
            </span>
          </div>
        </div>

        <div id="section-search" className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
            <input
              type="text"
              placeholder={`Search ${languageName} or English...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-xl pl-12 pr-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
            />
          </div>

          {language === 'ko' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
              <Filter className="w-5 h-5 text-secondary shrink-0" />
              {['noun', 'verb', 'adjective', 'adverb'].map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(posFilter === pos ? null : pos)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium border transition-all shrink-0
                    ${posFilter === pos
                      ? 'bg-accent text-app border-accent'
                      : 'bg-surface border-white/10 text-secondary hover:border-white/30'}
                  `}
                >
                  {POS_LABELS[pos]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Word List */}
      <div id="section-word-list" className="space-y-3">
        {paginatedEntries.map((entry, index) => (
          <motion.div
            key={entry.word}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.02, 0.5) }}
            className="group bg-surface hover:bg-surface-hover border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <button
                  onClick={() => playAudio(entry.word, language)}
                  className="mt-1 w-8 h-8 rounded-full bg-white/5 hover:bg-accent hover:text-app flex items-center justify-center transition-colors text-secondary"
                >
                  <Volume2 className="w-4 h-4" />
                </button>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-primary group-hover:text-accent transition-colors">
                      {entry.word}
                    </h3>
                    {entry.source === 'user' && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-accent/20 text-accent rounded-full">
                        My Word
                      </span>
                    )}
                  </div>
                  <p className="text-secondary mt-1">{entry.english}</p>
                </div>
              </div>

              {/* Mastery progress bar */}
              <div className="hidden md:block text-right min-w-[100px]">
                <div className="text-xs text-muted mb-1">
                  {getMasteryPercent(entry.word) === 0 ? 'New' : `${getMasteryPercent(entry.word)}%`}
                </div>
                <div className="w-24 h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${getMasteryPercent(entry.word)}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {paginatedEntries.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted text-lg">
              No words found matching "{searchTerm}"
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8 pb-8">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg bg-surface border border-white/10 text-secondary hover:bg-surface-hover hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1">
            {/* First page */}
            {currentPage > 3 && (
              <>
                <button
                  onClick={() => setCurrentPage(1)}
                  className="w-10 h-10 rounded-lg bg-surface border border-white/10 text-secondary hover:bg-surface-hover hover:text-primary transition-all"
                >
                  1
                </button>
                {currentPage > 4 && (
                  <span className="px-2 text-muted">...</span>
                )}
              </>
            )}

            {/* Page numbers around current */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => {
                if (totalPages <= 7) return true;
                if (page === 1 || page === totalPages) return false;
                return Math.abs(page - currentPage) <= 2;
              })
              .map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-10 h-10 rounded-lg border transition-all ${
                    currentPage === page
                      ? 'bg-accent text-app border-accent font-semibold'
                      : 'bg-surface border-white/10 text-secondary hover:bg-surface-hover hover:text-primary'
                  }`}
                >
                  {page}
                </button>
              ))}

            {/* Last page */}
            {currentPage < totalPages - 2 && totalPages > 7 && (
              <>
                {currentPage < totalPages - 3 && (
                  <span className="px-2 text-muted">...</span>
                )}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className="w-10 h-10 rounded-lg bg-surface border border-white/10 text-secondary hover:bg-surface-hover hover:text-primary transition-all"
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg bg-surface border border-white/10 text-secondary hover:bg-surface-hover hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
