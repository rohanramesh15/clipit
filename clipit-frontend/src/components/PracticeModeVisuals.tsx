import React from 'react';

export function FlashcardVisual() {
  return (
    <div aria-hidden="true" className="relative h-24">
      <div className="absolute left-6 top-2 h-20 w-[70%] rotate-3 rounded-xl border border-sand-mid bg-white/60" />
      <div className="absolute left-3 top-0 h-20 w-[70%] -rotate-2 rounded-xl border border-sand-mid bg-white">
        <div className="ml-4 mt-5 h-2.5 w-16 rounded-full bg-sand-mid" />
        <div className="ml-4 mt-2.5 h-2 w-10 rounded-full bg-sand-mid/60" />
      </div>
    </div>
  );
}

export function ChatVisual() {
  const bars = [10, 22, 34, 18, 40, 26, 14, 30, 20, 36, 12, 24];
  return (
    <div aria-hidden="true" className="flex h-24 items-end gap-1.5">
      {bars.map((height, index) => (
        <span key={index} style={{ height: `${height}px` }} className="w-2 rounded-full bg-sage-mid" />
      ))}
    </div>
  );
}

export function MadlibsVisual() {
  return (
    <div aria-hidden="true" className="flex h-24 flex-col justify-end gap-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-12 rounded-full bg-dusk-mid" />
        <span className="h-6 w-20 rounded-md border border-dashed border-dusk-mid bg-white" />
        <span className="h-2.5 w-8 rounded-full bg-dusk-mid" />
      </div>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-8 rounded-full bg-dusk-mid/60" />
        <span className="h-2.5 w-16 rounded-full bg-dusk-mid/60" />
        <span className="h-6 w-14 rounded-md border border-dashed border-dusk-mid bg-white" />
      </div>
    </div>
  );
}
