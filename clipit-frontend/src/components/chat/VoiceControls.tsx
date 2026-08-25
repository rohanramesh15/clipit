import { KeyboardIcon, MicIcon } from 'lucide-react';
import { SpeechInput } from '../ai-elements/speech-input';
import { Tooltip } from '../Tooltip';

interface VoiceControlsProps {
  /** The mic is open and streaming. */
  live: boolean;
  connecting: boolean;
  /** The session isn't ready to start a call yet (still loading). */
  disabled?: boolean;
  status: string;
  onStart: () => void;
  onStop: () => void;
  onType: () => void;
}

export function VoiceControls({
  live,
  connecting,
  disabled,
  status,
  onStart,
  onStop,
  onType,
}: VoiceControlsProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-6">
        <Tooltip label="Type">
          <button
            type="button"
            onClick={onType}
            aria-label="Type instead"
            className="grid size-9 place-items-center rounded-xl border border-subtle text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary"
          >
            <KeyboardIcon className="size-4" aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip label={live ? 'Stop the mic' : 'Start speaking'}>
          <SpeechInput
            isListening={live}
            onListeningChange={(listening) => {
              if (listening) onStart();
              else onStop();
            }}
            disabled={connecting || (disabled && !live)}
            aria-label={live ? 'Stop the mic' : 'Start speaking'}
            className="size-14 p-0"
            idleIcon={<MicIcon className="size-6" strokeWidth={2.25} aria-hidden="true" />}
          />
        </Tooltip>

        {/* Keeps the mic optically centred against the Type button. */}
        <span className="size-9 shrink-0" aria-hidden="true" />
      </div>

      <p className="text-meta text-muted" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
