import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
declare function gtag(...args: unknown[]): void;
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '../components/Skeleton';
import {
  AlertCircle,
  Tv,
  Clock,
  Trash2,
} from 'lucide-react';
import { rateCard, sortByPriority, getDueCards, getCardStats, previewNextReviews, Rating } from '../services/fsrs';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useReviewSession } from '../context/ReviewSessionContext';
import { API_BASE_URL } from '../config';
import { HelpOverlay, HelpTip } from '../components/HelpOverlay';
import { queryClient } from '../lib/queryClient';
import { historyQueryOptions, queryKeys, videoVocabularyQueryOptions } from '../lib/queries';
import { mapWithConcurrency } from '../lib/network';
import { FlashCard, TrackedVideo, LoadState, Page } from '../types/flashcards';
import { getDeletedCards, formatNextReview } from '../utils/flashcardStorage';
import { DueToday } from '../components/flashcards/DueToday';
import { DeckBrowser } from '../components/flashcards/DeckBrowser';
import { ReviewCard } from '../components/flashcards/ReviewCard';
import { RatingBar } from '../components/flashcards/RatingBar';
import { SessionSummary } from '../components/flashcards/SessionSummary';
import { NavigationIconButton } from '../components/NavigationIconButton';

const flashcardsPageTips: HelpTip[] = [
  {
    id: 'deck-select',
    text: 'Your progress through this session. Tap the X or press Esc to leave anytime.',
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

interface FlashcardsDashboard {
  cardsReviewedToday: number;
  videos: TrackedVideo[];
  wordCounts: Record<string, number>;
  dueCounts: Record<string, number>;
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
  const dashboardKey = useMemo(
    () => queryKeys.flashcardDashboard(user?.id ?? 0, language),
    [language, user?.id],
  );
  const cachedDashboard = queryClient.getQueryData<FlashcardsDashboard>(dashboardKey);
  const [loadState, setLoadState] = useState<LoadState>(() => (cachedDashboard ? 'deck-select' : 'loading'));
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [dueCards, setDueCards] = useState<FlashCard[]>([]);
  const [videos, setVideos] = useState<TrackedVideo[]>(() => cachedDashboard?.videos ?? []);
  const [wordCounts, setWordCounts] = useState<Record<string, number>>(() => cachedDashboard?.wordCounts ?? {}); // video_id -> # words
  const [dueCounts, setDueCounts] = useState<Record<string, number>>(() => cachedDashboard?.dueCounts ?? {}); // video_id -> # due cards
  const [isLoadingDue, setIsLoadingDue] = useState(() => !cachedDashboard);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [lastRatingInfo, setLastRatingInfo] = useState<{ word: string; nextDue: string } | null>(null);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
  const [isEditingDefinition, setIsEditingDefinition] = useState(false);
  const [editedDefinition, setEditedDefinition] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [isStreamingCards, setIsStreamingCards] = useState(false);
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const loopIntervalRef = useRef<number | null>(null);
  const streamedCardKeysRef = useRef(new Set<string>());
  const streamedDueKeysRef = useRef(new Set<string>());
  const streamedSessionStartedRef = useRef(false);

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

  useEffect(() => {
    gtag('event', 'conversion', {
      'send_to': 'AW-18115152337/s3QjCOHmyqEcENGT_b1D',
      'value': 0,
      'currency': 'USD'
    });
  }, []);

  // The review session's layout is sized to fit the viewport exactly (see
  // the 'loaded' render below) — force the page itself to never scroll so a
  // few pixels of measurement slack can't reintroduce a scrollbar.
  useEffect(() => {
    if (loadState !== 'loaded') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [loadState]);

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

  // Pause the clip when the card flips to its back face — the video shouldn't
  // keep playing behind a definition the user is now reading.
  useEffect(() => {
    if (!isFlipped || !playerRef.current) return;
    try {
      playerRef.current.pauseVideo();
    } catch {
      // Player not ready yet
    }
  }, [isFlipped]);

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
    return queryClient.fetchQuery({
      queryKey: queryKeys.flashcardDeck(user?.id ?? 0, language, videoId),
      // Raw card payloads remain valid until a card/video mutation changes them.
      staleTime: Infinity,
      queryFn: async () => {
        try {
          await fetch(`${API_BASE_URL}/subtitles/${videoId}?lang=${language}`);

          const vocab = await queryClient.fetchQuery(
            videoVocabularyQueryOptions(user?.id ?? 0, token ?? '', language, videoId),
          );
          if (!vocab.totalWords) return [];

          const wordList = vocab.words;
          const fcRes = await fetch(`${API_BASE_URL}/flashcard-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ video_id: videoId, words: wordList, word_source: 'essential', language }),
          });
          if (!fcRes.ok) return [];
          const fc = await fcRes.json();

          const rankMap: Record<string, number> = {};
          let cards = (fc.flashcards || []).map((card: FlashCard) => ({
            ...card,
            card_type: 'video' as const,
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
      },
    });
  }, [language, token, user?.id]);

  // Read the streaming endpoint as Server-Sent Events. Cards are added to the
  // active review queue one by one instead of waiting for every translation in
  // a video to finish.
  const streamCardsForVideo = useCallback(async (
    videoId: string,
    onCard: (card: FlashCard) => void,
  ): Promise<FlashCard[]> => {
    await fetch(`${API_BASE_URL}/subtitles/${videoId}?lang=${language}`);

    const vocab = await queryClient.fetchQuery(
      videoVocabularyQueryOptions(user?.id ?? 0, token ?? '', language, videoId),
    );
    if (!vocab.totalWords) return [];
    const response = await fetch(`${API_BASE_URL}/flashcard-data/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: videoId,
        words: vocab.words,
        word_source: 'essential',
        language,
      }),
    });
    if (!response.ok || !response.body) throw new Error('Flashcard stream unavailable');

    const cards: FlashCard[] = [];
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = '';

    const handleEvent = async (rawEvent: string) => {
      const lines = rawEvent.split('\n');
      const type = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
      const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
      if (type === 'error') throw new Error(JSON.parse(data || '{}').detail || 'Unable to generate flashcards');
      if (type !== 'card' || !data) return;

      const rawCard = JSON.parse(data) as FlashCard;
      const card: FlashCard = {
        ...rawCard,
        card_type: 'video',
        video_id: rawCard.video_id || videoId,
      };
      if (videoId.startsWith('netflix_') && !await checkScreenshotExists(videoId, card.timestamp ?? 0)) return;
      const word = card.dictionary_form || card.target_word;
      if (getDeletedCards(language).has(word)) return;

      cards.push(card);
      onCard(card);
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        const event = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        await handleEvent(event);
        separator = buffer.indexOf('\n\n');
      }
      if (done) break;
    }
    if (buffer.trim()) await handleEvent(buffer);
    return cards;
  }, [language, token, user?.id]);

  const beginProgressiveSession = useCallback(() => {
    streamedCardKeysRef.current = new Set();
    streamedDueKeysRef.current = new Set();
    streamedSessionStartedRef.current = false;
    setCards([]);
    setDueCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
    setIsStreamingCards(true);
    setLoadState('loading');
  }, []);

  const appendStreamedCard = useCallback((card: FlashCard) => {
    const word = card.dictionary_form || card.target_word;
    if (streamedCardKeysRef.current.has(word)) return;
    streamedCardKeysRef.current.add(word);
    setCards((current) => [...current, card]);

    if (!getDueCards([word]).includes(word) || streamedDueKeysRef.current.has(word)) return;
    streamedDueKeysRef.current.add(word);
    setDueCards((current) => [...current, card]);
    if (!streamedSessionStartedRef.current) {
      streamedSessionStartedRef.current = true;
      setLoadState('loaded');
      startSession();
    }
  }, [startSession]);

  const finishProgressiveSession = useCallback((loadedCards: FlashCard[]) => {
    setIsStreamingCards(false);
    if (!loadedCards.length) {
      setLoadState('no-vocab');
    } else if (!streamedSessionStartedRef.current) {
      setLoadState('session-complete');
    }
  }, []);

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
    window.history.replaceState({}, '', `${window.location.pathname}?video=all`);
    setCards([]);
    setDueCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedVideoId('all');
    setLastRatingInfo(null);

    const cachedDecks = videoList.map((video) =>
      queryClient.getQueryData<FlashCard[]>(queryKeys.flashcardDeck(user?.id ?? 0, language, video.video_id)),
    );
    if (cachedDecks.every((deck): deck is FlashCard[] => deck !== undefined)) {
      const cachedCards = cachedDecks.flat();
      if (!cachedCards.length) {
        setLoadState('no-vocab');
      } else {
        prepareCardsForReview(cachedCards);
      }
      return;
    }

    beginProgressiveSession();
    const allCards: FlashCard[] = [];
    for (const video of videoList) {
      let videoCards: FlashCard[];
      try {
        videoCards = await streamCardsForVideo(video.video_id, appendStreamedCard);
      } catch {
        // Older deployments can still serve the bulk endpoint. Fall back to it
        // without delaying the session when streaming is available.
        videoCards = await fetchCardsForVideo(video.video_id);
        videoCards.forEach(appendStreamedCard);
      }
      allCards.push(...videoCards);
      queryClient.setQueryData(queryKeys.flashcardDeck(user?.id ?? 0, language, video.video_id), videoCards);
    }

    finishProgressiveSession(allCards);
  }, [appendStreamedCard, beginProgressiveSession, fetchCardsForVideo, finishProgressiveSession, language, prepareCardsForReview, streamCardsForVideo, user?.id]);

  // Load cards for a single video.
  const loadFlashcards = useCallback(async (videoId: string) => {
    window.history.replaceState({}, '', `${window.location.pathname}?video=${encodeURIComponent(videoId)}`);
    setCards([]);
    setDueCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedVideoId(videoId);
    setLastRatingInfo(null);

    const cachedCards = queryClient.getQueryData<FlashCard[]>(
      queryKeys.flashcardDeck(user?.id ?? 0, language, videoId),
    );
    if (cachedCards !== undefined) {
      if (!cachedCards.length) {
        setLoadState('no-vocab');
      } else {
        prepareCardsForReview(cachedCards);
      }
      return;
    }

    beginProgressiveSession();
    let videoCards: FlashCard[];
    try {
      videoCards = await streamCardsForVideo(videoId, appendStreamedCard);
    } catch {
      videoCards = await fetchCardsForVideo(videoId);
      videoCards.forEach(appendStreamedCard);
    }
    queryClient.setQueryData(queryKeys.flashcardDeck(user?.id ?? 0, language, videoId), videoCards);
    finishProgressiveSession(videoCards);
  }, [appendStreamedCard, beginProgressiveSession, fetchCardsForVideo, finishProgressiveSession, language, prepareCardsForReview, streamCardsForVideo, user?.id]);

  const applyDashboard = useCallback((dashboard: FlashcardsDashboard) => {
    setCardsReviewedToday(dashboard.cardsReviewedToday);
    setVideos(dashboard.videos);
    setWordCounts(dashboard.wordCounts);
    setDueCounts(dashboard.dueCounts);
    setIsLoadingDue(false);
    setLoadState((current) => (current === 'loading' || current === 'error' ? 'deck-select' : current));
  }, [setCardsReviewedToday]);

  const fetchDashboard = useCallback(async (): Promise<FlashcardsDashboard> => {
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const tzOffset = new Date().getTimezoneOffset();
    const [todayRes, vids] = await Promise.all([
      token
        ? fetch(`${API_BASE_URL}/fsrs/reviews/today?tz_offset_minutes=${tzOffset}`, { headers })
        : Promise.resolve(null),
      queryClient.ensureQueryData(historyQueryOptions(user?.id ?? 0, token ?? '', language)),
    ]);

    const [todayData] = await Promise.all([
      todayRes?.ok ? todayRes.json() : Promise.resolve({ count: 0 }),
    ]);
    const counts = await mapWithConcurrency(vids, 2, async (video) => {
        try {
          const data = await queryClient.fetchQuery(
            videoVocabularyQueryOptions(user?.id ?? 0, token ?? '', language, video.video_id),
          );
          const deleted = getDeletedCards(language);
          const remaining = data.words.filter((word) => !deleted.has(word));
          return [video.video_id, data.totalWords, getDueCards(remaining).length] as const;
        } catch {
          return [video.video_id, 0, 0] as const;
        }
      });

    return {
      cardsReviewedToday: todayData.count || 0,
      videos: vids,
      wordCounts: Object.fromEntries(counts.map(([id, count]) => [id, count])),
      dueCounts: Object.fromEntries(counts.map(([id, , due]) => [id, due])),
    };
  }, [language, token, user?.id]);

  useEffect(() => {
    let alive = true;
    const cached = queryClient.getQueryData<FlashcardsDashboard>(dashboardKey);
    if (cached) {
      applyDashboard(cached);
    } else {
      setLoadState('loading');
      setIsLoadingDue(true);
    }

    void queryClient.fetchQuery({
      queryKey: dashboardKey,
      queryFn: fetchDashboard,
      // Cached data renders immediately; this only refreshes it in the background.
      staleTime: 60_000,
    }).then(
      (dashboard) => {
        if (alive) applyDashboard(dashboard);
      },
      () => {
        if (alive && !cached) setLoadState('error');
      },
    );

    return () => { alive = false; };
  }, [applyDashboard, dashboardKey, fetchDashboard]);

  // Resume a review session across a refresh: loadAllVideos/loadFlashcards write
  // ?video=<id|all> to the URL when a session starts, and handleBackToDecks
  // clears it. Runs once, right after bootstrap lands on the dashboard.
  const hasResumedFromUrl = useRef(false);
  useEffect(() => {
    if (hasResumedFromUrl.current || loadState !== 'deck-select') return;
    hasResumedFromUrl.current = true;

    const resumeVideoId = new URLSearchParams(window.location.search).get('video');
    if (!resumeVideoId) return;
    if (resumeVideoId === 'all') {
      void loadAllVideos(videos);
    } else {
      void loadFlashcards(resumeVideoId);
    }
  }, [loadState, videos, loadAllVideos, loadFlashcards]);

  const currentCard = dueCards[currentIndex];
  const deckProgressTotal = dueCards.length;
  const deckProgressReviewed = Math.min(session.sessionReviewed, deckProgressTotal);

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
          // Keep the visible dashboard instant, but make its due counts fresh
          // the next time it is shown.
          queryClient.invalidateQueries({ queryKey: dashboardKey });
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
      } else if (isStreamingCards) {
        // The current card was the end of the queue for now. Advance to the
        // next slot; it will render as soon as the stream appends another card.
        setCurrentIndex(prev => prev + 1);
      } else {
        setLoadState('session-complete');
        endSession();
      }
      setLastRatingInfo(null);
    }, 300);
  }

  // Space/Enter to flip, Esc to leave, 1-4 to rate once revealed.
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

      if (e.key === 'Escape') {
        e.preventDefault();
        handleBackToDecks();
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setIsFlipped((v) => !v);
        return;
      }
      if (isFlipped) {
        const rating = keyToRating[e.key];
        if (rating !== undefined) {
          e.preventDefault();
          handleRating(rating);
        }
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

    if (currentCard.video_id) {
      queryClient.setQueryData<FlashCard[]>(
        queryKeys.flashcardDeck(user?.id ?? 0, language, currentCard.video_id),
        (cached) => cached?.filter((card) => (card.dictionary_form || card.target_word) !== word),
      );
    }
    queryClient.invalidateQueries({ queryKey: dashboardKey });

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
        const toTts = (card: FlashCard) =>
          card.target_word === currentCard.target_word
            ? { ...card, card_type: 'tts' as const, video_id: null, sentence: null, sentence_translation: null }
            : card;
        setCards((prev) => prev.map(toTts));
        setDueCards((prev) => prev.map(toTts));
        if (currentCard.video_id) {
          queryClient.setQueryData<FlashCard[]>(
            queryKeys.flashcardDeck(user?.id ?? 0, language, currentCard.video_id),
            (cached) => cached?.map(toTts),
          );
        }
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
        if (currentCard.video_id) {
          queryClient.setQueryData<FlashCard[]>(
            queryKeys.flashcardDeck(user?.id ?? 0, language, currentCard.video_id),
            (cached) => cached?.map(updateCardDefinition),
          );
        }
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
        queryClient.removeQueries({ queryKey: queryKeys.flashcardDeck(user?.id ?? 0, language, video.video_id) });
        queryClient.setQueryData<FlashcardsDashboard>(dashboardKey, (cached) => {
          if (!cached) return cached;
          const { [video.video_id]: _wordCount, ...nextWordCounts } = cached.wordCounts;
          const { [video.video_id]: _dueCount, ...nextDueCounts } = cached.dueCounts;
          return {
            ...cached,
            videos: cached.videos.filter((item) => item.video_id !== video.video_id),
            wordCounts: nextWordCounts,
            dueCounts: nextDueCounts,
          };
        });

        if (selectedVideoId === video.video_id) {
          setSelectedVideoId('all');
        }
      }
    } catch (error) {
      console.error('Failed to delete video flashcards:', error);
    }
  }

  // Go back to deck selection
  async function handleBackToDecks() {
    cleanupYouTubePlayer();
    window.history.replaceState({}, '', window.location.pathname);

    setCards([]);
    setDueCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedVideoId('');
    resetSession();

    const cached = queryClient.getQueryData<FlashcardsDashboard>(dashboardKey);
    if (cached) {
      applyDashboard(cached);
      setLoadState('deck-select');
      // Refresh silently after the dashboard is visible, so returning from a
      // session never swaps the review card for a loading screen.
      void queryClient.fetchQuery({ queryKey: dashboardKey, queryFn: fetchDashboard, staleTime: 0 })
        .then(applyDashboard)
        .catch(() => {});
      return;
    }

    try {
      setLoadState('loading');
      const dashboard = await queryClient.fetchQuery({ queryKey: dashboardKey, queryFn: fetchDashboard });
      applyDashboard(dashboard);
      setLoadState('deck-select');
    } catch {
      setLoadState('error');
    }
  }

  const currentStats = currentCard ? getCardStats(currentCard.dictionary_form || currentCard.target_word) : null;
  const previewTimes = currentCard ? previewNextReviews(currentCard.dictionary_form || currentCard.target_word) : null;

  // ── Loading (skeleton reserved for major sections only) ────────
  if (loadState === 'loading') {
    // Loading flashcards for a specific deck/review session looks like the card
    // it's about to become, not like the dashboard it just left.
    if (selectedVideoId) {
      return (
        <div className="min-h-screen flex flex-col items-center max-w-page mx-auto px-5 py-6 sm:px-8 bg-app">
          <Skeleton className="h-[34rem] w-full max-w-[22rem] rounded-2xl" />
          <p className="mt-5 text-body-sm text-muted" role="status">Loading your flashcards…</p>
        </div>
      );
    }
    return (
      <div className="min-h-[calc(100vh-4rem)] max-w-page mx-auto px-4 sm:px-8 pt-8 bg-app">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="mt-8 h-72 rounded-2xl" />
        <p className="mt-5 text-body-sm text-muted" role="status">Loading your flashcards…</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (loadState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-app">
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <p className="text-primary font-semibold">Couldn't load flashcards</p>
        <p className="text-secondary text-sm text-center max-w-sm">
          Make sure the ClipIt server is running and accessible.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-5 py-2.5 rounded-xl bg-accent text-on-accent text-sm font-semibold hover:bg-accent-hover transition-colors">
          Try again
        </button>
      </div>
    );
  }

  // ── Dashboard (deck selection) ─────────────────────────────────
  if (loadState === 'deck-select') {
    const hasNoVideos = videos.length === 0;
    return (
      <div className="mx-auto min-h-screen max-w-page px-5 pb-20 pt-8 sm:px-8 bg-app">
        <div className="-ml-2 flex items-center gap-2">
          <NavigationIconButton direction="back" label="Back" onClick={() => onNavigate?.('practice')} />

          <h1 className="font-heading text-section font-medium text-primary" id="section-deck-select">
            Flash cards
          </h1>
        </div>

        {hasNoVideos ? (
          <div className="mt-10 flex flex-col items-center gap-5 py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center">
              <Tv className="w-8 h-8 text-primary" />
            </div>
            <p className="text-secondary text-sm max-w-sm">
              You haven't watched any videos yet. Install the Clip It extension, then watch something on YouTube or
              Netflix. We'll turn the words you hear into flashcards.
            </p>
            <a
              href="https://chromewebstore.google.com/detail/clipit/pcnnmkbacmcfldjgmaljkjdnfijkkokn"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full max-w-xs px-6 py-3 bg-accent hover:bg-accent-hover text-on-accent font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Tv className="w-5 h-5" />
              Get Clip It Extension
            </a>
          </div>
        ) : (
          <>
            <div className="mt-8">
              <DueToday
                videos={videos}
                dueCounts={dueCounts}
                isLoadingDue={isLoadingDue}
                onStartAll={() => loadAllVideos(videos)}
              />
            </div>

            <div className="mt-14">
              <DeckBrowser
                videos={videos}
                wordCounts={wordCounts}
                dueCounts={dueCounts}
                onStudyVideo={loadFlashcards}
                onDeleteVideo={handleDeleteVideoFlashcards}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // ── No vocab ─────────────────────────────────────────────────
  if (loadState === 'no-vocab') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-app">
        <div className="w-14 h-14 rounded-full bg-surface-hover flex items-center justify-center text-3xl">
          {language === 'uk' ? '🇺🇦' : language === 'en' ? '🇬🇧' : '🈚'}
        </div>
        <p className="text-primary font-semibold">No common {languageName} words found</p>
        <p className="text-secondary text-sm text-center max-w-sm">
          {selectedVideoId === 'all'
            ? `None of the tracked videos had ${languageName} words matching the frequency list.`
            : `No ${languageName} words from the frequency list were found in this video.`}
        </p>
        <div className="flex gap-3 mt-2">
          {videos.length > 1 && selectedVideoId !== 'all' && (
            <button
              onClick={() => loadAllVideos(videos)}
              className="px-5 py-2.5 rounded-xl bg-accent text-on-accent text-sm font-semibold hover:bg-accent-hover transition-colors">
              Try all videos
            </button>
          )}
          <button
            onClick={handleBackToDecks}
            className="px-5 py-2.5 rounded-xl bg-surface-hover text-primary text-sm font-semibold hover:bg-blush transition-colors">
            Back to Decks
          </button>
        </div>
      </div>
    );
  }

  // ── Time-Gated Complete (daily goal reached) ────────────────
  if (loadState === 'time-gated-complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
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
      <div className="min-h-screen flex items-center justify-center bg-app">
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
    <div className="h-[calc(100vh-104px)] md:h-[calc(100vh-136px)] overflow-hidden flex flex-col items-center max-w-page mx-auto px-5 pt-4 pb-6 sm:px-8 bg-app">
      <HelpOverlay tips={flashcardsPageTips} />

      {/* Header stats */}
      <div id="section-deck-select" className="flex w-full shrink-0 items-center justify-between mb-4">
        <NavigationIconButton direction="back" label="Back" onClick={() => handleBackToDecks()} className="-ml-2" />
        <div className="flex items-center gap-3">
          <div
            className="h-2 w-32 sm:w-48 overflow-hidden rounded-full bg-surface-hover"
            role="progressbar"
            aria-valuenow={deckProgressReviewed}
            aria-valuemin={0}
            aria-valuemax={deckProgressTotal}
            aria-label="Review progress">
            <motion.div
              className="h-full rounded-full bg-accent"
              animate={{ width: `${deckProgressTotal ? Math.min(100, (deckProgressReviewed / deckProgressTotal) * 100) : 0}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="shrink-0 text-right text-body-sm tabular-nums text-muted">
            {deckProgressReviewed} / {deckProgressTotal}
          </span>
        </div>
      </div>

      {/* Flashcard */}
      {currentCard && (
        <div id="section-flashcard" className="flex w-full min-h-0 flex-1 items-center justify-center">
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
          />
        </div>
      )}
      {!currentCard && isStreamingCards && (
        <div className="flex w-full min-h-0 flex-1 items-center justify-center" role="status" aria-live="polite">
          <p className="text-body-sm text-muted">Preparing your next card…</p>
        </div>
      )}

      {/* Last rating feedback */}
      <AnimatePresence>
        {lastRatingInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 w-full max-w-[22rem] px-4 py-2 rounded-lg bg-surface border border-subtle text-xs text-secondary flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-secondary" />
            Next review for "{lastRatingInfo.word}" in {lastRatingInfo.nextDue}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div id="section-rating-buttons" className="mx-auto mt-5 min-h-[5.5rem] w-full max-w-[22rem]">
        {isFlipped && <RatingBar previewTimes={previewTimes} onRate={handleRating} />}
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
              className="bg-app rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-primary text-center mb-2">Delete Flashcard?</h3>
              <p className="text-sm text-secondary text-center mb-6">
                Remove this flashcard? The word can reappear with a new clip when you watch more content.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-surface-hover text-primary font-medium hover:bg-blush transition-colors"
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
