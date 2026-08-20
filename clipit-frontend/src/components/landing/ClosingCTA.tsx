import React from 'react';
import { ArrowRight } from 'lucide-react';

interface ClosingCTAProps {
  onGetStarted: () => void;
}

export function ClosingCTA({ onGetStarted }: ClosingCTAProps) {
  return (
    <section className="bg-inverse py-20 md:py-28" aria-labelledby="cta-title">
      <div className="mx-auto max-w-page px-5 text-center sm:px-8">
        <h2 id="cta-title" className="font-landing-heading text-section-lg text-cream md:text-display">
          Ready to clip?
        </h2>
        <button
          type="button"
          onClick={onGetStarted}
          className="mt-9 inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-accent px-8 py-4 text-lead font-medium text-[#fff] transition-colors duration-150 ease-swift hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
        >
          Get started for free
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
