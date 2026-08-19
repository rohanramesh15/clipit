import React from 'react';

/** Stacked card deck showing one due word, as on the landing page. */
export function FlashcardVisual() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute inset-x-6 -top-3 h-full rounded-2xl bg-sand-mid/40" aria-hidden="true" />
      <div className="relative rounded-2xl bg-app p-6 text-center">
        <p className="text-display text-primary">단어</p>
        <p className="mt-2 text-body-sm text-sand-ink">dan-eo · word, vocabulary</p>
        <p className="mt-5 border-t border-subtle pt-4 text-meta leading-relaxed text-muted">
          “우리는 매일 새로운 <span className="font-semibold text-secondary">단어를</span> 배워요”
        </p>
      </div>
    </div>
  );
}

export function ChatVisual() {
  const bars = [8, 16, 26, 14, 22, 10, 18, 28, 12, 20, 9, 15];
  return (
    <div className="flex items-end gap-1.5" aria-hidden="true">
      {bars.map((height, index) => (
        <span key={index} className="w-1.5 rounded-full bg-sage-mid" style={{ height: `${height}px` }} />
      ))}
    </div>
  );
}

export function MadlibsVisual() {
  return (
    <p className="text-body leading-7 text-secondary" aria-hidden="true">
      우리는 매일{' '}
      <span className="rounded bg-app px-2 py-0.5 font-semibold text-dusk-ink">새로운</span>{' '}
      <span className="inline-block h-4 w-14 rounded border-b-2 border-dashed border-dusk-mid align-middle" />{' '}
      배워요
    </p>
  );
}
