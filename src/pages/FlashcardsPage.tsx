import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCw,
  Check,
  X,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Tv,
  ChevronDown,
  Layers,
  Clock,
  Trophy,
  RefreshCw,
  Play,
  ExternalLink,
  Volume2,
  VolumeX,
  Trash2,
  Pencil,
} from 'lucide-react';
import { rateCard, sortByPriority, getDueCards, getCardStats, previewNextReviews, Rating } from '../services/fsrs';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useReviewSession } from '../context/ReviewSessionContext';
import { API_BASE_URL } from '../config';
import { HelpOverlay, HelpTip } from '../components/HelpOverlay';
import { Sparkles } from 'lucide-react';

const flashcardsPageTips: HelpTip[] = [
  {
    id: 'deck-select',
    text: 'Switch between decks or review all cards at once.',
    targetId: 'section-deck-select',
    position: 'bottom',
  },
  {
    id: 'flashcard',
    text: 'Tap the card to flip and reveal the translation.',
    targetId: 'section-flashcard',
    position: 'right',
  },
  {
    id: 'rating-buttons',
    text: 'Rate how well you knew the word. This schedules the next review.',
    targetId: 'section-rating-buttons',
    position: 'top',
  },
];

// Netflix video placeholder component with screenshot and audio support
function NetflixVideoPlaceholder({ videoId, timestamp }: { videoId: string; timestamp: number }) {
  const [hasScreenshot, setHasScreenshot] = React.useState<boolean | null>(null);
  const [hasAudio, setHasAudio] = React.useState<boolean>(false);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const roundedTimestamp = Math.floor(timestamp);
  const netflixId = videoId.replace('netflix_', '');
  const timeStr = `${Math.floor(timestamp / 60)}:${String(Math.floor(timestamp % 60)).padStart(2, '0')}`;

  // Check if screenshot and audio exist
  React.useEffect(() => {
    fetch(`${API_BASE_URL}/netflix/screenshot/${videoId}/${roundedTimestamp}`, { method: 'HEAD' })
      .then(res => setHasScreenshot(res.ok))
      .catch(() => setHasScreenshot(false));

    fetch(`${API_BASE_URL}/netflix/audio/${videoId}/${roundedTimestamp}`, { method: 'HEAD' })
      .then(res => setHasAudio(res.ok))
      .catch(() => setHasAudio(false));
  }, [videoId, roundedTimestamp]);

  // Auto-play audio when component mounts (if available)
  React.useEffect(() => {
    if (hasAudio && audioRef.current) {
      audioRef.current.play().catch(() => {
        // Auto-play blocked, user needs to click
      });
    }
  }, [hasAudio]);

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } else {
      audioRef.current.play();
    }
  };

  return (
    <div className="w-full h-full relative bg-gradient-to-br from-[#1a1a2e] to-[#2d1f3d]">
      {/* Audio element (hidden) */}
      {hasAudio && (
        <audio
          ref={audioRef}
          src={`${API_BASE_URL}/netflix/audio/${videoId}/${roundedTimestamp}`}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {hasScreenshot ? (
        <>
          <img
            src={`${API_BASE_URL}/netflix/screenshot/${videoId}/${roundedTimestamp}`}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setHasScreenshot(false)}
          />
          {/* Audio control button overlay */}
          {hasAudio && (
            <button
              onClick={toggleAudio}
              className="absolute bottom-3 right-3 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
              title={isPlaying ? 'Stop audio' : 'Play audio'}
            >
              {isPlaying ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-[#e50914] flex items-center justify-center mb-2">
            <span className="text-white font-bold text-xl">N</span>
          </div>
          <a
            href={`https://www.netflix.com/watch/${netflixId}?t=${roundedTimestamp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#e50914] hover:bg-[#f6121d] text-white text-sm font-medium transition-colors shadow-lg"
          >
            <Play className="w-4 h-4" />
            Watch on Netflix
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
          <p className="text-white/50 text-xs mt-2">{timeStr}</p>
          {/* Audio button when no screenshot */}
          {hasAudio && (
            <button
              onClick={toggleAudio}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
            >
              {isPlaying ? (
                <><VolumeX className="w-4 h-4" /> Stop</>
              ) : (
                <><Volume2 className="w-4 h-4" /> Play Audio</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface FlashCard {
  target_word: string;
  dictionary_form: string;
  english: string;
  sentence: string;
  sentence_translation: string;
  timestamp: number;
  end_timestamp: number;
  video_id: string;
  rank?: number;
}

interface TrackedVideo {
  video_id: string;
  title: string;
  tracked_at: number;
}

type LoadState = 'loading' | 'loaded' | 'error' | 'no-videos' | 'no-vocab' | 'session-complete' | 'time-gated-complete';

// Format next review time
function formatNextReview(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

// Get responsive font size based on word/definition length
function getWordFontSize(text: string): string {
  const len = text.length;
  if (len > 20) return 'text-xl md:text-2xl';
  if (len > 15) return 'text-2xl md:text-3xl';
  if (len > 12) return 'text-3xl md:text-4xl';
  if (len > 8) return 'text-4xl md:text-5xl';
  return 'text-5xl md:text-6xl';
}

// Deleted cards persistence
const DELETED_CARDS_KEY = 'lipit_deleted_cards';

function getDeletedCards(language: string): Set<string> {
  try {
    const stored = localStorage.getItem(DELETED_CARDS_KEY);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    return new Set(parsed[language] || []);
  } catch {
    return new Set();
  }
}

function addDeletedCard(language: string, word: string) {
  try {
    const stored = localStorage.getItem(DELETED_CARDS_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    if (!parsed[language]) parsed[language] = [];
    if (!parsed[language].includes(word)) {
      parsed[language].push(word);
    }
    localStorage.setItem(DELETED_CARDS_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage errors
  }
}

export function FlashcardsPage() {
  const { language, languageName } = useLanguage();
  const { token } = useAuth();
  const {
    session,
    startSession,
    endSession,
    recordCardReview,
    extendSession,
    resetSession,
    getGoalLabel,
    getRemainingCards,
  } = useReviewSession();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [dueCards, setDueCards] = useState<FlashCard[]>([]);
  const [videos, setVideos] = useState<TrackedVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedVideoTitle, setSelectedVideoTitle] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showVideoPicker, setShowVideoPicker] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Loading watch history...');
  const [lastRatingInfo, setLastRatingInfo] = useState<{ word: string; nextDue: string } | null>(null);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
  const [isEditingDefinition, setIsEditingDefinition] = useState(false);
  const [editedDefinition, setEditedDefinition] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteVideoConfirm, setShowDeleteVideoConfirm] = useState<TrackedVideo | null>(null);
  const [isDeletingVideo, setIsDeletingVideo] = useState(false);
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const loopIntervalRef = useRef<number | null>(null);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }
  }, []);

  // Destroy player when deck changes to force recreation
  useEffect(() => {
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        // Player might already be destroyed
      }
      playerRef.current = null;
    }
    if (loopIntervalRef.current) {
      clearInterval(loopIntervalRef.current);
      loopIntervalRef.current = null;
    }
  }, [selectedVideoId]);

  // Check if a video is from Netflix
  const isNetflixVideo = (videoId: string) => videoId.startsWith('netflix_');

  // Create/update YouTube player when card changes (skip for Netflix)
  useEffect(() => {
    const card = dueCards[currentIndex];
    if (loadState !== 'loaded' || !card) return;
    if (!playerContainerRef.current) return;

    // Skip YouTube player for Netflix videos
    if (isNetflixVideo(card.video_id)) {
      // Destroy any existing YouTube player
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore destruction errors
        }
        playerRef.current = null;
      }
      return;
    }

    // Add 3 seconds buffer to end timestamp
    const endTime = (card.end_timestamp || card.timestamp + 5) + 3;

    const setupLooping = (player: any) => {
      if (loopIntervalRef.current) {
        clearInterval(loopIntervalRef.current);
      }
      loopIntervalRef.current = window.setInterval(() => {
        try {
          const currentTime = player.getCurrentTime();
          if (currentTime >= endTime) {
            player.seekTo(card.timestamp, true);
          }
        } catch (e) {
          // Player not ready yet
        }
      }, 200);
    };

    const initPlayer = () => {
      // If player already exists, just load new video
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        playerRef.current.loadVideoById({
          videoId: card.video_id,
          startSeconds: card.timestamp,
        });
        setupLooping(playerRef.current);
        return;
      }

      // Create new player
      if (!playerContainerRef.current) return;

      playerRef.current = new (window as any).YT.Player(playerContainerRef.current, {
        videoId: card.video_id,
        playerVars: {
          start: card.timestamp,
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event: any) => {
            setupLooping(event.target);
          },
        },
      });
    };

    // Wait for YT API to be ready
    const waitForYT = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        initPlayer();
      } else {
        setTimeout(waitForYT, 100);
      }
    };

    waitForYT();

    return () => {
      if (loopIntervalRef.current) {
        clearInterval(loopIntervalRef.current);
      }
    };
  }, [currentIndex, loadState, dueCards]);

  // Check if a Netflix screenshot exists for a given video/timestamp
  const checkScreenshotExists = async (videoId: string, timestamp: number): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/netflix/screenshot/${videoId}/${Math.floor(timestamp)}`, { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  };

  // Fetch flashcards for a single video. Returns cards array (empty if failed/no vocab).
  const fetchCardsForVideo = useCallback(async (videoId: string): Promise<FlashCard[]> => {
    try {
      await fetch(`${API_BASE_URL}/subtitles/${videoId}`);

      const vocabRes = await fetch(`${API_BASE_URL}/vocabulary/${videoId}?limit=20&lang=${language}`);
      if (!vocabRes.ok) return [];
      const vocab = await vocabRes.json();
      if (!vocab.total_words) return [];

      const wordList = vocab.vocabulary.map((v: { word: string }) => v.word);
      const fcRes = await fetch(`${API_BASE_URL}/flashcard-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId, words: wordList, word_source: 'essential', language }),
      });
      if (!fcRes.ok) return [];
      const fc = await fcRes.json();

      // Attach rank from vocab to each card
      const rankMap: Record<string, number> = {};
      vocab.vocabulary.forEach((v: { word: string; rank: number }) => { rankMap[v.word] = v.rank; });
      let cards = (fc.flashcards || []).map((card: FlashCard) => ({
        ...card,
        rank: rankMap[card.target_word],
      }));

      // For Netflix videos, only show cards that have screenshots
      if (videoId.startsWith('netflix_') && cards.length > 0) {
        const screenshotChecks = await Promise.all(
          cards.map((card: FlashCard) => checkScreenshotExists(videoId, card.timestamp))
        );
        const cardsWithScreenshots = cards.filter((_: FlashCard, i: number) => screenshotChecks[i]);
        console.log(`[lipIt] Netflix cards: ${cardsWithScreenshots.length}/${cards.length} have screenshots`);

        // Only show Netflix cards that have screenshots
        cards = cardsWithScreenshots;
      }

      // Filter out deleted cards
      const deletedCards = getDeletedCards(language);
      cards = cards.filter((card: FlashCard) => {
        const word = card.dictionary_form || card.target_word;
        return !deletedCards.has(word);
      });

      return cards;
    } catch {
      return [];
    }
  }, [language]);

  // Sort cards by FSRS priority and filter to due cards
  const prepareCardsForReview = useCallback((allCards: FlashCard[]) => {
    // Deduplicate by dictionary_form (keep first occurrence)
    const seen = new Set<string>();
    const uniqueCards = allCards.filter(c => {
      const key = c.dictionary_form || c.target_word;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const words = uniqueCards.map(c => c.dictionary_form || c.target_word);
    const sortedWords = sortByPriority(words);
    const dueWords = getDueCards(words);

    // Reorder cards by sorted priority
    const cardMap = new Map(uniqueCards.map(c => [c.dictionary_form || c.target_word, c]));
    const sortedCards = sortedWords.map(w => cardMap.get(w)!).filter(Boolean);
    const dueCardsFiltered = sortedCards.filter(c => dueWords.includes(c.dictionary_form || c.target_word));

    setCards(sortedCards);
    setDueCards(dueCardsFiltered);
    setSessionStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });

    if (dueCardsFiltered.length === 0 && sortedCards.length > 0) {
      // No cards due - show completion screen
      setLoadState('session-complete');
    } else {
      setLoadState('loaded');
      // Start the review session timer
      startSession();
    }
  }, [startSession]);

  // Load cards for "All Videos" mode
  const loadAllVideos = useCallback(async (videoList: TrackedVideo[]) => {
    setLoadState('loading');
    setLoadingMsg('Loading flashcards from all videos...');
    setCards([]);
    setDueCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedVideoId('all');
    setSelectedVideoTitle('All Videos');
    setLastRatingInfo(null);

    const allCards: FlashCard[] = [];
    for (const video of videoList) {
      setLoadingMsg(`Loading: ${video.title.slice(0, 40)}...`);
      const videoCards = await fetchCardsForVideo(video.video_id);
      allCards.push(...videoCards);
    }

    if (!allCards.length) {
      setLoadState('no-vocab');
      return;
    }
    prepareCardsForReview(allCards);
  }, [fetchCardsForVideo, prepareCardsForReview]);

  // Load cards for a single video.
  const loadFlashcards = useCallback(async (videoId: string, videoTitle: string) => {
    setLoadState('loading');
    setLoadingMsg('Fetching subtitles...');
    setCards([]);
    setDueCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedVideoId(videoId);
    setSelectedVideoTitle(videoTitle);
    setLastRatingInfo(null);

    setLoadingMsg('Extracting vocabulary...');
    const videoCards = await fetchCardsForVideo(videoId);

    if (!videoCards.length) {
      setLoadState('no-vocab');
      return;
    }
    prepareCardsForReview(videoCards);
  }, [fetchCardsForVideo, prepareCardsForReview]);

  useEffect(() => {
    async function bootstrap() {
      try {
        const res = await fetch(`${API_BASE_URL}/videos/history/filtered?lang=${language}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const vids: TrackedVideo[] = data.videos || [];
        setVideos(vids);

        if (!vids.length) {
          setLoadState('no-videos');
          return;
        }

        await loadAllVideos(vids);
      } catch {
        setLoadState('error');
      }
    }
    bootstrap();
  }, [language, token, loadAllVideos]);

  const currentCard = dueCards[currentIndex];
  const progress = dueCards.length ? ((currentIndex + 1) / dueCards.length) * 100 : 0;

  // Handle rating a card
  function handleRating(rating: Rating) {
    if (!currentCard) return;

    // Calculate clip duration (with 3 second buffer that's added during playback)
    const clipDuration = (currentCard.end_timestamp || currentCard.timestamp + 5) - currentCard.timestamp + 3;
    const { nextDue } = rateCard(currentCard.dictionary_form || currentCard.target_word, rating, clipDuration);
    const nextDueStr = formatNextReview(nextDue);

    // Record card review and check if cap was just reached
    const capJustReached = recordCardReview();

    // Update session stats
    const ratingKey = rating === Rating.Again ? 'again'
      : rating === Rating.Hard ? 'hard'
      : rating === Rating.Good ? 'good'
      : 'easy';
    setSessionStats(prev => ({
      ...prev,
      reviewed: prev.reviewed + 1,
      [ratingKey]: prev[ratingKey] + 1,
    }));

    setLastRatingInfo({ word: currentCard.dictionary_form || currentCard.target_word, nextDue: nextDueStr });
    setIsFlipped(false);

    setTimeout(() => {
      // Check if session cap was just reached (card count limit)
      if (capJustReached) {
        setLoadState('time-gated-complete');
        endSession();
        return;
      }

      if (currentIndex < dueCards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // All cards reviewed - session complete
        setLoadState('session-complete');
        endSession();
      }
      setLastRatingInfo(null);
    }, 300);
  }

  // Handle skipping/regenerating a flashcard
  async function handleSkipCard() {
    if (!currentCard) return;

    try {
      // Call API to skip this sentence for this word
      await fetch(`${API_BASE_URL}/flashcard-skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: currentCard.dictionary_form || currentCard.target_word,
          sentence: currentCard.sentence,
        }),
      });

      // Remove this card from the current session
      const newDueCards = dueCards.filter((_, i) => i !== currentIndex);
      setDueCards(newDueCards);

      // Adjust index if needed
      if (currentIndex >= newDueCards.length && newDueCards.length > 0) {
        setCurrentIndex(newDueCards.length - 1);
      } else if (newDueCards.length === 0) {
        setLoadState('session-complete');
      }

      setIsFlipped(false);
    } catch (error) {
      console.error('Failed to skip card:', error);
    }
  }

  // Show delete confirmation modal
  function handleDeleteCard() {
    if (!currentCard) return;
    setShowDeleteConfirm(true);
  }

  // Actually delete the card after confirmation
  async function confirmDeleteCard() {
    if (!currentCard) return;

    const word = currentCard.dictionary_form || currentCard.target_word;
    setShowDeleteConfirm(false);

    // Persist deletion to localStorage
    addDeletedCard(language, word);

    // Remove this card from all local state immediately (optimistic update)
    const newDueCards = dueCards.filter((_, i) => i !== currentIndex);
    const newCards = cards.filter(c => (c.dictionary_form || c.target_word) !== word);
    setCards(newCards);
    setDueCards(newDueCards);

    // Adjust index if needed
    if (currentIndex >= newDueCards.length && newDueCards.length > 0) {
      setCurrentIndex(newDueCards.length - 1);
    } else if (newDueCards.length === 0) {
      setLoadState('session-complete');
    }

    setIsFlipped(false);

    // Try to delete from API in background
    try {
      await fetch(`${API_BASE_URL}/fsrs/cards/${encodeURIComponent(word)}?language=${language}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (error) {
      console.error('Failed to delete card from server:', error);
    }
  }

  // Start editing definition
  function handleStartEditDefinition() {
    if (!currentCard) return;
    setEditedDefinition(currentCard.english || '');
    setIsEditingDefinition(true);
  }

  // Save edited definition
  async function handleSaveDefinition() {
    if (!currentCard || !editedDefinition.trim()) {
      setIsEditingDefinition(false);
      return;
    }

    const word = currentCard.dictionary_form || currentCard.target_word;

    try {
      const res = await fetch(`${API_BASE_URL}/flashcard-definition`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          word,
          definition: editedDefinition.trim(),
          language,
        }),
      });

      if (res.ok) {
        // Update the card in local state
        const updateCardDefinition = (card: FlashCard) => {
          if ((card.dictionary_form || card.target_word) === word) {
            return { ...card, english: editedDefinition.trim() };
          }
          return card;
        };
        setCards(prev => prev.map(updateCardDefinition));
        setDueCards(prev => prev.map(updateCardDefinition));
      }
    } catch (error) {
      console.error('Failed to save definition:', error);
    } finally {
      setIsEditingDefinition(false);
    }
  }

  // Delete all flashcards for a specific video
  async function handleDeleteVideoFlashcards(video: TrackedVideo) {
    setIsDeletingVideo(true);

    try {
      // Call API to delete flashcards for this video
      const res = await fetch(
        `${API_BASE_URL}/fsrs/cards/video/${encodeURIComponent(video.video_id)}?language=${language}`,
        {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (res.ok) {
        // Remove cards from local state
        const newCards = cards.filter(c => c.video_id !== video.video_id);
        const newDueCards = dueCards.filter(c => c.video_id !== video.video_id);
        setCards(newCards);
        setDueCards(newDueCards);

        // Remove the video from the videos list (so it doesn't show in "All Videos")
        const newVideos = videos.filter(v => v.video_id !== video.video_id);
        setVideos(newVideos);

        // If the deleted video was currently selected, switch to "All Videos"
        if (selectedVideoId === video.video_id) {
          setSelectedVideoId('all');
          setSelectedVideoTitle('All Videos');
        }

        // Adjust current index if needed
        if (currentIndex >= newDueCards.length && newDueCards.length > 0) {
          setCurrentIndex(newDueCards.length - 1);
        } else if (newDueCards.length === 0) {
          // Check if there are no more videos at all
          if (newVideos.length === 0) {
            setLoadState('no-videos');
          } else {
            setLoadState('session-complete');
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete video flashcards:', error);
    } finally {
      setIsDeletingVideo(false);
      setShowDeleteVideoConfirm(null);
      setShowVideoPicker(false);
    }
  }

  // Get stats for current card
  const currentStats = currentCard ? getCardStats(currentCard.dictionary_form || currentCard.target_word) : null;

  // Get preview times for rating buttons
  const previewTimes = currentCard ? previewNextReviews(currentCard.dictionary_form || currentCard.target_word) : null;

  // ── Loading ──────────────────────────────────────────────────
  if (loadState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5">
        <div className="w-10 h-10 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
        <p className="text-secondary text-sm">{loadingMsg}</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (loadState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <p className="text-primary font-semibold">Couldn't load flashcards</p>
        <p className="text-secondary text-sm text-center max-w-sm">
          Make sure the lipIt server is running and accessible.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-5 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors">
          Try again
        </button>
      </div>
    );
  }

  // ── No videos ────────────────────────────────────────────────
  if (loadState === 'no-videos') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
          <Tv className="w-7 h-7 text-accent" />
        </div>
        <p className="text-primary font-semibold">No videos tracked yet</p>
        <p className="text-secondary text-sm text-center max-w-sm">
          Watch a {languageName} YouTube video with the lipIt extension to start building flashcards.
        </p>
      </div>
    );
  }

  // ── No vocab ─────────────────────────────────────────────────
  if (loadState === 'no-vocab') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-3xl">
          {language === 'uk' ? '🇺🇦' : '🈚'}
        </div>
        <p className="text-primary font-semibold">No common {languageName} words found</p>
        <p className="text-secondary text-sm text-center max-w-sm">
          {selectedVideoId === 'all'
            ? `None of the tracked videos had ${languageName} words matching the frequency list.`
            : `No ${languageName} words from the frequency list were found in this video.`}
        </p>
        {videos.length > 1 && selectedVideoId !== 'all' && (
          <button
            onClick={() => loadAllVideos(videos)}
            className="mt-2 px-5 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors">
            Try all videos
          </button>
        )}
        {videos.length > 1 && (
          <button
            onClick={() => setShowVideoPicker(true)}
            className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary text-sm font-semibold hover:bg-white/8 transition-colors">
            Pick a specific video
          </button>
        )}
        <AnimatePresence>
          {showVideoPicker && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full max-w-xs mt-2 bg-surface border border-white/10 rounded-xl overflow-hidden shadow-xl">
              {videos.map(v => (
                <button
                  key={v.video_id}
                  onClick={() => { setShowVideoPicker(false); loadFlashcards(v.video_id, v.title); }}
                  className="w-full text-left px-4 py-3 text-sm text-secondary hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                  <span className="line-clamp-1">{v.title}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Time-Gated Complete (daily goal reached) ────────────────
  if (loadState === 'time-gated-complete') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-20 h-20 rounded-full bg-gradient-to-br from-accent/20 to-green-500/20 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-accent" />
        </motion.div>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center">
          <h2 className="text-2xl font-heading font-bold text-primary mb-2">
            {sessionStats.reviewed} cards — great work!
          </h2>
          <p className="text-secondary text-sm">
            You hit your daily goal of {getGoalLabel()}
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mt-4">
          <p className="text-secondary text-sm mb-4">Want to keep going?</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                // End session and go back to main screen
                resetSession();
                setLoadState('session-complete');
              }}
              className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-secondary text-sm font-semibold hover:bg-white/8 transition-colors">
              I'm done for today
            </button>
            <button
              onClick={() => {
                // Extend session and continue
                extendSession();
                setLoadState('loaded');
              }}
              className="px-5 py-3 rounded-xl bg-accent text-app text-sm font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20">
              Keep reviewing
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Session Complete ─────────────────────────────────────────
  if (loadState === 'session-complete') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <Trophy className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-heading font-bold text-primary">Session Complete!</h2>
        {sessionStats.reviewed > 0 ? (
          <div className="text-center">
            <p className="text-secondary text-sm mb-3">
              You reviewed <span className="text-accent font-semibold">{sessionStats.reviewed}</span> cards
            </p>
            <div className="flex gap-4 justify-center text-xs">
              <span className="text-red-400">Again: {sessionStats.again}</span>
              <span className="text-orange-400">Hard: {sessionStats.hard}</span>
              <span className="text-accent">Good: {sessionStats.good}</span>
              <span className="text-green-400">Easy: {sessionStats.easy}</span>
            </div>
          </div>
        ) : (
          <p className="text-secondary text-sm text-center max-w-sm">
            No cards are due for review right now. Come back later!
          </p>
        )}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => {
              resetSession();
              setCurrentIndex(0);
              setDueCards(cards);
              setSessionStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
              setLoadState('loaded');
              startSession();
            }}
            className="px-5 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors">
            Review All Cards
          </button>
          <button
            onClick={() => {
              resetSession();
              loadAllVideos(videos);
            }}
            className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary text-sm font-semibold hover:bg-white/8 transition-colors">
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // ── Loaded ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center max-w-md mx-auto px-4 py-8 md:py-10">
      <HelpOverlay tips={flashcardsPageTips} />

      {/* Header stats */}
      <div className="w-full flex items-center justify-between mb-5">
        <div id="section-deck-select" className="min-w-0 flex-1 mr-4">
          <h1 className="text-xl font-heading font-bold text-primary">Daily Review</h1>
          <button
            onClick={() => setShowVideoPicker(!showVideoPicker)}
            className="flex items-center gap-1 text-xs text-secondary hover:text-accent transition-colors mt-0.5 group">
            {selectedVideoId === 'all'
              ? <><Layers className="w-3 h-3 shrink-0 mr-0.5" /><span>All Videos</span></>
              : <span className="truncate max-w-[220px]">{selectedVideoTitle}</span>
            }
            <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${showVideoPicker ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <div className="text-right shrink-0">
          {session.isExtended ? (
            <>
              <div className="text-2xl font-bold text-accent">
                {getRemainingCards(dueCards.length - currentIndex)}
                <span className="text-muted text-lg"> left</span>
              </div>
              <div className="text-xs text-secondary mt-1">
                {sessionStats.reviewed} reviewed
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-accent">
                {session.cardsReviewed}
                <span className="text-muted text-lg"> / {session.sessionCap}</span>
              </div>
              <div className="w-24 h-1.5 bg-surface-hover rounded-full mt-1.5 overflow-hidden">
                <motion.div
                  className="h-full bg-accent"
                  animate={{ width: `${Math.min(100, (session.cardsReviewed / session.sessionCap) * 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Video picker dropdown */}
      <AnimatePresence>
        {showVideoPicker && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full mb-4 bg-surface border border-white/10 rounded-xl overflow-hidden shadow-xl">

            {/* All Videos option */}
            <button
              onClick={() => { setShowVideoPicker(false); loadAllVideos(videos); }}
              className={`w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors border-b border-white/5 flex items-center gap-2 ${
                selectedVideoId === 'all' ? 'text-accent' : 'text-secondary'
              }`}>
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>All Videos ({videos.length})</span>
            </button>

            {/* Individual videos */}
            {videos.map(v => (
              <div
                key={v.video_id}
                className={`flex items-center justify-between border-b border-white/5 last:border-0 ${
                  v.video_id === selectedVideoId ? 'text-accent' : 'text-secondary'
                }`}>
                <button
                  onClick={() => { setShowVideoPicker(false); loadFlashcards(v.video_id, v.title); }}
                  className="flex-1 text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors">
                  <span className="line-clamp-1">{v.title}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteVideoConfirm(v);
                  }}
                  className="p-2.5 mr-2 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
                  title="Delete all flashcards for this video"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card area */}
      <div className="w-full space-y-4">
        {/* Video clip (YouTube) or Netflix placeholder */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden ring-1 ring-white/10 bg-black">
          {currentCard && isNetflixVideo(currentCard.video_id) ? (
            // Netflix screenshot or placeholder with deep link button
            <NetflixVideoPlaceholder
              videoId={currentCard.video_id}
              timestamp={currentCard.timestamp}
            />
          ) : (
            <div
              ref={playerContainerRef}
              className="w-full h-full"
            />
          )}
          {/* Action buttons */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            <button
              onClick={handleSkipCard}
              className="p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white/70 hover:text-white transition-colors group"
              title="Get a different clip for this word"
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
            </button>
            <button
              onClick={handleDeleteCard}
              className="p-2 rounded-lg bg-black/60 hover:bg-red-500/80 text-white/70 hover:text-white transition-colors"
              title="Delete this card permanently"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          {/* Sentence context overlay */}
          {currentCard && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 py-2.5 text-center">
              <p className="text-sm font-medium leading-snug" style={{ color: '#ffffff' }}>
                {currentCard.sentence ? (
                  currentCard.sentence.split(new RegExp(`(${currentCard.target_word})`, 'g')).map((part, i) =>
                    part === currentCard.target_word ? (
                      <span key={i} className="text-accent font-bold">{part}</span>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )
                ) : (
                  <span className="text-accent">{currentCard.target_word}</span>
                )}
              </p>
              {isFlipped && currentCard.sentence_translation && currentCard.sentence_translation !== 'No translation available' && (
                <p className="text-xs mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {currentCard.sentence_translation}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Flashcard */}
        <div id="section-flashcard" className="relative w-full aspect-[4/3]" style={{ perspective: '1200px' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="w-full h-full relative cursor-pointer"
              onClick={() => setIsFlipped(!isFlipped)}
              style={{ transformStyle: 'preserve-3d' }}>

              <motion.div
                className="w-full h-full absolute inset-0"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                style={{ transformStyle: 'preserve-3d' }}>

                {/* Front - Korean word */}
                <div
                  className="absolute inset-0 bg-surface border border-white/10 rounded-2xl shadow-2xl flex flex-col items-center justify-center p-8"
                  style={{ backfaceVisibility: 'hidden' }}>
                  <div className="flex items-center gap-2 mb-5">
                    {currentStats && !currentStats.isNew && (
                      <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border border-accent/20 text-accent flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {currentStats.repetitions}x
                      </span>
                    )}
                    {currentStats?.isNew && (
                      <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent">
                        NEW
                      </span>
                    )}
                  </div>
                  <h2 className={`${getWordFontSize(currentCard?.target_word || '')} font-heading font-bold text-primary text-center mb-3 tracking-tight`}>
                    {currentCard?.target_word}
                  </h2>
                  {currentCard?.dictionary_form && currentCard.dictionary_form !== currentCard.target_word && (
                    <p className="text-sm text-muted font-mono">({currentCard.dictionary_form})</p>
                  )}
                  <div className="absolute bottom-5 text-muted text-xs flex items-center gap-1.5">
                    <RotateCw className="w-3.5 h-3.5" /> Tap to reveal
                  </div>
                </div>

                {/* Back - English definition */}
                <div
                  className="absolute inset-0 bg-surface-hover border border-accent/20 rounded-2xl shadow-2xl flex flex-col items-center justify-center p-8"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <div className="flex items-center gap-2 mb-5">
                    <span className="text-xs font-bold tracking-widest text-secondary uppercase">
                      English
                    </span>
                    {!isEditingDefinition && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditDefinition();
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-accent transition-colors"
                        title="Edit definition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {isEditingDefinition ? (
                    <div className="w-full max-w-xs" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editedDefinition}
                        onChange={(e) => setEditedDefinition(e.target.value)}
                        className="w-full bg-surface border border-white/20 rounded-lg px-4 py-3 text-primary text-center text-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveDefinition();
                          if (e.key === 'Escape') setIsEditingDefinition(false);
                        }}
                      />
                      <div className="flex gap-2 mt-3 justify-center">
                        <button
                          onClick={() => setIsEditingDefinition(false)}
                          className="px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-secondary text-sm font-medium hover:bg-white/10 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveDefinition}
                          className="px-4 py-1.5 rounded-lg bg-accent text-app text-sm font-medium hover:bg-accent/90 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <h2 className={`${getWordFontSize(currentCard?.english || '-')} font-heading font-bold text-primary text-center mb-4`}>
                      {currentCard?.english && currentCard.english !== 'definition not available'
                        ? currentCard.english
                        : '-'}
                    </h2>
                  )}
                  <div className="w-full border-t border-white/5 pt-4 mt-1 text-center">
                    <p className="text-sm text-muted italic">
                      {currentCard?.target_word}
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Last rating feedback */}
      <AnimatePresence>
        {lastRatingInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 px-4 py-2 rounded-lg bg-surface border border-white/10 text-xs text-secondary flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-accent" />
            Next review for "{lastRatingInfo.word}" in {lastRatingInfo.nextDue}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <motion.div
        id="section-rating-buttons"
        className="grid grid-cols-4 gap-3 mt-8 w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}>

        <button
          onClick={() => handleRating(Rating.Again)}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface hover:bg-accent/10 border border-transparent hover:border-accent/40 group transition-all">
          {previewTimes && (
            <span className="text-[10px] text-muted font-medium">{formatNextReview(previewTimes.again)}</span>
          )}
          <X className="w-6 h-6 text-accent" />
          <span className="text-sm font-medium text-secondary group-hover:text-accent">Again</span>
        </button>

        <button
          onClick={() => handleRating(Rating.Hard)}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface hover:bg-accent/10 border border-transparent hover:border-accent/40 group transition-all">
          {previewTimes && (
            <span className="text-[10px] text-muted font-medium">{formatNextReview(previewTimes.hard)}</span>
          )}
          <ThumbsDown className="w-6 h-6 text-accent" />
          <span className="text-sm font-medium text-secondary group-hover:text-accent">Hard</span>
        </button>

        <button
          onClick={() => handleRating(Rating.Good)}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface hover:bg-accent/10 border border-transparent hover:border-accent/40 group transition-all">
          {previewTimes && (
            <span className="text-[10px] text-muted font-medium">{formatNextReview(previewTimes.good)}</span>
          )}
          <ThumbsUp className="w-6 h-6 text-accent" />
          <span className="text-sm font-medium text-secondary group-hover:text-accent">Good</span>
        </button>

        <button
          onClick={() => handleRating(Rating.Easy)}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface hover:bg-accent/10 border border-transparent hover:border-accent/40 group transition-all">
          {previewTimes && (
            <span className="text-[10px] text-muted font-medium">{formatNextReview(previewTimes.easy)}</span>
          )}
          <Check className="w-6 h-6 text-accent" />
          <span className="text-sm font-medium text-secondary group-hover:text-accent">Easy</span>
        </button>
      </motion.div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-primary text-center mb-2">Delete Card?</h3>
              <p className="text-sm text-secondary text-center mb-6">
                Are you sure you want to delete this card? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteCard}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Video Flashcards Confirmation Modal */}
      <AnimatePresence>
        {showDeleteVideoConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            onClick={() => !isDeletingVideo && setShowDeleteVideoConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-primary text-center mb-2">
                Delete All Flashcards?
              </h3>
              <p className="text-sm text-secondary text-center mb-2">
                Are you sure you want to delete all flashcards from:
              </p>
              <p className="text-sm text-primary font-medium text-center mb-4 px-4 line-clamp-2">
                "{showDeleteVideoConfirm.title}"
              </p>
              <p className="text-xs text-muted text-center mb-6">
                This will remove all vocabulary cards associated with this video. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteVideoConfirm(null)}
                  disabled={isDeletingVideo}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteVideoFlashcards(showDeleteVideoConfirm)}
                  disabled={isDeletingVideo}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeletingVideo ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete All
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
