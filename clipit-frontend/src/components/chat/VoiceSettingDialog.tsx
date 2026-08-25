import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { Button } from '../ui/button';
import { VoiceSelector } from '../VoiceSelector';
import type { TtsVoice } from '../../services/chat';

interface VoiceSettingDialogProps {
  voices: TtsVoice[];
  selectedId: string;
  onSelect: (id: string) => void;
  getSampleUrl: (voiceId: string) => Promise<string>;
  onClose: () => void;
}

export function VoiceSettingDialog({ voices, selectedId, onSelect, getSampleUrl, onClose }: VoiceSettingDialogProps) {
  const dialogRef = useDialogFocus(true, onClose);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-black/35"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
        onClick={onClose}
      />

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-setting-title"
        tabIndex={-1}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-lg rounded-2xl border border-subtle bg-app p-6 shadow-lg"
      >
        <Button
          type="button"
          onClick={onClose}
          variant="ghost"
          size="icon"
          aria-label="Close"
          className="absolute right-4 top-4 h-8 w-8 text-muted hover:bg-transparent hover:text-primary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>

        <h2 id="voice-setting-title" className="pr-10 font-heading text-card-title font-medium text-primary">
          AI voice
        </h2>
        <p className="mt-1 text-body-sm text-secondary">
          Tap a voice to hear a sample. Takes effect on your next call — it won't change the voice mid-conversation.
        </p>

        <div className="mt-5">
          {voices.length === 0 ? (
            <p className="py-6 text-center text-body-sm text-muted">Loading voices…</p>
          ) : (
            <VoiceSelector voices={voices} selectedId={selectedId} onSelect={onSelect} getSampleUrl={getSampleUrl} />
          )}
        </div>
      </motion.div>
    </div>
  );
}
