import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCw,
  Check,
  X,
  ThumbsUp,
  ThumbsDown,
  Play,
  Pause,
  Volume2 } from
'lucide-react';
interface Card {
  id: number;
  front: string;
  back: string;
  example: string;
  pronunciation: string;
  clipEpisode: string;
  clipTimestamp: string;
  clipCaption: string;
  clipTranslation: string;
  thumbnail: string;
}
const mockCards: Card[] = [
{
  id: 1,
  front: 'bibliothèque',
  back: 'library',
  example: 'Je vais à la bibliothèque.',
  pronunciation: '/bi.bli.jɔ.tɛk/',
  clipEpisode: 'Navigating the Metro',
  clipTimestamp: '03:42',
  clipCaption: 'Je vais à la bibliothèque après le travail.',
  clipTranslation: "I'm going to the library after work.",
  thumbnail: 'bg-indigo-900/40'
},
{
  id: 2,
  front: 'voiture',
  back: 'car',
  example: 'Sa voiture est rouge.',
  pronunciation: '/vwa.tyʁ/',
  clipEpisode: 'Weekend in Provence',
  clipTimestamp: '07:15',
  clipCaption: 'Regarde, sa voiture est rouge!',
  clipTranslation: 'Look, his car is red!',
  thumbnail: 'bg-rose-900/40'
},
{
  id: 3,
  front: 'pomme',
  back: 'apple',
  example: "J'aime manger une pomme.",
  pronunciation: '/pɔm/',
  clipEpisode: 'The Art of French Cooking',
  clipTimestamp: '12:08',
  clipCaption: "J'aime manger une pomme le matin.",
  clipTranslation: 'I like to eat an apple in the morning.',
  thumbnail: 'bg-green-900/40'
},
{
  id: 4,
  front: 'ordinateur',
  back: 'computer',
  example: 'Mon ordinateur est cassé.',
  pronunciation: '/ɔʁ.di.na.tœʁ/',
  clipEpisode: 'Museum Etiquette',
  clipTimestamp: '05:33',
  clipCaption: 'Oh non, mon ordinateur est cassé!',
  clipTranslation: 'Oh no, my computer is broken!',
  thumbnail: 'bg-slate-800'
},
{
  id: 5,
  front: 'fenêtre',
  back: 'window',
  example: "Ouvrez la fenêtre, s'il vous plaît.",
  pronunciation: '/fə.nɛtʁ/',
  clipEpisode: 'Arrival in Paris',
  clipTimestamp: '09:20',
  clipCaption: "Ouvrez la fenêtre, s'il vous plaît.",
  clipTranslation: 'Open the window, please.',
  thumbnail: 'bg-sky-900/40'
},
{
  id: 6,
  front: 'papillon',
  back: 'butterfly',
  example: 'Le papillon est coloré.',
  pronunciation: '/pa.pi.jɔ̃/',
  clipEpisode: 'Weekend in Provence',
  clipTimestamp: '15:44',
  clipCaption: 'Regarde le papillon, il est si coloré!',
  clipTranslation: 'Look at the butterfly, it is so colorful!',
  thumbnail: 'bg-amber-900/40'
},
{
  id: 7,
  front: 'boulangerie',
  back: 'bakery',
  example: 'La boulangerie est ouverte.',
  pronunciation: '/bu.lɑ̃.ʒʁi/',
  clipEpisode: 'Ordering Coffee in Paris',
  clipTimestamp: '02:10',
  clipCaption: 'La boulangerie du coin est toujours ouverte.',
  clipTranslation: 'The corner bakery is always open.',
  thumbnail: 'bg-orange-900/40'
},
{
  id: 8,
  front: 'nuage',
  back: 'cloud',
  example: 'Il y a un gros nuage.',
  pronunciation: '/nɥaʒ/',
  clipEpisode: 'Weekend in Provence',
  clipTimestamp: '18:55',
  clipCaption: 'Il y a un gros nuage noir là-bas.',
  clipTranslation: 'There is a big black cloud over there.',
  thumbnail: 'bg-gray-800'
}];

export function FlashcardsPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [direction, setDirection] = useState(0);
  const [isClipPlaying, setIsClipPlaying] = useState(false);
  const currentCard = mockCards[currentIndex];
  const progress = currentIndex / mockCards.length * 100;
  const handleNext = () => {
    setIsFlipped(false);
    setIsClipPlaying(false);
    setDirection(1);
    setTimeout(() => {
      if (currentIndex < mockCards.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setCurrentIndex(0);
      }
    }, 300);
  };
  return (
    <div className="min-h-screen flex flex-col items-center max-w-4xl mx-auto px-4 py-8 md:py-12">
      {/* Header Stats */}
      <div className="w-full flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary">
            Daily Review
          </h1>
          <p className="text-secondary text-sm">
            New words from yesterday's lesson
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-accent">
            {currentIndex + 1}{' '}
            <span className="text-muted text-lg">/ {mockCards.length}</span>
          </div>
          <div className="w-32 h-1.5 bg-surface-hover rounded-full mt-2 overflow-hidden">
            <motion.div
              className="h-full bg-accent"
              initial={{
                width: 0
              }}
              animate={{
                width: `${progress}%`
              }}
              transition={{
                duration: 0.5
              }} />

          </div>
        </div>
      </div>

      {/* Video Clip + Card Area */}
      <div className="w-full max-w-md">
        {/* Video Clip Player */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`clip-${currentIndex}`}
            initial={{
              opacity: 0,
              y: -10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            exit={{
              opacity: 0,
              y: 10
            }}
            transition={{
              duration: 0.3
            }}
            className={`relative w-full aspect-video ${currentCard.thumbnail} rounded-t-2xl overflow-hidden ring-1 ring-white/10 group`}>

            <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-black/50" />

            {/* Play/Pause */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsClipPlaying(!isClipPlaying);
                }}
                className="w-12 h-12 rounded-full bg-accent/90 hover:bg-accent flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg shadow-accent/20">

                {isClipPlaying ?
                <Pause className="w-5 h-5 text-app fill-current" /> :

                <Play className="w-5 h-5 text-app fill-current ml-0.5" />
                }
              </button>
            </div>

            {/* Captions */}
            <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center text-center px-3 space-y-1">
              <div className="bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/5">
                <p className="text-sm md:text-base font-medium text-accent">
                  {currentCard.clipCaption}
                </p>
              </div>
              <p className="text-muted text-xs font-medium drop-shadow-md">
                {currentCard.clipTranslation}
              </p>
            </div>

            {/* Bottom Controls Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/80 to-transparent flex items-end px-3 pb-1.5">
              <div className="w-full flex items-center gap-2">
                <div className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-accent"
                    initial={{
                      width: '0%'
                    }}
                    animate={{
                      width: isClipPlaying ? '100%' : '0%'
                    }}
                    transition={{
                      duration: isClipPlaying ? 4 : 0,
                      ease: 'linear'
                    }} />

                </div>
                <span className="text-[9px] text-white/60 font-mono">
                  {currentCard.clipTimestamp}
                </span>
              </div>
            </div>

            {/* Episode Badge */}
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-medium text-white/80">
              {currentCard.clipEpisode}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Flashcard (connected to video above) */}
        <div className="relative w-full aspect-[4/3] perspective-1000 -mt-px">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{
                opacity: 0,
                x: 50
              }}
              animate={{
                opacity: 1,
                x: 0
              }}
              exit={{
                opacity: 0,
                x: -50
              }}
              transition={{
                duration: 0.3
              }}
              className="w-full h-full relative preserve-3d cursor-pointer"
              onClick={() => setIsFlipped(!isFlipped)}
              style={{
                transformStyle: 'preserve-3d'
              }}>

              <motion.div
                className="w-full h-full absolute inset-0"
                animate={{
                  rotateY: isFlipped ? 180 : 0
                }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 20
                }}
                style={{
                  transformStyle: 'preserve-3d'
                }}>

                {/* Front */}
                <div
                  className="absolute inset-0 bg-surface border border-white/10 border-t-0 rounded-b-2xl shadow-2xl flex flex-col items-center justify-center p-8 backface-hidden"
                  style={{
                    backfaceVisibility: 'hidden'
                  }}>

                  <span className="text-xs font-bold tracking-widest text-accent uppercase mb-4">
                    French
                  </span>
                  <h2 className="text-5xl md:text-6xl font-heading font-bold text-primary text-center mb-4">
                    {currentCard.front}
                  </h2>
                  <p className="text-secondary font-mono text-lg">
                    {currentCard.pronunciation}
                  </p>
                  <div className="absolute bottom-6 text-muted text-sm flex items-center gap-2">
                    <RotateCw className="w-4 h-4" /> Click to flip
                  </div>
                </div>

                {/* Back */}
                <div
                  className="absolute inset-0 bg-surface-hover border border-accent/20 border-t-0 rounded-b-2xl shadow-2xl flex flex-col items-center justify-center p-8 backface-hidden"
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)'
                  }}>

                  <span className="text-xs font-bold tracking-widest text-secondary uppercase mb-4">
                    English
                  </span>
                  <h2 className="text-4xl font-heading font-bold text-primary text-center mb-6">
                    {currentCard.back}
                  </h2>
                  <div className="w-full border-t border-white/5 pt-6 mt-2">
                    <p className="text-center text-lg text-gray-300 italic">
                      "{currentCard.example}"
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
      <motion.div
        className="grid grid-cols-4 gap-4 mt-10 w-full max-w-md"
        initial={{
          opacity: 0,
          y: 20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        transition={{
          delay: 0.2
        }}>

        <button
          onClick={handleNext}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface hover:bg-red-500/10 border border-transparent hover:border-red-500/50 group transition-all">

          <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-secondary group-hover:text-red-400">
            Again
          </span>
        </button>

        <button
          onClick={handleNext}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface hover:bg-orange-500/10 border border-transparent hover:border-orange-500/50 group transition-all">

          <div className="w-10 h-10 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
            <ThumbsDown className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-secondary group-hover:text-orange-400">
            Hard
          </span>
        </button>

        <button
          onClick={handleNext}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface hover:bg-accent/10 border border-transparent hover:border-accent/50 group transition-all">

          <div className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center group-hover:bg-accent group-hover:text-app transition-colors">
            <ThumbsUp className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-secondary group-hover:text-accent">
            Good
          </span>
        </button>

        <button
          onClick={handleNext}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface hover:bg-green-500/10 border border-transparent hover:border-green-500/50 group transition-all">

          <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center group-hover:bg-green-500 group-hover:text-white transition-colors">
            <Check className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-secondary group-hover:text-green-400">
            Easy
          </span>
        </button>
      </motion.div>
    </div>);

}