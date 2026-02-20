import React, { useState } from 'react';
import { Search, Filter, Volume2, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
interface Word {
  id: number;
  term: string;
  pronunciation: string;
  definition: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  mastery: number;
  lastReviewed: string;
}
const mockDictionary: Word[] = [
{
  id: 1,
  term: 'Abondance',
  pronunciation: '/a.bɔ̃.dɑ̃s/',
  definition: 'Large quantity of something',
  level: 'B2',
  mastery: 85,
  lastReviewed: '2 days ago'
},
{
  id: 2,
  term: 'Bienveillance',
  pronunciation: '/bjɛ̃.vɛ.jɑ̃s/',
  definition: 'Kindness, goodwill',
  level: 'C1',
  mastery: 45,
  lastReviewed: '1 week ago'
},
{
  id: 3,
  term: 'Chat',
  pronunciation: '/ʃa/',
  definition: 'A small domesticated carnivorous mammal',
  level: 'A1',
  mastery: 100,
  lastReviewed: '1 month ago'
},
{
  id: 4,
  term: 'Dépaysement',
  pronunciation: '/de.pe.iz.mɑ̃/',
  definition: 'Feeling of being in a foreign country',
  level: 'C2',
  mastery: 20,
  lastReviewed: 'Yesterday'
},
{
  id: 5,
  term: 'Éphémère',
  pronunciation: '/e.fe.mɛʁ/',
  definition: 'Lasting for a very short time',
  level: 'B1',
  mastery: 60,
  lastReviewed: '3 days ago'
},
{
  id: 6,
  term: 'Flâner',
  pronunciation: '/flɑ.ne/',
  definition: 'To stroll aimlessly',
  level: 'B2',
  mastery: 75,
  lastReviewed: '5 days ago'
},
{
  id: 7,
  term: 'Gourmandise',
  pronunciation: '/ɡuʁ.mɑ̃.diz/',
  definition: 'Love of good food',
  level: 'B1',
  mastery: 90,
  lastReviewed: '2 weeks ago'
},
{
  id: 8,
  term: 'Hiver',
  pronunciation: '/i.vɛʁ/',
  definition: 'The coldest season of the year',
  level: 'A1',
  mastery: 95,
  lastReviewed: '3 weeks ago'
},
{
  id: 9,
  term: 'Inoubliable',
  pronunciation: '/i.nu.bli.jabl/',
  definition: 'Impossible to forget',
  level: 'A2',
  mastery: 50,
  lastReviewed: '4 days ago'
},
{
  id: 10,
  term: 'Jardin',
  pronunciation: '/ʒaʁ.dɛ̃/',
  definition: 'A piece of ground for growing flowers',
  level: 'A1',
  mastery: 100,
  lastReviewed: '1 month ago'
},
{
  id: 11,
  term: 'Kiosque',
  pronunciation: '/kjɔsk/',
  definition: 'A small open-fronted hut',
  level: 'A2',
  mastery: 80,
  lastReviewed: '1 week ago'
},
{
  id: 12,
  term: 'Lumière',
  pronunciation: '/ly.mjɛʁ/',
  definition: 'Natural agent that stimulates sight',
  level: 'A1',
  mastery: 92,
  lastReviewed: '2 days ago'
}];

const levelColors = {
  A1: 'bg-green-500/20 text-green-400 border-green-500/30',
  A2: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  B1: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  B2: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  C1: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  C2: 'bg-pink-500/20 text-pink-400 border-pink-500/30'
};
export function DictionaryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const filteredWords = mockDictionary.filter((word) => {
    const matchesSearch = word.term.
    toLowerCase().
    includes(searchTerm.toLowerCase());
    const matchesFilter = filterLevel ? word.level === filterLevel : true;
    return matchesSearch && matchesFilter;
  });
  return (
    <div className="min-h-screen pb-20 max-w-5xl mx-auto px-4 pt-8">
      {/* Header & Search */}
      <div className="sticky top-0 bg-app/95 backdrop-blur-md z-10 pb-6 border-b border-white/5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-heading font-bold text-primary">
            Dictionary
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">
              {filteredWords.length} words found
            </span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
            <input
              type="text"
              placeholder="Search for a word..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-xl pl-12 pr-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all" />

          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            <Filter className="w-5 h-5 text-secondary shrink-0 mr-2" />
            {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) =>
            <button
              key={level}
              onClick={() =>
              setFilterLevel(filterLevel === level ? null : level)
              }
              className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium border transition-all shrink-0
                  ${filterLevel === level ? 'bg-accent text-app border-accent' : 'bg-surface border-white/10 text-secondary hover:border-white/30'}
                `}>

                {level}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Word List */}
      <div className="space-y-3">
        {filteredWords.map((word, index) =>
        <motion.div
          key={word.id}
          initial={{
            opacity: 0,
            y: 10
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            delay: index * 0.05
          }}
          className="group bg-surface hover:bg-surface-hover border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all cursor-pointer">

            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <button className="mt-1 w-8 h-8 rounded-full bg-white/5 hover:bg-accent hover:text-app flex items-center justify-center transition-colors text-secondary">
                  <Volume2 className="w-4 h-4" />
                </button>

                <div>
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-xl font-bold text-primary group-hover:text-accent transition-colors">
                      {word.term}
                    </h3>
                    <span className="text-sm font-mono text-secondary">
                      {word.pronunciation}
                    </span>
                    <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${levelColors[word.level]}`}>

                      {word.level}
                    </span>
                  </div>
                  <p className="text-secondary mt-1">{word.definition}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 md:gap-12">
                <div className="hidden md:block text-right">
                  <div className="text-xs text-muted mb-1">Mastery</div>
                  <div className="w-24 h-1.5 bg-black/40 rounded-full overflow-hidden">
                    <div
                    className="h-full bg-accent"
                    style={{
                      width: `${word.mastery}%`
                    }} />

                  </div>
                </div>

                <div className="hidden md:block text-right">
                  <div className="text-xs text-muted mb-1">Last seen</div>
                  <div className="text-sm text-secondary">
                    {word.lastReviewed}
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-muted group-hover:text-primary transition-colors" />
              </div>
            </div>
          </motion.div>
        )}

        {filteredWords.length === 0 &&
        <div className="text-center py-20">
            <p className="text-muted text-lg">
              No words found matching your criteria.
            </p>
          </div>
        }
      </div>
    </div>);

}