# Deadbird Frontend

A React frontend for the Deadbird language learning application. Learn languages through video content with spaced repetition flashcards.

## Features

- **Video Player**: Watch videos with interactive subtitles
- **Flashcards**: Study vocabulary with FSRS spaced repetition
- **Dictionary**: Browse and search saved vocabulary
- **Analytics**: Track learning progress and statistics
- **Multi-language Support**: Ukrainian, Serbian, Bulgarian
- **Dark/Light Theme**: Toggle between themes
- **Responsive Design**: Works on desktop and mobile

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion (animations)
- ts-fsrs (spaced repetition)

## Project Structure

```
src/
├── components/
│   └── Sidebar.tsx       # Navigation sidebar
├── context/
│   ├── AuthContext.tsx   # Authentication state
│   └── LanguageContext.tsx # Language preferences
├── pages/
│   ├── VideoPage.tsx     # Video player
│   ├── FlashcardsPage.tsx # Flashcard review
│   ├── DictionaryPage.tsx # Vocabulary browser
│   ├── AnalyticsPage.tsx  # Learning stats
│   ├── SettingsPage.tsx   # User settings
│   ├── LandingPage.tsx    # Marketing page
│   ├── LoginPage.tsx      # Login form
│   ├── SignupPage.tsx     # Registration form
│   └── OnboardingPage.tsx # New user setup
├── App.tsx               # Main app component
└── index.tsx             # Entry point
```

## Setup

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file:
```env
VITE_API_URL=http://localhost:8000
```

## Running

### Development
```bash
npm run dev
```

The app runs at http://localhost:5176

### Production Build
```bash
npm run build
npm run preview
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
