import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';

interface ClosingCTAProps {
  onGetStarted: () => void;
}

export function ClosingCTA({ onGetStarted }: ClosingCTAProps) {
  return (
    <section className="bg-inverse py-20 md:py-28" aria-labelledby="cta-title">
      <div className="mx-auto max-w-page px-5 text-center sm:px-8">
        <h2 id="cta-title" className="font-heading text-section-lg font-medium text-cream md:text-display md:font-medium">
          Ready to clip?
        </h2>
        <Button
          type="button"
          onClick={onGetStarted}
          size="lg"
          className="mt-9 h-auto px-8 py-4 text-lead font-medium"
        >
          Get started for free
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
