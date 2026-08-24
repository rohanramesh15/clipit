
/** @type {import('tailwindcss').Config} */
export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        surface: 'var(--bg-surface)',
        'surface-hover': 'var(--bg-surface-hover)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-soft': 'var(--accent-soft)',
        'accent-ring': 'var(--accent-ring)',
        'on-accent': 'var(--on-accent)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        success: '#22c55e',
        error: '#ef4444',
        warning: '#f97316',
        // Landing page palette — decorative, self-contained, always used in
        // the light theme (landing forces `.light`), so plain hex rather
        // than the app's dark/light CSS vars.
        blush: '#ffeded',
        inverse: '#4c2323',
        ink: { DEFAULT: '#201b21', deep: '#141113', soft: '#2e262c' },
        cream: '#ffead3',
        sand: { deep: '#5a3d17', ink: '#8f6227', mid: '#e6c391', soft: '#fbf0e1', tint: '#fdf8f0' },
        sage: { deep: '#2e4a2a', ink: '#4a7043', mid: '#b1cbac', soft: '#ecf2ea' },
        dusk: { deep: '#2f4370', ink: '#4d6291', mid: '#b5c3e3', soft: '#edf0f8' },
        // Wordmark fill, bespoke to the hand-drawn logo mark only.
        // (Stroke lives as --logo-stroke in index.css — it's consumed via
        // the WebkitTextStroke style property, which can't take a class.)
        logo: { fill: '#EA7B7B' },
      },
      fontFamily: {
        // 'Noto Sans KR' fills the Hangul gap neither Nunito nor Fredoka
        // covers, so Korean content gets the same intentional treatment
        // Ukrainian already gets from Nunito's native Cyrillic support,
        // instead of silently falling back to the bare OS font.
        sans: ['Nunito', 'Noto Sans KR', 'ui-sans-serif', 'system-ui', '-apple-system', 'Helvetica Neue', 'sans-serif'],
        heading: ['Fredoka', 'Noto Sans KR', 'ui-sans-serif', 'system-ui', '-apple-system', 'Helvetica Neue', 'sans-serif'],
        logo: ['Love Ya Like A Sister', 'cursive'],
      },
      // Semantic type scale for the landing page — size, leading and weight
      // travel together.
      fontSize: {
        meta: ['0.75rem', { lineHeight: '1.5' }],
        'body-sm': ['0.875rem', { lineHeight: '1.6' }],
        body: ['1rem', { lineHeight: '1.65' }],
        lead: ['1.25rem', { lineHeight: '1.6' }],
        'card-title': ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        section: ['1.875rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'section-lg': ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '600' }],
        display: ['3rem', { lineHeight: '1.04', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-lg': ['3.75rem', { lineHeight: '1.02', letterSpacing: '-0.02em', fontWeight: '600' }],
      },
      borderColor: {
        subtle: 'var(--border-subtle)',
        medium: 'var(--border-medium)',
      },
      transitionTimingFunction: {
        swift: 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
      maxWidth: {
        page: '1180px',
        reading: '46rem',
      },
      boxShadow: {
        pop: 'var(--shadow-pop)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      }
    },
  },
  plugins: [],
}
