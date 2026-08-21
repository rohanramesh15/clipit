import React from 'react';

export function FlashcardVisual() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-28 w-56">
      <div className="absolute right-3 top-3 h-24 w-[76%] rotate-3 rounded-xl border border-sand-mid bg-white/60" />
      <div className="absolute left-3 top-0 h-24 w-[76%] -rotate-2 rounded-xl border border-sand-mid bg-white">
        <div className="ml-5 mt-6 h-3 w-20 rounded-full bg-sand-mid" />
        <div className="ml-5 mt-3 h-2.5 w-12 rounded-full bg-sand-mid/60" />
      </div>
    </div>
  );
}

export function ChatVisual() {
  const bars = [10, 22, 34, 18, 40, 26, 14, 30, 20, 36, 12, 24];
  return (
    <div aria-hidden="true" className="mx-auto flex h-32 items-end justify-center gap-2">
      {bars.map((height, index) => (
        <span key={index} style={{ height: `${Math.round(height * 1.65)}px` }} className="w-2.5 rounded-full bg-sage-mid" />
      ))}
    </div>
  );
}

export function MadlibsVisual() {
  return (
    <div aria-hidden="true" className="mx-auto flex h-28 w-max flex-col justify-center gap-4">
      <div className="flex items-center gap-2">
        <span className="h-3 w-14 rounded-full bg-dusk-mid" />
        <span className="h-7 w-24 rounded-md border border-dashed border-dusk-mid bg-white" />
        <span className="h-3 w-10 rounded-full bg-dusk-mid" />
      </div>
      <div className="flex items-center gap-2">
        <span className="h-3 w-10 rounded-full bg-dusk-mid/60" />
        <span className="h-3 w-[4.5rem] rounded-full bg-dusk-mid/60" />
        <span className="h-7 w-16 rounded-md border border-dashed border-dusk-mid bg-white" />
      </div>
    </div>
  );
}
