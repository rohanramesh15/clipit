import React, { useState, useEffect, useCallback, useRef } from 'react';
declare function gtag(...args: unknown[]): void;
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '../components/Skeleton';
import {
  ArrowLeft,
  AlertCircle,
  Tv,
  Layers,
  Clock,
  Trash2,
  BookOpen,
  LogOut,
} from 'lucide-react';
import { rateCard, sortByPriority, getDueCards, getCardStats, previewNextReviews, Rating } from '../services/fsrs';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useReviewSession } from '../context/ReviewSessionContext';
import { API_BASE_URL } from '../config';
import { HelpOverlay, HelpTip } from '../components/HelpOverlay';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queries';
import { FlashCard, TrackedVideo, VocabList, LoadState, Page } from '../types/flashcards';
import { getDeletedCards, formatNextReview } from '../utils/flashcardStorage';
import { DueToday } from '../components/flashcards/DueToday';
import { DeckBrowser } from '../components/flashcards/DeckBrowser';
import { ReviewCard } from '../components/flashcards/ReviewCard';
import { RatingBar } from '../components/flashcards/RatingBar';
import { SessionSummary } from '../components/flashcards/SessionSummary';

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

interface FlashcardsPageProps {
  onNavigate?: (page: Page) => void;
}

export function FlashcardsPage({ onNavigate }: FlashcardsPageProps) {
  const { language, languageName } = useLanguage();
  const { token, user } = useAuth();
  const {
    session,
    startSession,
    endSession,
    recordCardReview,
    extendSession,
    resetSession,
    setCardsReviewedToday,
    getGoalLabel,
  } = useReviewSession();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [dueCards, setDueCards] = useState<FlashCard[]>([]);
  const [videos, setVideos] = useState<TrackedVideo[]>([]);
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({}); // video_id -> # words
  const [dueCounts, setDueCounts] = useState<Record<string, number>>({}); // video_id -> # due cards
  const [isLoadingDue, setIsLoadingDue] = useState(true);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedVideoTitle, setSelectedVideoTitle] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Loading watch history...');
  const [lastRatingInfo, setLastRatingInfo] = useState<{ word: string; nextDue: string } | null>(null);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
  const [isEditingDefinition, setIsEditingDefinition] = useState(false);
  const [editedDefinition, setEditedDefinition] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [showJoinClass, setShowJoinClass] = useState(false);
  const [isJoiningClass, setIsJoiningClass] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [showLeaveClass, setShowLeaveClass] = useState(false);
  const [isLeavingClass, setIsLeavingClass] = useState(false);
  const [enrolledClasses, setEnrolledClasses] = useState<Array<{class_code: string, class_name: string, lists_count: number, words_count: number}>>([]);
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(false);
  const [confirmLeaveClass, setConfirmLeaveClass] = useState<{class_code: string, class_name: string} | null>(null);
  const [vocabLists, setVocabLists] = useState<VocabList[]>([]);
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const loopIntervalRef = useRef<number | null>(null);

  const cleanupYouTubePlayer = useCallback(() => {
    if (loopIntervalRef.current) {
      clearInterval(loopIntervalRef.current);
      loopIntervalRef.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch {
        // The iframe API can race with React unmounts while cards change.
      }
      playerRef.current = null;
    }
    if (playerContainerRef.current) {
      playerContainerRef.current.replaceChildren();
    }
  }, []);

  // Play text using Web Speech API
  const playTTS = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'uk' ? 'uk-UA' : language === 'en' ? 'en-US' : 'ko-KR';
    utterance.rate = 0.9;

    const voices = window.speechSynthesis.getVoices();
    const langPrefix = language === 'uk' ? 'uk' : language === 'en' ? 'en' : 'ko';
    const targetVoice = voices.find(v => v.lang.startsWith(langPrefix) && v.name.includes('Google'))
      || voices.find(v => v.lang.startsWith(langPrefix))
      || voices[0];

    if (targetVoice) {
      utterance.voice = targetVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, [language]);

  useEffect(() => {
    gtag('event', 'conversion', {
      'send_to': 'AW-18115152337/s3QjCOHmyqEcENGT_b1D',
      'value': 0,
      'currency': 'USD'
    });
  }, []);

  // Fetch vocabulary lists, filtered to the current language
  const fetchVocabLists = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/lists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const lists = await res.json();
        setVocabLists(lists.filter((l: VocabList) => l.language === language));
      }
    } catch (err) {
      console.error('Failed to fetch vocab lists:', err);
    }
  }, [token, language]);

  // Fetch enrolled classes
  async function fetchEnrolledClasses() {
    if (!token) return;
    setIsLoadingEnrolled(true);
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/enrolled-classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEnrolledClasses(data.classes || []);
      }
    } catch (err) {
      console.error('Error fetching enrolled classes:', err);
    } finally {
      setIsLoadingEnrolled(false);
    }
  }

  // Sync all enrolled classes to get new vocabulary
  async function syncEnrolledClasses() {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/enrolled-classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      const classes = data.classes || [];

      let totalNewWords = 0;
      for (const cls of classes) {
        try {
          const syncRes = await fetch(`${API_BASE_URL}/vocab/sync-class`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ class_code: cls.class_code }),
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            totalNewWords += syncData.words_added || 0;
          }
        } catch (err) {
          console.error(`Error syncing class ${cls.class_code}:`, err);
        }
      }

      if (totalNewWords > 0) {
        console.log(`Synced ${totalNewWords} new words from enrolled classes`);
        fetchVocabLists();
      }
    } catch (err) {
      console.error('Error syncing enrolled classes:', err);
    }
  }

  // Fetch vocabulary lists on mount and sync enrolled classes
  useEffect(() => {
    fetchVocabLists();
    syncEnrolledClasses();
  }, [fetchVocabLists]);

  // Join a class to get pre-made vocab lists
  async function handleJoinClass() {
    if (!classCode.trim() || !token) return;
    setIsJoiningClass(true);
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/join-class`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ class_code: classCode.trim() }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.detail || 'Failed to join class');
        return;
      }
      const data = await res.json();
      alert(`Successfully joined ${data.class_name}! ${data.words_added} words added to your vocab lists.`);
      setShowJoinClass(false);
      setClassCode('');
      fetchVocabLists();
    } catch (err) {
      console.error('Error joining class:', err);
      alert('Failed to join class. Please try again.');
    } finally {
      setIsJoiningClass(false);
    }
  }

  function openLeaveClassModal() {
    setShowLeaveClass(true);
    fetchEnrolledClasses();
  }

  // Leave a class and remove all associated vocab lists
  async function handleLeaveClass(classCode: string) {
    if (!classCode || !token) return;
    setIsLeavingClass(true);
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/leave-class`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ class_code: classCode }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.detail || 'Failed to leave class');
        return;
      }
      setShowLeaveClass(false);
      setConfirmLeaveClass(null);
      fetchVocabLists();
    } catch (err) {
      console.error('Error leaving class:', err);
      alert('Failed to leave class. Please try again.');
    } finally {
      setIsLeavingClass(false);
    }
  }

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
    cleanupYouTubePlayer();
  }, [selectedVideoId, cleanupYouTubePlayer]);

  // Check if a video is from Netflix
  const isNetflixVideo = (videoId: string) => videoId.startsWith('netflix_');

  // Create/update YouTube player when card changes (skip for Netflix)
  useEffect(() => {
    const card = dueCards[currentIndex];
    if (loadState !== 'loaded' || !card) {
      cleanupYouTubePlayer();
      return;
    }

    const shouldUseYouTube = card.card_type === 'video' && card.video_id && !isNetflixVideo(card.video_id);
    if (!shouldUseYouTube || !playerContainerRef.current) {
      cleanupYouTubePlayer();
      return;
    }

    cleanupYouTubePlayer();

    const startTime = card.timestamp ?? 0;
    const endTime = (card.end_timestamp || startTime + 5) + 3;
    let isCancelled = false;

    const setupLooping = (player: any) => {
      if (loopIntervalRef.current) {
        clearInterval(loopIntervalRef.current);
      }
      loopIntervalRef.current = window.setInterval(() => {
        try {
          const currentTime = player.getCurrentTime();
          if (currentTime >= endTime) {
            player.seekTo(startTime, true);
          }
        } catch (e) {
          // Player not ready yet
        }
      }, 200);
    };

    const initPlayer = () => {
      if (isCancelled) return;
      if (!playerContainerRef.current) return;

      const playerMount = document.createElement('div');
      playerMount.className = 'w-full h-full';
      playerContainerRef.current.replaceChildren(playerMount);

      playerRef.current = new (window as any).YT.Player(playerMount, {
        videoId: card.video_id,
        playerVars: {
          start: startTime,
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

    const waitForYT = () => {
      if (isCancelled) return;
      if ((window as any).YT && (window as any).YT.Player) {
        initPlayer();
      } else {
        setTimeout(waitForYT, 100);
      }
    };

    waitForYT();

    return () => {
      isCancelled = true;
      if (loopIntervalRef.current) {
        clearInterval(loopIntervalRef.current);
      }
    };
  }, [currentIndex, loadState, dueCards, cleanupYouTubePlayer]);

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
      await fetch(`${API_BASE_URL}/subtitles/${videoId}?lang=${language}`);

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

      const rankMap: Record<string, number> = {};
      vocab.vocabulary.forEach((v: { word: string; rank: number }) => { rankMap[v.word] = v.rank; });
      let cards = (fc.flashcards || []).map((card: FlashCard) => ({
        ...card,
        card_type: 'video',
        video_id: card.video_id || videoId,
        rank: rankMap[card.target_word],
      }));

      if (videoId.startsWith('netflix_') && cards.length > 0) {
        const screenshotChecks = await Promise.all(
          cards.map((card: FlashCard) => checkScreenshotExists(videoId, card.timestamp ?? 0))
        );
        const cardsWithScreenshots = cards.filter((_: FlashCard, i: number) => screenshotChecks[i]);
        console.log(`[ClipIt] Netflix cards: ${cardsWithScreenshots.length}/${cards.length} have screenshots`);
        cards = cardsWithScreenshots;
      }

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

    const cardMap = new Map(uniqueCards.map(c => [c.dictionary_form || c.target_word, c]));
    const sortedCards = sortedWords.map(w => cardMap.get(w)!).filter(Boolean);
    const dueCardsFiltered = sortedCards.filter(c => dueWords.includes(c.dictionary_form || c.target_word));

    setCards(sortedCards);
    setDueCards(dueCardsFiltered);
    setSessionStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });

    if (dueCardsFiltered.length === 0 && sortedCards.length > 0) {
      setLoadState('session-complete');
    } else if (!session.isExtended && session.cardsReviewed >= session.sessionCap) {
      setLoadState('time-gated-complete');
    } else {
      setLoadState('loaded');
      startSession();
    }
  }, [session.cardsReviewed, session.isExtended, session.sessionCap, startSession]);

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

  // Load TTS-only flashcards from user vocabulary lists (no video required)
  const loadVocabTTSCards = useCallback(async (listId?: number) => {
    setLoadState('loading');
    setLoadingMsg('Loading your vocabulary...');
    setCards([]);
    setDueCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedVideoId(listId ? `vocablist_tts_${listId}` : 'vocablist_tts_all');
    setSelectedVideoTitle(listId
      ? vocabLists.find(l => l.id === listId)?.name || 'Vocabulary List'
      : 'My Vocabulary'
    );
    setLastRatingInfo(null);

    try {
      const url = listId
        ? `${API_BASE_URL}/vocab/lists/flashcards?list_id=${listId}&language=${language}`
        : `${API_BASE_URL}/vocab/lists/flashcards?language=${language}`;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error('Failed to fetch vocab flashcards');

      const data = await res.json();
      let ttsCards: FlashCard[] = data.flashcards.map((card: FlashCard) => ({
        ...card,
        card_type: 'tts',
        video_id: null,
        timestamp: null,
        end_timestamp: null,
      }));

      const deletedCards = getDeletedCards(language);
      ttsCards = ttsCards.filter(card => {
        const word = card.dictionary_form || card.target_word;
        return !deletedCards.has(word);
      });

      if (!ttsCards.length) {
        setLoadState('no-vocab');
        return;
      }

      prepareCardsForReview(ttsCards);
    } catch (err) {
      console.error('Failed to load vocab TTS cards:', err);
      setLoadState('error');
    }
  }, [language, token, vocabLists, prepareCardsForReview]);

  useEffect(() => {
    async function bootstrap() {
      try {
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        if (token) {
          const tzOffset = new Date().getTimezoneOffset();
          const todayRes = await fetch(`${API_BASE_URL}/fsrs/reviews/today?tz_offset_minutes=${tzOffset}`, { headers });
          if (todayRes.ok) {
            const todayData = await todayRes.json();
            setCardsReviewedToday(todayData.count || 0);
          }
        }

        const filteredRes = await fetch(`${API_BASE_URL}/videos/history/filtered?lang=${language}`, { headers });

        if (!filteredRes.ok) throw new Error();
        const filteredData = await filteredRes.json();
        const vids: TrackedVideo[] = filteredData.videos || [];
        setVideos(vids);

        setLoadState('deck-select');
      } catch {
        setLoadState('error');
      }
    }
    bootstrap();
  }, [language, token, setCardsReviewedToday]);

  // Fetch per-video word counts and due counts (for the dashboard) so the deck
  // browser can show counts, and DueToday can show an aggregate due-count,
  // without doing a full flashcard-data fetch per video.
  useEffect(() => {
    if (!videos.length) return;
    let alive = true;
    setIsLoadingDue(true);
    Promise.all(
      videos.map(async (v) => {
        try {
          const res = await fetch(`${API_BASE_URL}/vocabulary/${v.video_id}?limit=20&lang=${language}`);
          if (!res.ok) return [v.video_id, 0, 0] as const;
          const data = await res.json();
          const words: string[] = (data.vocabulary || []).map((w: { word: string }) => w.word);
          const deleted = getDeletedCards(language);
          const remaining = words.filter((w) => !deleted.has(w));
          const due = getDueCards(remaining).length;
          return [v.video_id, data.total_words || 0, due] as const;
        } catch {
          return [v.video_id, 0, 0] as const;
        }
      }),
    ).then((entries) => {
      if (!alive) return;
      setWordCounts(Object.fromEntries(entries.map(([id, count]) => [id, count])));
      setDueCounts(Object.fromEntries(entries.map(([id, , due]) => [id, due])));
      setIsLoadingDue(false);
    });
    return () => { alive = false; };
  }, [videos, language]);

  const currentCard = dueCards[currentIndex];
  const deckProgressTotal = dueCards.length;
  const deckProgressReviewed = Math.min(session.sessionReviewed, deckProgressTotal);
  const dailyGoalReviewed = Math.min(session.cardsReviewed, session.sessionCap);

  // Handle rating a card
  function handleRating(rating: Rating) {
    if (!currentCard) return;

    const startTs = currentCard.timestamp ?? 0;
    const clipDuration = currentCard.video_id
      ? (currentCard.end_timestamp || startTs + 5) - startTs + 3
      : 5;
    const { nextDue } = rateCard(currentCard.dictionary_form || currentCard.target_word, rating, clipDuration);
    const nextDueStr = formatNextReview(nextDue);
    const reviewedWord = currentCard.dictionary_form || currentCard.target_word;

    if (token) {
      fetch(`${API_BASE_URL}/fsrs/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          word: reviewedWord,
          language,
          rating,
          clip_duration: clipDuration,
          reviewed_at: new Date().toISOString(),
        }),
      })
        .then((response) => {
          if (!response.ok || !user) return;
          queryClient.removeQueries({ queryKey: queryKeys.homeQueue(user.id, language) });
          queryClient.removeQueries({ queryKey: queryKeys.reviews(user.id) });
        })
        .catch((error) => {
          console.error('Failed to record review history:', error);
        });
    }

    const capJustReached = recordCardReview();

    const ratingKey = rating === Rating.Again ? 'again'
      : rating === Rating.Hard ? 'hard'
      : rating === Rating.Good ? 'good'
      : 'easy';
    setSessionStats(prev => ({
      ...prev,
      reviewed: prev.reviewed + 1,
      [ratingKey]: prev[ratingKey] + 1,
    }));

    setLastRatingInfo({ word: reviewedWord, nextDue: nextDueStr });
    setIsFlipped(false);

    setTimeout(() => {
      if (capJustReached) {
        setLoadState('time-gated-complete');
        endSession();
        return;
      }

      if (currentIndex < dueCards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setLoadState('session-complete');
        endSession();
      }
      setLastRatingInfo(null);
    }, 300);
  }

  // 1-4 keyboard shortcuts for rating, matching the hints shown on RatingBar.
  useEffect(() => {
    if (loadState !== 'loaded' || !currentCard || isEditingDefinition || showDeleteConfirm) return;
    const keyToRating: Record<string, Rating> = {
      '1': Rating.Again,
      '2': Rating.Hard,
      '3': Rating.Good,
      '4': Rating.Easy,
    };
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const rating = keyToRating[e.key];
      if (rating !== undefined) {
        e.preventDefault();
        handleRating(rating);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

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

    const newDueCards = dueCards.filter((_, i) => i !== currentIndex);
    const newCards = cards.filter(c => (c.dictionary_form || c.target_word) !== word);
    setCards(newCards);
    setDueCards(newDueCards);

    if (currentIndex >= newDueCards.length && newDueCards.length > 0) {
      setCurrentIndex(newDueCards.length - 1);
    } else if (newDueCards.length === 0) {
      setLoadState('session-complete');
    }

    setIsFlipped(false);

    try {
      await fetch(`${API_BASE_URL}/fsrs/cards/${encodeURIComponent(word)}?language=${language}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (error) {
      console.error('Failed to delete card from server:', error);
    }
  }

  // Revert video card back to TTS-only
  async function handleRevertToTTS() {
    if (!currentCard || currentCard.card_type !== 'video') return;
    setIsReverting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/words/revert-to-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          word: currentCard.target_word,
          language: language,
        }),
      });
      if (res.ok) {
        setDueCards(prev => prev.map(c =>
          c.target_word === currentCard.target_word
            ? { ...c, card_type: 'tts', video_id: null, sentence: null, sentence_translation: null }
            : c
        ));
      }
    } catch (error) {
      console.error('Failed to revert card to TTS:', error);
    } finally {
      setIsReverting(false);
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

  // Delete all flashcards for a specific video and remove from watch history
  async function handleDeleteVideoFlashcards(video: TrackedVideo) {
    try {
      const flashcardsRes = await fetch(
        `${API_BASE_URL}/fsrs/cards/video/${encodeURIComponent(video.video_id)}?language=${language}`,
        {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      await fetch(
        `${API_BASE_URL}/videos/${encodeURIComponent(video.video_id)}`,
        {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (flashcardsRes.ok) {
        const newCards = cards.filter(c => c.video_id !== video.video_id);
        const newDueCards = dueCards.filter(c => c.video_id !== video.video_id);
        setCards(newCards);
        setDueCards(newDueCards);

        const newVideos = videos.filter(v => v.video_id !== video.video_id);
        setVideos(newVideos);

        if (selectedVideoId === video.video_id) {
          setSelectedVideoId('all');
          setSelectedVideoTitle('All Videos');
        }
      }
    } catch (error) {
      console.error('Failed to delete video flashcards:', error);
    }
  }

  // Go back to deck selection
  async function handleBackToDecks() {
    cleanupYouTubePlayer();

    setCards([]);
    setDueCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedVideoId('');
    setSelectedVideoTitle('');
    resetSession();

    try {
      setLoadState('loading');
      setLoadingMsg('Loading decks...');
      const res = await fetch(`${API_BASE_URL}/videos/history/filtered?lang=${language}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const vids: TrackedVideo[] = data.videos || [];
      setVideos(vids);
      setLoadState('deck-select');
    } catch {
      setLoadState('error');
    }
  }

  const currentStats = currentCard ? getCardStats(currentCard.dictionary_form || currentCard.target_word) : null;
  const previewTimes = currentCard ? previewNextReviews(currentCard.dictionary_form || currentCard.target_word) : null;

  // ── Loading (skeleton mirrors the review layout) ──────────────
  if (loadState === 'loading') {
    return (
      <div className="min-h-[calc(100vh-4rem)] max-w-3xl mx-auto px-4 sm:px-6 pt-8 bg-white">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>

        <div className="bg-sand-tint rounded-2xl p-5 mb-8">
          <Skeleton className="h-4 w-44 rounded mb-3" />
          <div className="flex gap-3">
            <Skeleton className="flex-1 h-14 rounded-xl" />
            <Skeleton className="w-24 h-14 rounded-xl" />
          </div>
          <Skeleton className="h-4 w-56 rounded mt-3" />
        </div>

        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        <Skeleton className="h-12 w-full rounded-xl mb-4" />

        <div className="flex gap-2 mb-5">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-14 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>

        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-sand-tint rounded-xl p-5 flex items-center gap-5">
              <Skeleton className="w-32 h-[72px] rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3 rounded" />
                <Skeleton className="h-3 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (loadState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-white">
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <p className="text-sand-deep font-semibold">Couldn't load flashcards</p>
        <p className="text-sand-ink text-sm text-center max-w-sm">
          Make sure the ClipIt server is running and accessible.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-5 py-2.5 rounded-xl bg-sand-ink text-white text-sm font-semibold hover:bg-sand-deep transition-colors">
          Try again
        </button>
      </div>
    );
  }

  // ── Dashboard (deck selection) ─────────────────────────────────
  if (loadState === 'deck-select') {
    const hasNoVideos = videos.length === 0;
    return (
      <div className="min-h-screen pb-20 max-w-3xl mx-auto px-4 sm:px-6 pt-8 bg-white">
        <div className="mb-8">
          <button
            onClick={() => onNavigate?.('practice')}
            aria-label="Back to Practice"
            className="mb-4 w-9 h-9 flex items-center justify-center rounded-lg text-sand-ink hover:text-sand-deep hover:bg-sand-soft transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-4xl font-heading font-medium text-sand-deep mb-2" id="section-deck-select">Flash Cards</h1>
          <p className="text-sand-ink">
            {hasNoVideos ? "You haven't watched any videos yet." : 'Select a deck to start reviewing flashcards.'}
          </p>
        </div>

        {hasNoVideos ? (
          <div className="flex flex-col items-center gap-5 py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-sand-soft flex items-center justify-center">
              <Tv className="w-8 h-8 text-sand-ink" />
            </div>
            <p className="text-sand-ink text-sm max-w-sm">
              Install the Clip It extension, then watch something on YouTube or Netflix — we'll turn the words you hear into flashcards.
            </p>
            <a
              href="https://chromewebstore.google.com/detail/clipit/pcnnmkbacmcfldjgmaljkjdnfijkkokn"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full max-w-xs px-6 py-3 bg-sand-ink hover:bg-sand-deep text-[#ffffff] font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Tv className="w-5 h-5" />
              Get Clip It Extension
            </a>
          </div>
        ) : (
          <>
            {videos.length > 0 && (
              <div className="mb-8">
                <DueToday
                  videos={videos}
                  dueCounts={dueCounts}
                  isLoadingDue={isLoadingDue}
                  onStartAll={() => loadAllVideos(videos)}
                />
              </div>
            )}

            <DeckBrowser
              videos={videos}
              wordCounts={wordCounts}
              vocabLists={vocabLists}
              language={language}
              onStudyVideo={loadFlashcards}
              onStudyVocabList={loadVocabTTSCards}
              onStudyAllVideos={() => loadAllVideos(videos)}
              onDeleteVideo={handleDeleteVideoFlashcards}
            />

            <div className="mt-10 text-center">
              <p className="text-sand-ink text-sm mb-4">Want to add more?</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setShowJoinClass(true)}
                  className="px-4 py-2 bg-white border border-sand-mid hover:border-sand-ink text-sand-ink hover:text-sand-deep font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
                >
                  <BookOpen className="w-4 h-4" />
                  Join Another Class
                </button>
                {vocabLists.length > 0 && (
                  <button
                    onClick={() => openLeaveClassModal()}
                    className="px-4 py-2 bg-white border border-sand-mid hover:border-red-400 text-sand-ink hover:text-red-500 font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    Leave a Class
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Join Class Modal */}
        <AnimatePresence>
          {showJoinClass && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
              onClick={() => !isJoiningClass && setShowJoinClass(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-sand-soft mx-auto mb-4">
                  <BookOpen className="w-6 h-6 text-sand-ink" />
                </div>
                <h3 className="text-lg font-bold text-sand-deep text-center mb-2">Join a Class</h3>
                <p className="text-sm text-sand-ink text-center mb-4">
                  Enter your class code to get pre-made vocab lists from your instructor.
                </p>
                <input
                  type="text"
                  placeholder="Enter class code"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && classCode.trim() && handleJoinClass()}
                  className="w-full bg-white border border-sand-mid rounded-xl px-4 py-3 text-sm text-sand-deep placeholder:text-sand-ink/60 focus:outline-none focus:ring-2 focus:ring-sand-ink/40 mb-4 uppercase"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowJoinClass(false); setClassCode(''); }}
                    disabled={isJoiningClass}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-sand-soft text-sand-deep font-medium hover:bg-sand-mid transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleJoinClass}
                    disabled={!classCode.trim() || isJoiningClass}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-sand-ink text-white font-medium hover:bg-sand-deep transition-colors disabled:opacity-50"
                  >
                    {isJoiningClass ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Leave Class Modal */}
        <AnimatePresence>
          {showLeaveClass && !confirmLeaveClass && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
              onClick={() => !isLeavingClass && setShowLeaveClass(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                  <LogOut className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-sand-deep text-center mb-2">Leave a Class</h3>
                <p className="text-sm text-sand-ink text-center mb-4">
                  Select a class to leave. This will remove all vocab lists from that class.
                </p>
                {isLoadingEnrolled ? (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 rounded-full border-2 border-sand-mid border-t-sand-ink animate-spin" />
                  </div>
                ) : enrolledClasses.length === 0 ? (
                  <p className="text-sand-ink text-sm text-center py-4">You're not enrolled in any classes.</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {enrolledClasses.map((cls) => (
                      <button
                        key={cls.class_code}
                        onClick={() => setConfirmLeaveClass(cls)}
                        className="w-full px-4 py-3 bg-sand-tint border border-sand-mid/60 hover:border-red-400 rounded-xl text-left transition-colors group"
                      >
                        <div className="font-medium text-sand-deep group-hover:text-red-500">{cls.class_name}</div>
                        <div className="text-xs text-sand-ink">{cls.lists_count} lists · {cls.words_count} words</div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowLeaveClass(false)}
                  className="w-full px-4 py-2.5 rounded-xl bg-sand-soft text-sand-deep font-medium hover:bg-sand-mid transition-colors"
                >
                  Cancel
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm Leave Class Modal */}
        <AnimatePresence>
          {confirmLeaveClass && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
              onClick={() => !isLeavingClass && setConfirmLeaveClass(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-sand-deep text-center mb-2">Are you sure?</h3>
                <p className="text-sm text-sand-ink text-center mb-4">
                  This will remove all vocab lists from <span className="text-sand-deep font-medium">{confirmLeaveClass.class_name}</span>. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmLeaveClass(null)}
                    disabled={isLeavingClass}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-sand-soft text-sand-deep font-medium hover:bg-sand-mid transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleLeaveClass(confirmLeaveClass.class_code)}
                    disabled={isLeavingClass}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLeavingClass ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Leaving...
                      </>
                    ) : (
                      'Leave Class'
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

  // ── No vocab ─────────────────────────────────────────────────
  if (loadState === 'no-vocab') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-white">
        <div className="w-14 h-14 rounded-full bg-sand-soft flex items-center justify-center text-3xl">
          {language === 'uk' ? '🇺🇦' : language === 'en' ? '🇬🇧' : '🈚'}
        </div>
        <p className="text-sand-deep font-semibold">No common {languageName} words found</p>
        <p className="text-sand-ink text-sm text-center max-w-sm">
          {selectedVideoId === 'all'
            ? `None of the tracked videos had ${languageName} words matching the frequency list.`
            : `No ${languageName} words from the frequency list were found in this video.`}
        </p>
        <div className="flex gap-3 mt-2">
          {videos.length > 1 && selectedVideoId !== 'all' && (
            <button
              onClick={() => loadAllVideos(videos)}
              className="px-5 py-2.5 rounded-xl bg-sand-ink text-white text-sm font-semibold hover:bg-sand-deep transition-colors">
              Try all videos
            </button>
          )}
          <button
            onClick={handleBackToDecks}
            className="px-5 py-2.5 rounded-xl bg-sand-soft text-sand-deep text-sm font-semibold hover:bg-sand-mid transition-colors">
            Back to Decks
          </button>
        </div>
      </div>
    );
  }

  // ── Time-Gated Complete (daily goal reached) ────────────────
  if (loadState === 'time-gated-complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <SessionSummary
          variant="goal-reached"
          stats={sessionStats}
          goalLabel={getGoalLabel()}
          onReviewAgain={() => {}}
          onBackToDecks={() => {
            resetSession();
            setLoadState('session-complete');
          }}
          onKeepReviewing={() => {
            extendSession();
            setLoadState('loaded');
          }}
        />
      </div>
    );
  }

  // ── Session Complete ─────────────────────────────────────────
  if (loadState === 'session-complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <SessionSummary
          variant="complete"
          stats={sessionStats}
          onReviewAgain={() => {
            resetSession();
            setCurrentIndex(0);
            setDueCards(cards);
            setSessionStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
            setLoadState('loaded');
            startSession();
          }}
          onBackToDecks={handleBackToDecks}
        />
      </div>
    );
  }

  // ── Loaded ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center max-w-md mx-auto px-4 py-8 md:py-10 bg-white">
      <HelpOverlay tips={flashcardsPageTips} />

      {/* Header stats */}
      <div className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 mb-5">
        <button
          onClick={() => handleBackToDecks()}
          aria-label="Back to decks"
          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-sand-ink hover:text-sand-deep hover:bg-sand-soft transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div id="section-deck-select" className="min-w-0">
          <h1 className="text-xl font-heading font-medium text-sand-deep">Daily Review</h1>
          <button
            type="button"
            onClick={() => handleBackToDecks()}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 text-xs text-sand-ink hover:text-sand-deep transition-colors mt-0.5 group cursor-pointer w-full max-w-full">
            {selectedVideoId === 'all' ? (
              <>
                <Layers className="w-3 h-3 shrink-0 mr-0.5" />
                <span className="truncate min-w-0">All Videos</span>
              </>
            ) : selectedVideoId.startsWith('vocablist_') ? (
              <>
                <BookOpen className="w-3 h-3 shrink-0 mr-0.5" />
                <span className="truncate min-w-0">{selectedVideoTitle}</span>
              </>
            ) : (
              <>
                <span className="w-3 h-3 mr-0.5" />
                <span className="truncate min-w-0">{selectedVideoTitle}</span>
              </>
            )}
            <span className="text-sand-ink/70 whitespace-nowrap">· Change deck</span>
          </button>
        </div>
        <div className="text-right shrink-0 w-[112px]">
          {session.isExtended ? (
            <>
              <div className="text-2xl font-bold text-sand-ink">
                {Math.max(0, deckProgressTotal - currentIndex)}
                <span className="text-sand-ink/60 text-lg"> left</span>
              </div>
              <div className="text-xs text-sand-ink mt-1">
                Today: {dailyGoalReviewed} / {session.sessionCap}
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-sand-ink">
                {deckProgressReviewed}
                <span className="text-sand-ink/60 text-lg"> / {deckProgressTotal}</span>
              </div>
              <div className="w-24 h-1.5 bg-sand-soft rounded-full mt-1.5 overflow-hidden">
                <motion.div
                  className="h-full bg-sand-ink"
                  animate={{ width: `${deckProgressTotal ? Math.min(100, (deckProgressReviewed / deckProgressTotal) * 100) : 0}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <div className="text-xs text-sand-ink mt-1">
                Today: {dailyGoalReviewed} / {session.sessionCap}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Flashcard */}
      {currentCard && (
        <div id="section-flashcard" className="w-full">
          <ReviewCard
            card={currentCard}
            stats={currentStats}
            language={language}
            isFlipped={isFlipped}
            onFlip={() => setIsFlipped((v) => !v)}
            playerContainerRef={playerContainerRef}
            onRevertToTTS={handleRevertToTTS}
            isReverting={isReverting}
            onDeleteCard={handleDeleteCard}
            isEditingDefinition={isEditingDefinition}
            editedDefinition={editedDefinition}
            onStartEdit={handleStartEditDefinition}
            onChangeEditedDefinition={setEditedDefinition}
            onSaveDefinition={handleSaveDefinition}
            onCancelEdit={() => setIsEditingDefinition(false)}
            onPlaySentenceTTS={playTTS}
          />
        </div>
      )}

      {/* Last rating feedback */}
      <AnimatePresence>
        {lastRatingInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 px-4 py-2 rounded-lg bg-sand-tint border border-sand-mid/60 text-xs text-sand-ink flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-sand-ink" />
            Next review for "{lastRatingInfo.word}" in {lastRatingInfo.nextDue}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div id="section-rating-buttons" className="mt-8 w-full">
        <RatingBar previewTimes={previewTimes} onRate={handleRating} />
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-sand-deep text-center mb-2">Delete Flashcard?</h3>
              <p className="text-sm text-sand-ink text-center mb-6">
                Remove this flashcard? The word can reappear with a new clip when you watch more content.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-sand-soft text-sand-deep font-medium hover:bg-sand-mid transition-colors"
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
    </div>
  );
}
