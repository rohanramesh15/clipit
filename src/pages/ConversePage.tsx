import React, { useEffect, useState, useRef, Component } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Phone,
  Mic,
  Send,
  X,
  MoreVertical,
  PhoneOff,
  MicOff,
  Sparkles,
  Wand2,
  ChefHat,
  Search } from
'lucide-react';
// --- Types ---
interface Character {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  icon: React.ElementType;
  description: string;
  greeting: string;
}
interface Message {
  id: string;
  sender: 'user' | 'character';
  text: string;
  timestamp: string;
}
// --- Mock Data ---
const CHARACTERS: Character[] = [
{
  id: 'wizard',
  name: 'Merlin le Sage',
  role: 'Wizard',
  avatarColor: 'bg-purple-600',
  icon: Wand2,
  description: 'Practice magical spells and ancient wisdom.',
  greeting:
  "Bonjour, jeune apprenti. Quelle magie veux-tu apprendre aujourd'hui?"
},
{
  id: 'chef',
  name: 'Chef Gusteau',
  role: 'Culinary Master',
  avatarColor: 'bg-orange-500',
  icon: ChefHat,
  description: 'Discuss recipes, ingredients, and fine dining.',
  greeting: "Bienvenue dans ma cuisine! Qu'allons-nous cuisiner ce soir?"
},
{
  id: 'detective',
  name: 'Sherlock',
  role: 'Detective',
  avatarColor: 'bg-slate-600',
  icon: Search,
  description: 'Solve mysteries and discuss clues.',
  greeting: 'Élémentaire, mon cher. Avez-vous trouvé des indices?'
}];

const INITIAL_MESSAGES: Record<string, Message[]> = {
  wizard: [
  {
    id: '1',
    sender: 'character',
    text: "Bonjour, jeune apprenti. Quelle magie veux-tu apprendre aujourd'hui?",
    timestamp: '10:00 AM'
  }],

  chef: [
  {
    id: '1',
    sender: 'character',
    text: "Bienvenue dans ma cuisine! Qu'allons-nous cuisiner ce soir?",
    timestamp: '10:00 AM'
  }],

  detective: [
  {
    id: '1',
    sender: 'character',
    text: 'Élémentaire, mon cher. Avez-vous trouvé des indices?',
    timestamp: '10:00 AM'
  }]

};
// --- Components ---
export function ConversePage() {
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(
    CHARACTERS[0]
  );
  const [mode, setMode] = useState<'text' | 'call'>('text');
  const [messages, setMessages] =
  useState<Record<string, Message[]>>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentMessages = messages[selectedCharacter.id] || [];
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  };
  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, mode]);
  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputText,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
    setMessages((prev) => ({
      ...prev,
      [selectedCharacter.id]: [
      ...(prev[selectedCharacter.id] || []),
      newMessage]

    }));
    setInputText('');
    // Simulate character response
    setTimeout(() => {
      const response: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'character',
        text: "C'est très intéressant! Dites-m'en plus.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      };
      setMessages((prev) => ({
        ...prev,
        [selectedCharacter.id]: [
        ...(prev[selectedCharacter.id] || []),
        response]

      }));
    }, 1500);
  };
  const startCall = () => {
    setMode('call');
    setIsCallActive(true);
  };
  const endCall = () => {
    setIsCallActive(false);
    setTimeout(() => setMode('text'), 300);
  };
  return (
    <div className="h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] max-w-6xl mx-auto flex flex-col md:flex-row gap-6 overflow-hidden">
      {/* Character List (Sidebar on Desktop) */}
      <div className="w-full md:w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto md:pr-2">
        <h2 className="text-2xl font-heading font-bold text-primary px-2">
          Characters
        </h2>
        <div className="flex flex-col gap-2">
          {CHARACTERS.map((char) =>
          <button
            key={char.id}
            onClick={() => {
              setSelectedCharacter(char);
              setMode('text'); // Reset to text when switching
              setIsCallActive(false);
            }}
            className={`
                flex items-center gap-4 p-3 rounded-xl border transition-all text-left
                ${selectedCharacter.id === char.id ? 'bg-surface border-accent/50 ring-1 ring-accent/20' : 'bg-surface/50 border-white/5 hover:bg-surface hover:border-white/10'}
              `}>

              <div
              className={`w-12 h-12 rounded-full ${char.avatarColor} flex items-center justify-center text-white shadow-lg`}>

                <char.icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3
                className={`font-bold truncate ${selectedCharacter.id === char.id ? 'text-primary' : 'text-secondary'}`}>

                  {char.name}
                </h3>
                <p className="text-xs text-muted truncate">{char.role}</p>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Main Conversation Area */}
      <div className="flex-1 flex flex-col bg-surface border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-surface/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full ${selectedCharacter.avatarColor} flex items-center justify-center text-white`}>

              <selectedCharacter.icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-primary">
                {selectedCharacter.name}
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-secondary">Online</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-app/50 p-1 rounded-lg border border-white/5">
            <button
              onClick={() => setMode('text')}
              className={`p-2 rounded-md transition-all ${mode === 'text' ? 'bg-white/10 text-primary' : 'text-secondary hover:text-primary'}`}>

              <MessageCircle className="w-5 h-5" />
            </button>
            <button
              onClick={startCall}
              className={`p-2 rounded-md transition-all ${mode === 'call' ? 'bg-white/10 text-primary' : 'text-secondary hover:text-primary'}`}>

              <Phone className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {/* TEXT MODE */}
            {mode === 'text' &&
            <motion.div
              key="text-mode"
              initial={{
                opacity: 0,
                x: -20
              }}
              animate={{
                opacity: 1,
                x: 0
              }}
              exit={{
                opacity: 0,
                x: 20
              }}
              className="flex-1 flex flex-col h-full">

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {currentMessages.map((msg) =>
                <motion.div
                  key={msg.id}
                  initial={{
                    opacity: 0,
                    y: 10
                  }}
                  animate={{
                    opacity: 1,
                    y: 0
                  }}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>

                      <div
                    className={`
                        max-w-[80%] rounded-2xl px-5 py-3 shadow-sm
                        ${msg.sender === 'user' ? 'bg-accent text-app rounded-tr-sm' : 'bg-white/10 text-primary rounded-tl-sm'}
                      `}>

                        <p className="text-sm md:text-base leading-relaxed">
                          {msg.text}
                        </p>
                        <p
                      className={`text-[10px] mt-1 opacity-60 ${msg.sender === 'user' ? 'text-app/80' : 'text-secondary'}`}>

                          {msg.timestamp}
                        </p>
                      </div>
                    </motion.div>
                )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-white/5 bg-surface/50 backdrop-blur-md">
                  <form onSubmit={handleSendMessage} className="flex gap-3">
                    <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Message ${selectedCharacter.name}...`}
                    className="flex-1 bg-app border border-white/10 rounded-xl px-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors" />

                    <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="p-3 rounded-xl bg-accent text-app hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors">

                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </div>
              </motion.div>
            }

            {/* CALL MODE */}
            {mode === 'call' &&
            <motion.div
              key="call-mode"
              initial={{
                opacity: 0,
                y: 20
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              exit={{
                opacity: 0,
                y: 20
              }}
              className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">

                {/* Background Glow */}
                <div
                className={`absolute inset-0 opacity-20 bg-gradient-to-b from-${selectedCharacter.avatarColor.replace('bg-', '')}/20 to-transparent`} />


                {/* Avatar */}
                <div className="relative mb-12">
                  {/* Pulsing Rings */}
                  <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0, 0.5]
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    ease: 'easeInOut'
                  }}
                  className={`absolute inset-0 rounded-full ${selectedCharacter.avatarColor} blur-xl opacity-30`} />

                  <div
                  className={`relative w-40 h-40 rounded-full ${selectedCharacter.avatarColor} flex items-center justify-center shadow-2xl border-4 border-surface`}>

                    <selectedCharacter.icon className="w-20 h-20 text-white" />
                  </div>
                </div>

                {/* Status */}
                <div className="text-center mb-16">
                  <h2 className="text-3xl font-heading font-bold text-primary mb-2">
                    {selectedCharacter.name}
                  </h2>
                  <p className="text-accent animate-pulse font-medium">
                    Speaking...
                  </p>
                </div>

                {/* Waveform Visualization (Simulated) */}
                <div className="flex items-center gap-1 h-12 mb-16">
                  {Array.from({
                  length: 12
                }).map((_, i) =>
                <motion.div
                  key={i}
                  className="w-1.5 bg-white/20 rounded-full"
                  animate={{
                    height: [10, Math.random() * 40 + 10, 10]
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.8,
                    delay: i * 0.1
                  }} />

                )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-6">
                  <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-4 rounded-full border transition-all ${isMuted ? 'bg-white text-app border-white' : 'bg-white/10 text-primary border-white/10 hover:bg-white/20'}`}>

                    {isMuted ?
                  <MicOff className="w-6 h-6" /> :

                  <Mic className="w-6 h-6" />
                  }
                  </button>

                  <button
                  onClick={endCall}
                  className="p-6 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all hover:scale-105">

                    <PhoneOff className="w-8 h-8" />
                  </button>
                </div>
              </motion.div>
            }
          </AnimatePresence>
        </div>
      </div>
    </div>);

}