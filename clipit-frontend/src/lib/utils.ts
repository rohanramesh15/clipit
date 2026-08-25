import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Without this, tailwind-merge doesn't know our custom fontSize scale
// (tailwind.config.js) and misreads e.g. `text-body-sm` as a text-color
// utility — so it "conflicts" with a real color class like `text-primary`
// and silently drops whichever one came first. That's what made every
// default-size <Button> render at the browser's inherited font size instead
// of text-body-sm, since cva puts the base font-size class before the
// variant's text color class.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['meta', 'body-sm', 'body', 'lead', 'card-title', 'section', 'section-lg', 'display', 'display-lg'] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
