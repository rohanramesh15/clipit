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
} from 'lucide-react';
import { rateCard, sortByPriority, getDueCards, getCardStats, previewNextReviews, Rating } from '../services/fsrs';

const API = 'http://localhost:8000/api';

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

type LoadState = 'loading' | 'loaded' | 'error' | 'no-videos' | 'no-korean' | 'session-complete';

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

export function FlashcardsPage() {
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

  // Create/update YouTube player when card changes
  useEffect(() => {
    const card = dueCards[currentIndex];
    if (loadState !== 'loaded' || !card) return;
    if (!playerContainerRef.current) return;

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

  // Fetch flashcards for a single video. Returns cards array (empty if failed/no vocab).
  const fetchCardsForVideo = useCallback(async (videoId: string): Promise<FlashCard[]> => {
    try {
      await fetch(`${API}/subtitles/${videoId}`);

      const vocabRes = await fetch(`${API}/vocabulary/${videoId}?limit=20`);
      if (!vocabRes.ok) return [];
      const vocab = await vocabRes.json();
      if (!vocab.total_words) return [];

      const wordList = vocab.vocabulary.map((v: { word: string }) => v.word);
      const fcRes = await fetch(`${API}/flashcard-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId, words: wordList, word_source: 'essential' }),
      });
      if (!fcRes.ok) return [];
      const fc = await fcRes.json();

      // Attach rank from vocab to each card
      const rankMap: Record<string, number> = {};
      vocab.vocabulary.forEach((v: { word: string; rank: number }) => { rankMap[v.word] = v.rank; });
      return (fc.flashcards || []).map((card: FlashCard) => ({
        ...card,
        rank: rankMap[card.target_word],
      }));
    } catch {
      return [];
    }
  }, []);

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

    const words = uniqueCards.map(c => c.target_word);
    const sortedWords = sortByPriority(words);
    const dueWords = getDueCards(words);

    // Reorder cards by sorted priority
    const cardMap = new Map(uniqueCards.map(c => [c.target_word, c]));
    const sortedCards = sortedWords.map(w => cardMap.get(w)!).filter(Boolean);
    const dueCardsFiltered = sortedCards.filter(c => dueWords.includes(c.target_word));

    setCards(sortedCards);
    setDueCards(dueCardsFiltered);
    setSessionStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });

    if (dueCardsFiltered.length === 0 && sortedCards.length > 0) {
      // No cards due - show completion screen
      setLoadState('session-complete');
    } else {
      setLoadState('loaded');
    }
  }, []);

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
      setLoadState('no-korean');
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
      setLoadState('no-korean');
      return;
    }
    prepareCardsForReview(videoCards);
  }, [fetchCardsForVideo, prepareCardsForReview]);

  useEffect(() => {
    async function bootstrap() {
      try {
        const res = await fetch(`${API}/videos/history/filtered`);
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
  }, [loadAllVideos]);

  const currentCard = dueCards[currentIndex];
  const progress = dueCards.length ? ((currentIndex + 1) / dueCards.length) * 100 : 0;

  // Handle rating a card
  function handleRating(rating: Rating) {
    if (!currentCard) return;

    const { nextDue } = rateCard(currentCard.target_word, rating);
    const nextDueStr = formatNextReview(nextDue);

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

    setLastRatingInfo({ word: currentCard.target_word, nextDue: nextDueStr });
    setIsFlipped(false);

    setTimeout(() => {
      if (currentIndex < dueCards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // Session complete
        setLoadState('session-complete');
      }
      setLastRatingInfo(null);
    }, 300);
  }

  // Get stats for current card
  const currentStats = currentCard ? getCardStats(currentCard.target_word) : null;

  // Get preview times for rating buttons
  const previewTimes = currentCard ? previewNextReviews(currentCard.target_word) : null;

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
          Make sure the Deadbird backend is running at localhost:8000
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
          Watch a Korean YouTube video with the Deadbird extension to start building flashcards.
        </p>
      </div>
    );
  }

  // ── No Korean ────────────────────────────────────────────────
  if (loadState === 'no-korean') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-3xl">
          🈚
        </div>
        <p className="text-primary font-semibold">No common Korean words found</p>
        <p className="text-secondary text-sm text-center max-w-sm">
          {selectedVideoId === 'all'
            ? 'None of the tracked videos had Korean words matching the frequency list.'
            : 'No Korean words from the frequency list were found in this video.'}
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
              setCurrentIndex(0);
              setDueCards(cards);
              setSessionStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
              setLoadState('loaded');
            }}
            className="px-5 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors">
            Review All Cards
          </button>
          <button
            onClick={() => loadAllVideos(videos)}
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

      {/* Header stats */}
      <div className="w-full flex items-center justify-between mb-5">
        <div className="min-w-0 flex-1 mr-4">
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
          <div className="text-2xl font-bold text-accent">
            {currentIndex + 1}
            <span className="text-muted text-lg"> / {dueCards.length}</span>
          </div>
          <div className="w-28 h-1.5 bg-surface-hover rounded-full mt-1.5 overflow-hidden">
            <motion.div
              className="h-full bg-accent"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
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
              <button
                key={v.video_id}
                onClick={() => { setShowVideoPicker(false); loadFlashcards(v.video_id, v.title); }}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${
                  v.video_id === selectedVideoId ? 'text-accent' : 'text-secondary'
                }`}>
                <span className="line-clamp-1">{v.title}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card area */}
      <div className="w-full">
        {/* YouTube clip */}
        <div className="w-full aspect-video rounded-t-2xl overflow-hidden ring-1 ring-white/10 bg-black">
          <div
            ref={playerContainerRef}
            className="w-full h-full"
          />
        </div>

        {/* Sentence context strip */}
        {currentCard && (
          <div className="w-full bg-surface-hover border-x border-white/8 px-4 py-2.5 text-center">
            <p className="text-sm text-secondary font-medium leading-snug">
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
              <p className="text-xs text-muted mt-0.5 leading-snug">
                {currentCard.sentence_translation}
              </p>
            )}
          </div>
        )}

        {/* Flashcard */}
        <div className="relative w-full aspect-[4/3] -mt-px" style={{ perspective: '1200px' }}>
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
                  className="absolute inset-0 bg-surface border border-white/10 border-t-0 rounded-b-2xl shadow-2xl flex flex-col items-center justify-center p-8"
                  style={{ backfaceVisibility: 'hidden' }}>
                  <div className="flex items-center gap-2 mb-5">
                    {currentCard?.rank && (
                      <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border border-white/10 text-muted">
                        #{currentCard.rank}
                      </span>
                    )}
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
                  <h2 className="text-5xl md:text-6xl font-heading font-bold text-primary text-center mb-3 tracking-tight">
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
                  className="absolute inset-0 bg-surface-hover border border-accent/20 border-t-0 rounded-b-2xl shadow-2xl flex flex-col items-center justify-center p-8"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <span className="text-xs font-bold tracking-widest text-secondary uppercase mb-5">
                    English
                  </span>
                  <h2 className="text-4xl font-heading font-bold text-primary text-center mb-4">
                    {currentCard?.english && currentCard.english !== 'definition not available'
                      ? currentCard.english
                      : '-'}
                  </h2>
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
        className="grid grid-cols-4 gap-3 mt-8 w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}>

        <button
          onClick={() => handleRating(Rating.Again)}
          className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface hover:bg-red-500/10 border border-transparent hover:border-red-500/40 group transition-all">
          {previewTimes && (
            <span className="text-[10px] text-muted font-medium">{formatNextReview(previewTimes.again)}</span>
          )}
          <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-secondary group-hover:text-red-400">Again</span>
        </button>

        <button
          onClick={() => handleRating(Rating.Hard)}
          className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface hover:bg-orange-500/10 border border-transparent hover:border-orange-500/40 group transition-all">
          {previewTimes && (
            <span className="text-[10px] text-muted font-medium">{formatNextReview(previewTimes.hard)}</span>
          )}
          <div className="w-10 h-10 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
            <ThumbsDown className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-secondary group-hover:text-orange-400">Hard</span>
        </button>

        <button
          onClick={() => handleRating(Rating.Good)}
          className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface hover:bg-accent/10 border border-transparent hover:border-accent/40 group transition-all">
          {previewTimes && (
            <span className="text-[10px] text-muted font-medium">{formatNextReview(previewTimes.good)}</span>
          )}
          <div className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center group-hover:bg-accent group-hover:text-app transition-colors">
            <ThumbsUp className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-secondary group-hover:text-accent">Good</span>
        </button>

        <button
          onClick={() => handleRating(Rating.Easy)}
          className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface hover:bg-green-500/10 border border-transparent hover:border-green-500/40 group transition-all">
          {previewTimes && (
            <span className="text-[10px] text-muted font-medium">{formatNextReview(previewTimes.easy)}</span>
          )}
          <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center group-hover:bg-green-500 group-hover:text-white transition-colors">
            <Check className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-secondary group-hover:text-green-400">Easy</span>
        </button>
      </motion.div>
    </div>
  );
}
