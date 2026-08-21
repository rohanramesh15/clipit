import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Play } from 'lucide-react';
import { VoiceWaveform } from './VoiceWaveform';
import { Spinner } from './ui/spinner';
import type { TtsVoice } from '../services/chat';

interface VoiceSelectorProps {
  voices: TtsVoice[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Resolves to a playable object URL for a voice's sample clip. Caller owns caching. */
  getSampleUrl: (voiceId: string) => Promise<string>;
}

/** Waveform shape and one-word character per voice — cosmetic only, not from the backend. */
const VOICE_META: Record<string, { character: string; signature: number[] }> = {
  Kore: { character: 'Neutral', signature: [0.4, 0.62, 0.5, 0.72, 0.46, 0.6, 0.42] },
  Puck: { character: 'Bright', signature: [0.3, 0.85, 0.45, 0.95, 0.35, 0.8, 0.5] },
  Charon: { character: 'Deep', signature: [0.7, 0.55, 0.8, 0.5, 0.75, 0.45, 0.7] },
  Aoede: { character: 'Warm', signature: [0.45, 0.7, 0.85, 0.6, 0.8, 0.55, 0.5] },
  Fenrir: { character: 'Direct', signature: [0.9, 0.35, 0.85, 0.4, 0.9, 0.3, 0.85] },
  Leda: { character: 'Soft', signature: [0.35, 0.5, 0.4, 0.58, 0.36, 0.52, 0.34] },
  Orus: { character: 'Confident', signature: [0.6, 0.78, 0.55, 0.82, 0.6, 0.75, 0.58] },
  Zephyr: { character: 'Breezy', signature: [0.32, 0.6, 0.42, 0.66, 0.38, 0.7, 0.4] },
};
const FALLBACK_SIGNATURE = [0.4, 0.6, 0.45, 0.65, 0.4, 0.55, 0.42];

export function VoiceSelector({ voices, selectedId, onSelect, getSampleUrl }: VoiceSelectorProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const playSample = async (voice: TtsVoice) => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
    setErrorId(null);
    setLoadingId(voice.id);
    try {
      const url = await getSampleUrl(voice.id);
      const audio = new Audio(url);
      audioRef.current = audio;
      const clearIfCurrent = () => setPlayingId((current) => (current === voice.id ? null : current));
      audio.addEventListener('ended', clearIfCurrent);
      audio.addEventListener('error', () => {
        clearIfCurrent();
        setErrorId(voice.id);
      });
      await audio.play();
      setPlayingId(voice.id);
    } catch (err) {
      console.error('Failed to play voice sample:', err);
      setErrorId(voice.id);
    } finally {
      setLoadingId((current) => (current === voice.id ? null : current));
    }
  };

  const handleSelect = (voice: TtsVoice) => {
    onSelect(voice.id);
    playSample(voice);
  };

  return (
    <div className="w-full">
      <div role="group" aria-label="AI voice" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {voices.map((voice) => {
          const isActive = voice.id === selectedId;
          const isPlaying = playingId === voice.id;
          const isLoading = loadingId === voice.id;
          const hasError = errorId === voice.id;
          const meta = VOICE_META[voice.id];
          return (
            <button
              key={voice.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleSelect(voice)}
              className={`group flex flex-col rounded-xl border px-3.5 py-3 text-left transition-colors duration-150 ease-swift ${
                hasError
                  ? 'border-error/30 bg-error/5'
                  : isActive
                    ? 'border-accent bg-blush'
                    : 'border-subtle bg-surface hover:bg-surface-hover'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <VoiceWaveform
                  signature={meta?.signature ?? FALLBACK_SIGNATURE}
                  isPlaying={isPlaying}
                  height={16}
                  barWidth={2.5}
                  className={hasError ? 'text-error/40' : isActive ? 'text-accent' : 'text-muted'}
                />
                {isLoading ? (
                  <Spinner className="h-3.5 w-3.5 shrink-0 text-muted" />
                ) : hasError ? (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-error" aria-hidden="true" />
                ) : isActive ? (
                  <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                ) : (
                  <Play
                    className="h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition-opacity duration-150 ease-swift group-hover:opacity-100"
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className={`mt-2 block text-body-sm font-semibold ${hasError ? 'text-error' : isActive ? 'text-accent' : 'text-primary'}`}>
                {voice.label.split(' — ')[0]}
              </span>
              {hasError ? (
                <span className="block text-meta text-error/80">Couldn't play — tap to retry</span>
              ) : (
                meta?.character && (
                  <span className={`block text-meta ${isActive ? 'text-secondary' : 'text-muted'}`}>{meta.character}</span>
                )
              )}
            </button>
          );
        })}
      </div>
      {errorId && (
        <p className="mt-3 text-meta text-muted" role="alert">
          Sample playback failed. Check your connection and tap the voice again to retry.
        </p>
      )}
    </div>
  );
}
