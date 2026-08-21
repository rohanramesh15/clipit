import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Play, RotateCcw, Trash2, Volume2, VolumeX } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { FlashCard } from '../../types/flashcards';
import { speak } from '../../utils/speech';

// Netflix video placeholder component with screenshot and audio support
function NetflixVideoPlaceholder({ videoId, timestamp }: { videoId: string; timestamp: number }) {
  const [hasScreenshot, setHasScreenshot] = useState<boolean | null>(null);
  const [hasAudio, setHasAudio] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const roundedTimestamp = Math.floor(timestamp);
  const netflixId = videoId.replace('netflix_', '');
  const timeStr = `${Math.floor(timestamp / 60)}:${String(Math.floor(timestamp % 60)).padStart(2, '0')}`;

  // Check if screenshot and audio exist
  useEffect(() => {
    fetch(`${API_BASE_URL}/netflix/screenshot/${videoId}/${roundedTimestamp}`, { method: 'HEAD' })
      .then((res) => setHasScreenshot(res.ok))
      .catch(() => setHasScreenshot(false));

    fetch(`${API_BASE_URL}/netflix/audio/${videoId}/${roundedTimestamp}`, { method: 'HEAD' })
      .then((res) => setHasAudio(res.ok))
      .catch(() => setHasAudio(false));
  }, [videoId, roundedTimestamp]);

  // Auto-play audio when component mounts (if available)
  useEffect(() => {
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
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  return (
    <div className="w-full h-full relative bg-gradient-to-br from-primary to-secondary">
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
          {hasAudio && (
            <button
              onClick={toggleAudio}
              className="absolute bottom-3 right-3 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
              title={isPlaying ? 'Stop audio' : 'Play audio'}
            >
              {isPlaying ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-[#B20710] flex items-center justify-center mb-2">
            <span className="text-white font-bold text-xl">N</span>
          </div>
          <a
            href={`https://www.netflix.com/watch/${netflixId}?t=${roundedTimestamp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B20710] hover:bg-[#e50914] text-white text-sm font-medium transition-colors shadow-lg"
          >
            <Play className="w-4 h-4" />
            Watch on Netflix
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
          <p className="text-white/50 text-xs mt-2">{timeStr}</p>
          {hasAudio && (
            <button
              onClick={toggleAudio}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] text-[#ffffff] text-xs transition-colors"
            >
              {isPlaying ? (
                <>
                  <VolumeX className="w-4 h-4" /> Stop
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" /> Play Audio
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// TTS Card placeholder component - displays word with audio button (no video context)
function TTSCardPlaceholder({ word, language }: { word: string; language: string }) {
  const [isPlaying, setIsPlaying] = useState(false);

  const playAudio = React.useCallback(() => {
    setIsPlaying(true);
    speak(word, language);
    setTimeout(() => setIsPlaying(false), 1500);
  }, [word, language]);

  useEffect(() => {
    const timer = setTimeout(() => {
      playAudio();
    }, 300);
    return () => clearTimeout(timer);
  }, [word, playAudio]);

  return (
    <div className="w-full h-full relative bg-gradient-to-br from-accent/20 to-primary/10 flex flex-col items-center justify-center">
      <div className="w-20 h-20 rounded-full bg-app/40 flex items-center justify-center mb-4">
        <button
          onClick={playAudio}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            isPlaying
              ? 'bg-accent text-[#ffffff] scale-110'
              : 'bg-app/80 text-secondary hover:bg-accent hover:text-[#ffffff]'
          }`}
        >
          <Volume2 className={`w-8 h-8 ${isPlaying ? 'animate-pulse' : ''}`} />
        </button>
      </div>
      <p className="text-white/80 text-sm">{isPlaying ? 'Playing...' : 'Tap to hear pronunciation'}</p>
    </div>
  );
}

function HighlightedSentence({ sentence, word }: { sentence: string; word: string }) {
  const parts = sentence.split(new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g'));
  return (
    <>
      {parts.map((part, i) =>
        part === word ? (
          <span key={i} className="font-bold text-accent">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

interface ClipPlayerProps {
  card: FlashCard;
  language: string;
  /** Mount point for the real YouTube iframe player — its lifecycle is owned by the parent page. */
  playerContainerRef: React.RefObject<HTMLDivElement>;
  isRevealed: boolean;
  onRevertToTTS: () => void;
  isReverting: boolean;
  onDeleteCard: () => void;
}

export function ClipPlayer({
  card,
  language,
  playerContainerRef,
  isRevealed,
  onRevertToTTS,
  isReverting,
  onDeleteCard,
}: ClipPlayerProps) {
  const isNetflix = card.video_id?.startsWith('netflix_') ?? false;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-black/10">
      {card.card_type !== 'video' ? (
        <TTSCardPlaceholder word={card.target_word} language={language} />
      ) : isNetflix ? (
        <NetflixVideoPlaceholder videoId={card.video_id!} timestamp={card.timestamp ?? 0} />
      ) : (
        <div ref={playerContainerRef} className="h-full w-full" />
      )}

      <div className="absolute right-1.5 top-1.5 flex gap-1">
        {card.card_type === 'video' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRevertToTTS();
            }}
            disabled={isReverting}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-black/60 text-white/70 transition-colors hover:bg-accent/90 hover:text-[#ffffff] disabled:opacity-50"
            title="Revert to TTS-only"
          >
            <RotateCcw className={`h-4 w-4 ${isReverting ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteCard();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-black/60 text-white/70 transition-colors hover:bg-red-500/80 hover:text-[#ffffff]"
          title="Delete this flashcard"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {card.sentence !== undefined && (
        <div className="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-2.5 text-center">
          <p className="text-sm font-medium leading-snug text-[#ffffff]">
            {card.sentence ? (
              <HighlightedSentence sentence={card.sentence} word={card.target_word} />
            ) : (
              <span className="text-accent">{card.target_word}</span>
            )}
          </p>
          {isRevealed && card.sentence_translation && card.sentence_translation !== 'No translation available' && (
            <p className="mt-0.5 text-xs leading-snug text-white/60">{card.sentence_translation}</p>
          )}
        </div>
      )}
    </div>
  );
}
