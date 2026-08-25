import { KeyboardIcon, MessageSquareTextIcon, MicIcon, MoreVerticalIcon } from 'lucide-react';
import { SpeechInput } from '../ai-elements/speech-input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

interface VoiceControlsProps {
  /** The mic is open and streaming. */
  live: boolean;
  connecting: boolean;
  /** The session isn't ready to start a call yet (still loading). */
  disabled?: boolean;
  status: string;
  prompt?: string;
  onStart: () => void;
  onStop: () => void;
  onType: () => void;
  onTranscript: () => void;
}

export function VoiceControls({
  live,
  connecting,
  disabled,
  status,
  prompt,
  onStart,
  onStop,
  onType,
  onTranscript,
}: VoiceControlsProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={onType}
          aria-label="Type instead"
          className="grid size-9 place-items-center rounded-xl border border-subtle text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary"
        >
          <KeyboardIcon className="size-4" aria-hidden="true" />
        </button>

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More voice options"
              className="grid size-9 place-items-center rounded-xl border border-subtle text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary"
            >
              <MoreVerticalIcon className="size-4" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onType}>
              <KeyboardIcon className="size-4" aria-hidden="true" />
              Type a message
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onTranscript}>
              <MessageSquareTextIcon className="size-4" aria-hidden="true" />
              View transcript
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {prompt && (
        <p className="text-meta font-medium text-secondary" role="status" aria-live="polite">
          {prompt}
        </p>
      )}
      <span className="sr-only" role="status" aria-live="polite">{status}</span>
    </div>
  );
}
