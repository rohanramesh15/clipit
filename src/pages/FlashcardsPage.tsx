import React, { useState, useEffect, useCallback, useRef } from 'react';
declare function gtag(...args: unknown[]): void;
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '../components/Skeleton';
import {
  ArrowLeft,
  RotateCw,
  RotateCcw,
  Check,
  X,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Tv,
  Layers,
  Clock,
  Trophy,
  Play,
  ExternalLink,
  Volume2,
  VolumeX,
  Trash2,
  Pencil,
  ArrowUpDown,
  Film,
  Calendar,
  Search,
  FolderPlus,
  Folder,
  Plus,
  ChevronRight,
  MoreVertical,
  FolderOpen,
} from 'lucide-react';
import { rateCard, sortByPriority, getDueCards, getCardStats, previewNextReviews, Rating } from '../services/fsrs';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useReviewSession } from '../context/ReviewSessionContext';
import { API_BASE_URL } from '../config';
import { HelpOverlay, HelpTip } from '../components/HelpOverlay';
import { Sparkles, BookOpen, LogOut } from 'lucide-react';

// Vocabulary list types
interface VocabList {
  id: number;
  name: string;
  language: string;
  word_count: number;
}

const flashcardsPageTips: HelpTip[] = [
  {
    id: 'deck-select',
    text: 'Switch between decks or review all cards at once.',
    targetId: 'section-deck-select',
    position: 'bottom',
  },
  {
    id: 'flashcard',
    text: 'Tap the card to flip and reveal the translation.',
    targetId: 'section-flashcard',
    position: 'right',
  },
  {
    id: 'rating-buttons',
    text: 'Rate how well you knew the word. This schedules the next review.',
    targetId: 'section-rating-buttons',
    position: 'top',
  },
];

// Netflix video placeholder component with screenshot and audio support
function NetflixVideoPlaceholder({ videoId, timestamp }: { videoId: string; timestamp: number }) {
  const [hasScreenshot, setHasScreenshot] = React.useState<boolean | null>(null);
  const [hasAudio, setHasAudio] = React.useState<boolean>(false);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const roundedTimestamp = Math.floor(timestamp);
  const netflixId = videoId.replace('netflix_', '');
  const timeStr = `${Math.floor(timestamp / 60)}:${String(Math.floor(timestamp % 60)).padStart(2, '0')}`;

  // Check if screenshot and audio exist
  React.useEffect(() => {
    fetch(`${API_BASE_URL}/netflix/screenshot/${videoId}/${roundedTimestamp}`, { method: 'HEAD' })
      .then(res => setHasScreenshot(res.ok))
      .catch(() => setHasScreenshot(false));

    fetch(`${API_BASE_URL}/netflix/audio/${videoId}/${roundedTimestamp}`, { method: 'HEAD' })
      .then(res => setHasAudio(res.ok))
      .catch(() => setHasAudio(false));
  }, [videoId, roundedTimestamp]);

  // Auto-play audio when component mounts (if available)
  React.useEffect(() => {
    if (hasAudio && audioRef.current) {
      audioRef.current.play().catch(() => {
        // Auto-play blocked, user needs to click
      });
    }
  }, [hasAudio]);

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } else {
      // Reset to beginning before playing (in case audio ended)
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  return (
    <div className="w-full h-full relative bg-gradient-to-br from-[#1a1a2e] to-[#2d1f3d]">
      {/* Audio element (hidden) */}
      {hasAudio && (
        <audio
          ref={audioRef}
          src={`${API_BASE_URL}/netflix/audio/${videoId}/${roundedTimestamp}`}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {hasScreenshot ? (
        <>
          <img
            src={`${API_BASE_URL}/netflix/screenshot/${videoId}/${roundedTimestamp}`}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setHasScreenshot(false)}
          />
          {/* Audio control button overlay */}
          {hasAudio && (
            <button
              onClick={toggleAudio}
              className="absolute bottom-3 right-3 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
              title={isPlaying ? 'Stop audio' : 'Play audio'}
            >
              {isPlaying ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-[#e50914] flex items-center justify-center mb-2">
            <span className="text-white font-bold text-xl">N</span>
          </div>
          <a
            href={`https://www.netflix.com/watch/${netflixId}?t=${roundedTimestamp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#e50914] hover:bg-[#f6121d] text-white text-sm font-medium transition-colors shadow-lg"
          >
            <Play className="w-4 h-4" />
            Watch on Netflix
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
          <p className="text-white/50 text-xs mt-2">{timeStr}</p>
          {/* Audio button when no screenshot */}
          {hasAudio && (
            <button
              onClick={toggleAudio}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
            >
              {isPlaying ? (
                <><VolumeX className="w-4 h-4" /> Stop</>
              ) : (
                <><Volume2 className="w-4 h-4" /> Play Audio</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Preload voices on module load
let voicesLoaded = false;
let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices() {
  cachedVoices = window.speechSynthesis.getVoices();
  if (cachedVoices.length > 0) {
    voicesLoaded = true;
    const koreanVoices = cachedVoices.filter(v => v.lang.startsWith('ko'));
    console.log('[TTS] Loaded Korean voices:', koreanVoices.map(v => v.name));
  }
}

// Try to load voices immediately
loadVoices();
// Also listen for voiceschanged event
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// Simple TTS function matching dictionary implementation
function playTTSWord(word: string, lang: string) {
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = lang === 'uk' ? 'uk-UA' : lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-US' : 'ko-KR';
  utterance.rate = 0.9;

  // Use cached voices or try to get them again
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  const langPrefix = lang === 'uk' ? 'uk' : lang === 'es' ? 'es' : lang === 'en' ? 'en' : 'ko';

  // Prefer natural voices: Google > Yuna > Sora > any non-Eddy > Eddy
  const targetVoice = voices.find(v => v.lang.startsWith(langPrefix) && v.name.includes('Google'))
    || voices.find(v => v.lang.startsWith(langPrefix) && v.name.includes('Yuna'))
    || voices.find(v => v.lang.startsWith(langPrefix) && v.name.includes('Sora'))
    || voices.find(v => v.lang.startsWith(langPrefix) && !v.name.includes('Eddy') && !v.name.includes('Rocko') && !v.name.includes('Shelley'))
    || voices.find(v => v.lang.startsWith(langPrefix));

  if (targetVoice) {
    utterance.voice = targetVoice;
    console.log('[TTS] Using voice:', targetVoice.name);
  }

  window.speechSynthesis.speak(utterance);
}

// TTS Card placeholder component - displays word with audio button (no video context)
function TTSCardPlaceholder({
  word,
  language
}: {
  word: string;
  language: string;
}) {
  const [isPlaying, setIsPlaying] = React.useState(false);

  const playAudio = React.useCallback(() => {
    setIsPlaying(true);
    playTTSWord(word, language);
    // Reset after typical speech duration
    setTimeout(() => setIsPlaying(false), 1500);
  }, [word, language]);

  // Auto-play on mount with delay for voices to load
  React.useEffect(() => {
    const timer = setTimeout(() => {
      playAudio();
    }, 300);

    return () => clearTimeout(timer);
  }, [word, playAudio]);

  return (
    <div className="w-full h-full relative bg-gradient-to-br from-purple-900/30 to-accent/20 flex flex-col items-center justify-center">
      <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mb-4">
        <button
          onClick={playAudio}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            isPlaying
              ? 'bg-accent text-app scale-110'
              : 'bg-white/10 text-accent hover:bg-accent hover:text-app'
          }`}
        >
          <Volume2 className={`w-8 h-8 ${isPlaying ? 'animate-pulse' : ''}`} />
        </button>
      </div>
      <p className="text-white/60 text-sm">
        {isPlaying ? 'Playing...' : 'Tap to hear pronunciation'}
      </p>
    </div>
  );
}

interface FlashCard {
  target_word: string;
  dictionary_form: string;
  english: string;
  sentence: string | null;
  sentence_translation: string | null;
  timestamp: number | null;
  end_timestamp: number | null;
  video_id: string | null;
  rank?: number;
  card_type?: 'tts' | 'video';
}

interface TrackedVideo {
  video_id: string;
  title: string;
  tracked_at: number;
  season?: number | null;
  episode?: number | null;
  episode_title?: string | null;
  building?: boolean;  // True if ClipIt is still building this deck
}

type LoadState = 'loading' | 'deck-select' | 'loaded' | 'error' | 'no-videos' | 'no-vocab' | 'session-complete' | 'time-gated-complete';

type SortOption = 'recent' | 'alphabetical' | 'oldest';

// Folder for organizing video decks
interface VideoFolder {
  id: string;
  name: string;
  videoIds: string[];
  createdAt: number;
}

// Folder persistence helpers
const FOLDERS_KEY = 'lipit_video_folders';

function getFolders(): VideoFolder[] {
  try {
    const stored = localStorage.getItem(FOLDERS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function saveFolders(folders: VideoFolder[]) {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  } catch {
    // Ignore storage errors
  }
}

// Format next review time
function formatNextReview(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

// Get responsive font size based on word/definition length
function getWordFontSize(text: string): string {
  const len = text.length;
  if (len > 20) return 'text-xl md:text-2xl';
  if (len > 15) return 'text-2xl md:text-3xl';
  if (len > 12) return 'text-3xl md:text-4xl';
  if (len > 8) return 'text-4xl md:text-5xl';
  return 'text-5xl md:text-6xl';
}

// Deleted cards persistence
const DELETED_CARDS_KEY = 'lipit_deleted_cards';

function getDeletedCards(language: string): Set<string> {
  try {
    const stored = localStorage.getItem(DELETED_CARDS_KEY);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    return new Set(parsed[language] || []);
  } catch {
    return new Set();
  }
}

function addDeletedCard(language: string, word: string) {
  try {
    const stored = localStorage.getItem(DELETED_CARDS_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    if (!parsed[language]) parsed[language] = [];
    if (!parsed[language].includes(word)) {
      parsed[language].push(word);
    }
    localStorage.setItem(DELETED_CARDS_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage errors
  }
}

type Page = 'video' | 'practice' | 'flashcards' | 'analytics' | 'vocabulary' | 'converse-v2' | 'madlibs' | 'settings';

interface FlashcardsPageProps {
  onNavigate?: (page: Page) => void;
}

export function FlashcardsPage({ onNavigate }: FlashcardsPageProps) {
  const { language, languageName } = useLanguage();
  const { token } = useAuth();
  const {
    session,
    startSession,
    endSession,
    recordCardReview,
    extendSession,
    resetSession,
    setCardsReviewedToday,
    getGoalLabel,
  } = useReviewSession();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [dueCards, setDueCards] = useState<FlashCard[]>([]);
  const [videos, setVideos] = useState<TrackedVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedVideoTitle, setSelectedVideoTitle] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Loading watch history...');
  const [lastRatingInfo, setLastRatingInfo] = useState<{ word: string; nextDue: string } | null>(null);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
  const [isEditingDefinition, setIsEditingDefinition] = useState(false);
  const [editedDefinition, setEditedDefinition] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [showDeleteVideoConfirm, setShowDeleteVideoConfirm] = useState<TrackedVideo | null>(null);
  const [isDeletingVideo, setIsDeletingVideo] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [folders, setFolders] = useState<VideoFolder[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showJoinClass, setShowJoinClass] = useState(false);
  const [isJoiningClass, setIsJoiningClass] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [showLeaveClass, setShowLeaveClass] = useState(false);
  const [isLeavingClass, setIsLeavingClass] = useState(false);
  const [enrolledClasses, setEnrolledClasses] = useState<Array<{class_code: string, class_name: string, lists_count: number, words_count: number}>>([]);
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(false);
  const [confirmLeaveClass, setConfirmLeaveClass] = useState<{class_code: string, class_name: string} | null>(null);
  const [editingFolder, setEditingFolder] = useState<VideoFolder | null>(null);
  const [addingToFolder, setAddingToFolder] = useState<TrackedVideo | null>(null);
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
  const [draggingVideoId, setDraggingVideoId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [vocabLists, setVocabLists] = useState<VocabList[]>([]);
  const [selectedVocabListId, setSelectedVocabListId] = useState<number | null>(null);
  const [selectedVocabListWords, setSelectedVocabListWords] = useState<Set<string>>(new Set());
  const [selectedVocabListName, setSelectedVocabListName] = useState<string>('');
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const loopIntervalRef = useRef<number | null>(null);

  const cleanupYouTubePlayer = useCallback(() => {
    if (loopIntervalRef.current) {
      clearInterval(loopIntervalRef.current);
      loopIntervalRef.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch {
        // The iframe API can race with React unmounts while cards change.
      }
      playerRef.current = null;
    }
    if (playerContainerRef.current) {
      playerContainerRef.current.replaceChildren();
    }
  }, []);

  // Play text using Web Speech API
  const playTTS = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'uk' ? 'uk-UA' : language === 'es' ? 'es-ES' : language === 'en' ? 'en-US' : 'ko-KR';
    utterance.rate = 0.9;

    const voices = window.speechSynthesis.getVoices();
    const langPrefix = language === 'uk' ? 'uk' : language === 'es' ? 'es' : language === 'en' ? 'en' : 'ko';
    // Prefer Google voice, then any language-specific voice, then any voice
    const targetVoice = voices.find(v => v.lang.startsWith(langPrefix) && v.name.includes('Google'))
      || voices.find(v => v.lang.startsWith(langPrefix))
      || voices[0]; // Fallback to first available voice

    if (targetVoice) {
      utterance.voice = targetVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, [language]);

  useEffect(() => {
    gtag('event', 'conversion', {
      'send_to': 'AW-18115152337/s3QjCOHmyqEcENGT_b1D',
      'value': 0,
      'currency': 'USD'
    });
  }, []);

  // Load folders from localStorage on mount
  useEffect(() => {
    setFolders(getFolders());
  }, []);

  // Fetch vocabulary lists
  const fetchVocabLists = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/lists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const lists = await res.json();
        setVocabLists(lists);
      }
    } catch (err) {
      console.error('Failed to fetch vocab lists:', err);
    }
  }, [token]);

  // Fetch vocabulary lists on mount and sync enrolled classes
  useEffect(() => {
    fetchVocabLists();
    // Auto-sync enrolled classes to get any new vocabulary
    syncEnrolledClasses();
  }, [fetchVocabLists]);

  // Set default to "my words" if user has vocab lists and setting is enabled
  useEffect(() => {
    if (vocabLists.length > 0 && selectedVocabListId === null) {
      const defaultMode = localStorage.getItem('default_study_mode') || 'my-words';
      if (defaultMode === 'my-words') {
        setSelectedVocabListId(-1);
      }
    }
  }, [vocabLists, selectedVocabListId]);

  // Join a class to get pre-made vocab lists
  async function handleJoinClass() {
    if (!classCode.trim() || !token) return;
    setIsJoiningClass(true);
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/join-class`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ class_code: classCode.trim() }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.detail || 'Failed to join class');
        return;
      }
      const data = await res.json();
      alert(`Successfully joined ${data.class_name}! ${data.words_added} words added to your vocab lists.`);
      setShowJoinClass(false);
      setClassCode('');
      // Refresh vocab lists
      fetchVocabLists();
    } catch (err) {
      console.error('Error joining class:', err);
      alert('Failed to join class. Please try again.');
    } finally {
      setIsJoiningClass(false);
    }
  }

  // Fetch enrolled classes
  async function fetchEnrolledClasses() {
    if (!token) return;
    setIsLoadingEnrolled(true);
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/enrolled-classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEnrolledClasses(data.classes || []);
      }
    } catch (err) {
      console.error('Error fetching enrolled classes:', err);
    } finally {
      setIsLoadingEnrolled(false);
    }
  }

  // Sync all enrolled classes to get new vocabulary
  async function syncEnrolledClasses() {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/enrolled-classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      const classes = data.classes || [];

      let totalNewWords = 0;
      for (const cls of classes) {
        try {
          const syncRes = await fetch(`${API_BASE_URL}/vocab/sync-class`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ class_code: cls.class_code }),
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            totalNewWords += syncData.words_added || 0;
          }
        } catch (err) {
          console.error(`Error syncing class ${cls.class_code}:`, err);
        }
      }

      // Refresh vocab lists if any new words were added
      if (totalNewWords > 0) {
        console.log(`Synced ${totalNewWords} new words from enrolled classes`);
        fetchVocabLists();
      }
    } catch (err) {
      console.error('Error syncing enrolled classes:', err);
    }
  }

  // Open leave class modal and fetch enrolled classes
  function openLeaveClassModal() {
    setShowLeaveClass(true);
    fetchEnrolledClasses();
  }

  // Leave a class and remove all associated vocab lists
  async function handleLeaveClass(classCode: string) {
    if (!classCode || !token) return;
    setIsLeavingClass(true);
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/leave-class`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ class_code: classCode }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.detail || 'Failed to leave class');
        return;
      }
      setShowLeaveClass(false);
      setConfirmLeaveClass(null);
      // Refresh vocab lists
      fetchVocabLists();
    } catch (err) {
      console.error('Error leaving class:', err);
      alert('Failed to leave class. Please try again.');
    } finally {
      setIsLeavingClass(false);
    }
  }

  // Create a new folder
  function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    const newFolder: VideoFolder = {
      id: `folder_${Date.now()}`,
      name: newFolderName.trim(),
      videoIds: [],
      createdAt: Date.now(),
    };
    const updatedFolders = [...folders, newFolder];
    setFolders(updatedFolders);
    saveFolders(updatedFolders);
    setNewFolderName('');
    setShowCreateFolder(false);
  }

  // Add video to folder
  function handleAddToFolder(video: TrackedVideo, folderId: string) {
    const updatedFolders = folders.map(f => {
      if (f.id === folderId && !f.videoIds.includes(video.video_id)) {
        return { ...f, videoIds: [...f.videoIds, video.video_id] };
      }
      return f;
    });
    setFolders(updatedFolders);
    saveFolders(updatedFolders);
    setAddingToFolder(null);
  }

  // Remove video from folder
  function handleRemoveFromFolder(videoId: string, folderId: string) {
    const updatedFolders = folders.map(f => {
      if (f.id === folderId) {
        return { ...f, videoIds: f.videoIds.filter(id => id !== videoId) };
      }
      return f;
    });
    setFolders(updatedFolders);
    saveFolders(updatedFolders);
  }

  // Delete folder
  function handleDeleteFolder(folderId: string) {
    const updatedFolders = folders.filter(f => f.id !== folderId);
    setFolders(updatedFolders);
    saveFolders(updatedFolders);
    setEditingFolder(null);
  }

  // Rename folder
  function handleRenameFolder(folderId: string, newName: string) {
    if (!newName.trim()) return;
    const updatedFolders = folders.map(f => {
      if (f.id === folderId) {
        return { ...f, name: newName.trim() };
      }
      return f;
    });
    setFolders(updatedFolders);
    saveFolders(updatedFolders);
    setEditingFolder(null);
  }

  // Drag and drop handlers
  function handleDragStart(e: React.DragEvent, videoId: string) {
    setDraggingVideoId(videoId);
    e.dataTransfer.setData('text/plain', videoId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    setDraggingVideoId(null);
    setDragOverFolderId(null);
  }

  function handleDragOver(e: React.DragEvent, folderId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverFolderId !== folderId) {
      setDragOverFolderId(folderId);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear if we're leaving the folder element entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverFolderId(null);
    }
  }

  function handleDrop(e: React.DragEvent, folderId: string) {
    e.preventDefault();
    const videoId = e.dataTransfer.getData('text/plain');
    if (videoId) {
      const video = videos.find(v => v.video_id === videoId);
      if (video) {
        handleAddToFolder(video, folderId);
      }
    }
    setDraggingVideoId(null);
    setDragOverFolderId(null);
  }

  // Load YouTube IFrame API
  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }
  }, []);

  // Destroy player when deck changes to force recreation
  useEffect(() => {
    cleanupYouTubePlayer();
  }, [selectedVideoId, cleanupYouTubePlayer]);

  // Check if a video is from Netflix
  const isNetflixVideo = (videoId: string) => videoId.startsWith('netflix_');

  // Create/update YouTube player when card changes (skip for Netflix)
  useEffect(() => {
    const card = dueCards[currentIndex];
    if (loadState !== 'loaded' || !card) {
      cleanupYouTubePlayer();
      return;
    }

    const shouldUseYouTube = card.card_type === 'video' && card.video_id && !isNetflixVideo(card.video_id);
    if (!shouldUseYouTube || !playerContainerRef.current) {
      cleanupYouTubePlayer();
      return;
    }

    cleanupYouTubePlayer();

    // Add 3 seconds buffer to end timestamp (timestamp is guaranteed non-null here since we have video_id)
    const startTime = card.timestamp ?? 0;
    const endTime = (card.end_timestamp || startTime + 5) + 3;
    let isCancelled = false;

    const setupLooping = (player: any) => {
      if (loopIntervalRef.current) {
        clearInterval(loopIntervalRef.current);
      }
      loopIntervalRef.current = window.setInterval(() => {
        try {
          const currentTime = player.getCurrentTime();
          if (currentTime >= endTime) {
            player.seekTo(startTime, true);
          }
        } catch (e) {
          // Player not ready yet
        }
      }, 200);
    };

    const initPlayer = () => {
      if (isCancelled) return;
      // Create new player
      if (!playerContainerRef.current) return;

      const playerMount = document.createElement('div');
      playerMount.className = 'w-full h-full';
      playerContainerRef.current.replaceChildren(playerMount);

      playerRef.current = new (window as any).YT.Player(playerMount, {
        videoId: card.video_id,
        playerVars: {
          start: startTime,
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event: any) => {
            setupLooping(event.target);
          },
        },
      });
    };

    // Wait for YT API to be ready
    const waitForYT = () => {
      if (isCancelled) return;
      if ((window as any).YT && (window as any).YT.Player) {
        initPlayer();
      } else {
        setTimeout(waitForYT, 100);
      }
    };

    waitForYT();

    return () => {
      isCancelled = true;
      if (loopIntervalRef.current) {
        clearInterval(loopIntervalRef.current);
      }
    };
  }, [currentIndex, loadState, dueCards, cleanupYouTubePlayer]);

  // Check if a Netflix screenshot exists for a given video/timestamp
  const checkScreenshotExists = async (videoId: string, timestamp: number): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/netflix/screenshot/${videoId}/${Math.floor(timestamp)}`, { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  };

  // Fetch flashcards for a single video. Returns cards array (empty if failed/no vocab).
  const fetchCardsForVideo = useCallback(async (videoId: string): Promise<FlashCard[]> => {
    try {
      await fetch(`${API_BASE_URL}/subtitles/${videoId}?lang=${language}`);

      const vocabRes = await fetch(`${API_BASE_URL}/vocabulary/${videoId}?limit=20&lang=${language}`);
      if (!vocabRes.ok) return [];
      const vocab = await vocabRes.json();
      if (!vocab.total_words) return [];

      const wordList = vocab.vocabulary.map((v: { word: string }) => v.word);
      const fcRes = await fetch(`${API_BASE_URL}/flashcard-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId, words: wordList, word_source: 'essential', language }),
      });
      if (!fcRes.ok) return [];
      const fc = await fcRes.json();

      // Attach rank from vocab to each card
      const rankMap: Record<string, number> = {};
      vocab.vocabulary.forEach((v: { word: string; rank: number }) => { rankMap[v.word] = v.rank; });
      let cards = (fc.flashcards || []).map((card: FlashCard) => ({
        ...card,
        card_type: 'video',
        video_id: card.video_id || videoId,
        rank: rankMap[card.target_word],
      }));

      // For Netflix videos, only show cards that have screenshots
      if (videoId.startsWith('netflix_') && cards.length > 0) {
        const screenshotChecks = await Promise.all(
          cards.map((card: FlashCard) => checkScreenshotExists(videoId, card.timestamp ?? 0))
        );
        const cardsWithScreenshots = cards.filter((_: FlashCard, i: number) => screenshotChecks[i]);
        console.log(`[ClipIt] Netflix cards: ${cardsWithScreenshots.length}/${cards.length} have screenshots`);

        // Only show Netflix cards that have screenshots
        cards = cardsWithScreenshots;
      }

      // Filter out deleted cards
      const deletedCards = getDeletedCards(language);
      cards = cards.filter((card: FlashCard) => {
        const word = card.dictionary_form || card.target_word;
        return !deletedCards.has(word);
      });

      return cards;
    } catch {
      return [];
    }
  }, [language]);

  // Sort cards by FSRS priority and filter to due cards
  const prepareCardsForReview = useCallback((allCards: FlashCard[]) => {
    // Deduplicate by dictionary_form (keep first occurrence)
    const seen = new Set<string>();
    const uniqueCards = allCards.filter(c => {
      const key = c.dictionary_form || c.target_word;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const words = uniqueCards.map(c => c.dictionary_form || c.target_word);
    const sortedWords = sortByPriority(words);
    const dueWords = getDueCards(words);

    // Reorder cards by sorted priority
    const cardMap = new Map(uniqueCards.map(c => [c.dictionary_form || c.target_word, c]));
    const sortedCards = sortedWords.map(w => cardMap.get(w)!).filter(Boolean);
    const dueCardsFiltered = sortedCards.filter(c => dueWords.includes(c.dictionary_form || c.target_word));

    setCards(sortedCards);
    setDueCards(dueCardsFiltered);
    setSessionStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });

    if (dueCardsFiltered.length === 0 && sortedCards.length > 0) {
      // No cards due - show completion screen
      setLoadState('session-complete');
    } else if (!session.isExtended && session.cardsReviewed >= session.sessionCap) {
      setLoadState('time-gated-complete');
    } else {
      setLoadState('loaded');
      // Start the review session timer
      startSession();
    }
  }, [session.cardsReviewed, session.isExtended, session.sessionCap, startSession]);

  // Load cards for "All Videos" mode
  const loadAllVideos = useCallback(async (videoList: TrackedVideo[]) => {
    setLoadState('loading');
    setLoadingMsg('Loading flashcards from all videos...');
    setCards([]);
    setDueCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedVideoId('all');
    setSelectedVideoTitle('All Videos');
    setSelectedVocabListId(null);
    setSelectedVocabListWords(new Set());
    setSelectedVocabListName('');
    setLastRatingInfo(null);

    const allCards: FlashCard[] = [];
    for (const video of videoList) {
      setLoadingMsg(`Loading: ${video.title.slice(0, 40)}...`);
      const videoCards = await fetchCardsForVideo(video.video_id);
      allCards.push(...videoCards);
    }

    if (!allCards.length) {
      setLoadState('no-vocab');
      return;
    }
    prepareCardsForReview(allCards);
  }, [fetchCardsForVideo, prepareCardsForReview]);

  // Load cards for a single video.
  const loadFlashcards = useCallback(async (videoId: string, videoTitle: string) => {
    setLoadState('loading');
    setLoadingMsg('Fetching subtitles...');
    setCards([]);
    setDueCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedVideoId(videoId);
    setSelectedVideoTitle(videoTitle);
    setSelectedVocabListId(null);
    setSelectedVocabListWords(new Set());
    setSelectedVocabListName('');
    setLastRatingInfo(null);

    setLoadingMsg('Extracting vocabulary...');
    const videoCards = await fetchCardsForVideo(videoId);

    if (!videoCards.length) {
      setLoadState('no-vocab');
      return;
    }
    prepareCardsForReview(videoCards);
  }, [fetchCardsForVideo, prepareCardsForReview]);

  // Load TTS-only flashcards from user vocabulary lists (no video required)
  const loadVocabTTSCards = useCallback(async (listId?: number) => {
    setLoadState('loading');
    setLoadingMsg('Loading your vocabulary...');
    setCards([]);
    setDueCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedVideoId(listId ? `vocablist_tts_${listId}` : 'vocablist_tts_all');
    setSelectedVideoTitle(listId
      ? vocabLists.find(l => l.id === listId)?.name || 'Vocabulary List'
      : 'My Vocabulary'
    );
    setSelectedVocabListId(listId || -1);  // -1 means "Study My Words" (all vocab lists)
    setSelectedVocabListName(listId ? (vocabLists.find(l => l.id === listId)?.name || '') : '');
    setSelectedVocabListWords(new Set());
    setLastRatingInfo(null);

    try {
      const url = listId
        ? `${API_BASE_URL}/vocab/lists/flashcards?list_id=${listId}&language=${language}`
        : `${API_BASE_URL}/vocab/lists/flashcards?language=${language}`;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error('Failed to fetch vocab flashcards');

      const data = await res.json();
      let ttsCards: FlashCard[] = data.flashcards.map((card: FlashCard) => ({
        ...card,
        card_type: 'tts',
        video_id: null,
        timestamp: null,
        end_timestamp: null,
      }));

      // Filter out deleted cards
      const deletedCards = getDeletedCards(language);
      ttsCards = ttsCards.filter(card => {
        const word = card.dictionary_form || card.target_word;
        return !deletedCards.has(word);
      });

      if (!ttsCards.length) {
        setLoadState('no-vocab');
        return;
      }

      prepareCardsForReview(ttsCards);
    } catch (err) {
      console.error('Failed to load vocab TTS cards:', err);
      setLoadState('error');
    }
  }, [language, token, vocabLists, prepareCardsForReview]);

  // Clear vocab list filter
  const clearVocabListFilter = useCallback(() => {
    setSelectedVocabListId(null);
    setSelectedVocabListWords(new Set());
    setSelectedVocabListName('');
  }, []);

  // Load flashcards for a folder (multiple videos)
  const loadFolderFlashcards = useCallback(async (folder: VideoFolder) => {
    const folderVideos = videos.filter(v => folder.videoIds.includes(v.video_id));
    if (folderVideos.length === 0) return;

    setLoadState('loading');
    setLoadingMsg(`Loading flashcards from "${folder.name}"...`);
    setCards([]);
    setDueCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedVideoId(`folder_${folder.id}`);
    setSelectedVideoTitle(folder.name);
    setSelectedVocabListId(null);
    setSelectedVocabListWords(new Set());
    setSelectedVocabListName('');
    setLastRatingInfo(null);

    const allCards: FlashCard[] = [];
    for (const video of folderVideos) {
      setLoadingMsg(`Loading: ${video.title.slice(0, 40)}...`);
      const videoCards = await fetchCardsForVideo(video.video_id);
      allCards.push(...videoCards);
    }

    if (!allCards.length) {
      setLoadState('no-vocab');
      return;
    }
    prepareCardsForReview(allCards);
  }, [videos, fetchCardsForVideo, prepareCardsForReview]);

  useEffect(() => {
    async function bootstrap() {
      try {
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        if (token) {
          const tzOffset = new Date().getTimezoneOffset();
          const todayRes = await fetch(`${API_BASE_URL}/fsrs/reviews/today?tz_offset_minutes=${tzOffset}`, { headers });
          if (todayRes.ok) {
            const todayData = await todayRes.json();
            setCardsReviewedToday(todayData.count || 0);
          }
        }

        const filteredRes = await fetch(`${API_BASE_URL}/videos/history/filtered?lang=${language}`, { headers });

        if (!filteredRes.ok) throw new Error();
        const filteredData = await filteredRes.json();
        const vids: TrackedVideo[] = filteredData.videos || [];
        setVideos(vids);

        if (!vids.length) {
          setLoadState('no-videos');
          return;
        }

        // Show deck selection screen instead of auto-loading
        setLoadState('deck-select');
      } catch {
        setLoadState('error');
      }
    }
    bootstrap();
  }, [language, token, setCardsReviewedToday]);

  const currentCard = dueCards[currentIndex];
  const progress = dueCards.length ? ((currentIndex + 1) / dueCards.length) * 100 : 0;
  const deckProgressTotal = dueCards.length;
  const deckProgressReviewed = Math.min(session.sessionReviewed, deckProgressTotal);
  const dailyGoalReviewed = Math.min(session.cardsReviewed, session.sessionCap);

  // Filter and sort videos based on search query and selected option
  const filteredAndSortedVideos = [...videos]
    .filter(v => {
      if (!searchQuery.trim()) return true;
      return v.title.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      switch (sortOption) {
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'oldest':
          return a.tracked_at - b.tracked_at;
        case 'recent':
        default:
          return b.tracked_at - a.tracked_at;
      }
    });

  // Get videos not in any folder (for the "Ungrouped" section)
  const videosInFolders = new Set(folders.flatMap(f => f.videoIds));
  const ungroupedVideos = filteredAndSortedVideos.filter(v => !videosInFolders.has(v.video_id));

  // Handle rating a card
  function handleRating(rating: Rating) {
    if (!currentCard) return;

    // Calculate clip duration (with 3 second buffer that's added during playback)
    // For TTS cards (no video), use a default duration of 5 seconds
    const startTs = currentCard.timestamp ?? 0;
    const clipDuration = currentCard.video_id
      ? (currentCard.end_timestamp || startTs + 5) - startTs + 3
      : 5;
    const { nextDue } = rateCard(currentCard.dictionary_form || currentCard.target_word, rating, clipDuration);
    const nextDueStr = formatNextReview(nextDue);
    const reviewedWord = currentCard.dictionary_form || currentCard.target_word;

    if (token) {
      fetch(`${API_BASE_URL}/fsrs/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          word: reviewedWord,
          language,
          rating,
          clip_duration: clipDuration,
          reviewed_at: new Date().toISOString(),
        }),
      }).catch((error) => {
        console.error('Failed to record review history:', error);
      });
    }

    // Record card review and check if cap was just reached
    const capJustReached = recordCardReview();

    // Update session stats
    const ratingKey = rating === Rating.Again ? 'again'
      : rating === Rating.Hard ? 'hard'
      : rating === Rating.Good ? 'good'
      : 'easy';
    setSessionStats(prev => ({
      ...prev,
      reviewed: prev.reviewed + 1,
      [ratingKey]: prev[ratingKey] + 1,
    }));

    setLastRatingInfo({ word: reviewedWord, nextDue: nextDueStr });
    setIsFlipped(false);

    setTimeout(() => {
      // Check if session cap was just reached (card count limit)
      if (capJustReached) {
        setLoadState('time-gated-complete');
        endSession();
        return;
      }

      if (currentIndex < dueCards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // All cards reviewed - session complete
        setLoadState('session-complete');
        endSession();
      }
      setLastRatingInfo(null);
    }, 300);
  }

  // Show delete confirmation modal
  function handleDeleteCard() {
    if (!currentCard) return;
    setShowDeleteConfirm(true);
  }

  // Actually delete the card after confirmation
  async function confirmDeleteCard() {
    if (!currentCard) return;

    const word = currentCard.dictionary_form || currentCard.target_word;
    setShowDeleteConfirm(false);

    // Remove this card from current session (but don't permanently block the word)
    // The word can come back with a new clip from future videos
    const newDueCards = dueCards.filter((_, i) => i !== currentIndex);
    const newCards = cards.filter(c => (c.dictionary_form || c.target_word) !== word);
    setCards(newCards);
    setDueCards(newDueCards);

    // Adjust index if needed
    if (currentIndex >= newDueCards.length && newDueCards.length > 0) {
      setCurrentIndex(newDueCards.length - 1);
    } else if (newDueCards.length === 0) {
      setLoadState('session-complete');
    }

    setIsFlipped(false);

    // Delete from API - removes current progress but allows word to be recreated
    try {
      await fetch(`${API_BASE_URL}/fsrs/cards/${encodeURIComponent(word)}?language=${language}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (error) {
      console.error('Failed to delete card from server:', error);
    }
  }

  // Revert video card back to TTS-only
  async function handleRevertToTTS() {
    if (!currentCard || currentCard.card_type !== 'video') return;
    setIsReverting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/words/revert-to-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          word: currentCard.target_word,
          language: language,
        }),
      });
      if (res.ok) {
        // Update card in current session to show as TTS
        setDueCards(prev => prev.map(c =>
          c.target_word === currentCard.target_word
            ? { ...c, card_type: 'tts', video_id: null, sentence: null, sentence_translation: null }
            : c
        ));
      }
    } catch (error) {
      console.error('Failed to revert card to TTS:', error);
    } finally {
      setIsReverting(false);
    }
  }

  // Start editing definition
  function handleStartEditDefinition() {
    if (!currentCard) return;
    setEditedDefinition(currentCard.english || '');
    setIsEditingDefinition(true);
  }

  // Save edited definition
  async function handleSaveDefinition() {
    if (!currentCard || !editedDefinition.trim()) {
      setIsEditingDefinition(false);
      return;
    }

    const word = currentCard.dictionary_form || currentCard.target_word;

    try {
      const res = await fetch(`${API_BASE_URL}/flashcard-definition`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          word,
          definition: editedDefinition.trim(),
          language,
        }),
      });

      if (res.ok) {
        // Update the card in local state
        const updateCardDefinition = (card: FlashCard) => {
          if ((card.dictionary_form || card.target_word) === word) {
            return { ...card, english: editedDefinition.trim() };
          }
          return card;
        };
        setCards(prev => prev.map(updateCardDefinition));
        setDueCards(prev => prev.map(updateCardDefinition));
      }
    } catch (error) {
      console.error('Failed to save definition:', error);
    } finally {
      setIsEditingDefinition(false);
    }
  }

  // Delete all flashcards for a specific video and remove from watch history
  async function handleDeleteVideoFlashcards(video: TrackedVideo) {
    setIsDeletingVideo(true);

    try {
      // Call API to delete flashcards for this video
      const flashcardsRes = await fetch(
        `${API_BASE_URL}/fsrs/cards/video/${encodeURIComponent(video.video_id)}?language=${language}`,
        {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      // Also delete the video from watch history
      await fetch(
        `${API_BASE_URL}/videos/${encodeURIComponent(video.video_id)}`,
        {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (flashcardsRes.ok) {
        // Remove cards from local state
        const newCards = cards.filter(c => c.video_id !== video.video_id);
        const newDueCards = dueCards.filter(c => c.video_id !== video.video_id);
        setCards(newCards);
        setDueCards(newDueCards);

        // Remove the video from the videos list (so it doesn't show in "All Videos")
        const newVideos = videos.filter(v => v.video_id !== video.video_id);
        setVideos(newVideos);

        // If the deleted video was currently selected, switch to "All Videos"
        if (selectedVideoId === video.video_id) {
          setSelectedVideoId('all');
          setSelectedVideoTitle('All Videos');
        }

        // Adjust current index if needed
        if (currentIndex >= newDueCards.length && newDueCards.length > 0) {
          setCurrentIndex(newDueCards.length - 1);
        } else if (newDueCards.length === 0) {
          // Check if there are no more videos at all
          if (newVideos.length === 0) {
            setLoadState('no-videos');
          } else if (loadState === 'deck-select') {
            // Stay on deck select if that's where we are
            setLoadState('deck-select');
          } else {
            setLoadState('session-complete');
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete video flashcards:', error);
    } finally {
      setIsDeletingVideo(false);
      setShowDeleteVideoConfirm(null);
    }
  }

  // Go back to deck selection
  async function handleBackToDecks() {
    // Destroy YouTube player first to prevent DOM conflicts
    cleanupYouTubePlayer();

    setCards([]);
    setDueCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedVideoId('');
    setSelectedVideoTitle('');
    setSearchQuery('');
    resetSession();

    // Refetch videos to ensure we have the latest list
    try {
      setLoadState('loading');
      setLoadingMsg('Loading decks...');
      const res = await fetch(`${API_BASE_URL}/videos/history/filtered?lang=${language}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const vids: TrackedVideo[] = data.videos || [];
      setVideos(vids);

      if (!vids.length) {
        setLoadState('no-videos');
        return;
      }
      setLoadState('deck-select');
    } catch {
      setLoadState('error');
    }
  }

  // Get stats for current card
  const currentStats = currentCard ? getCardStats(currentCard.dictionary_form || currentCard.target_word) : null;

  // Get preview times for rating buttons
  const previewTimes = currentCard ? previewNextReviews(currentCard.dictionary_form || currentCard.target_word) : null;

  // ── Loading (skeleton mirrors the review layout) ──────────────
  if (loadState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center max-w-md mx-auto px-4 py-8 md:py-10 w-full">
        <div className="w-full flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 flex-1">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-5 w-32 rounded-md mb-2" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          </div>
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full mb-6" />
        <Skeleton className="w-full mb-6" style={{ height: 320, borderRadius: 24 }} />
        <div className="grid grid-cols-4 gap-2 w-full">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (loadState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <p className="text-primary font-semibold">Couldn't load flashcards</p>
        <p className="text-secondary text-sm text-center max-w-sm">
          Make sure the ClipIt server is running and accessible.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-5 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors">
          Try again
        </button>
      </div>
    );
  }

  // ── Deck Selection ──────────────────────────────────────────
  if (loadState === 'deck-select') {
    // Helper to render a video card
    const renderVideoCard = (video: TrackedVideo, index: number, inFolder?: string) => {
      const isNetflix = video.video_id.startsWith('netflix_');
      const isDragging = draggingVideoId === video.video_id;
      return (
        <motion.div
          key={video.video_id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: isDragging ? 0.5 : 1, y: 0, scale: isDragging ? 0.98 : 1 }}
          transition={{ delay: index * 0.02 }}
          draggable={!inFolder}
          onDragStart={(e) => !inFolder && handleDragStart(e as unknown as React.DragEvent, video.video_id)}
          onDragEnd={handleDragEnd}
          className={`bg-surface border rounded-xl overflow-hidden transition-all group ${
            isDragging
              ? 'border-accent/50 cursor-grabbing'
              : 'border-white/5 hover:border-white/10 cursor-grab'
          }`}
        >
          <div className="flex items-center">
            <button
              onClick={() => loadFlashcards(video.video_id, video.title)}
              className="flex-1 flex items-center gap-4 p-4 text-left"
            >
              {/* Thumbnail */}
              <div className="w-24 h-14 rounded-lg overflow-hidden bg-white/5 shrink-0 relative">
                {isNetflix ? (
                  <div className="w-full h-full flex items-center justify-center bg-[#B20710]/10">
                    <Film className="w-6 h-6 text-[#B20710]" />
                  </div>
                ) : (
                  <img
                    src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-bold text-white ${
                  isNetflix ? 'bg-[#B20710]' : 'bg-[#FF0000]'
                }`}>
                  {isNetflix ? 'N' : 'YT'}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-primary text-base line-clamp-1 group-hover:text-accent transition-colors">
                  {video.title}
                </h3>
                <span className="text-xs text-muted">
                  {new Date(video.tracked_at * 1000).toLocaleDateString()}
                </span>
              </div>

              <Play className="w-5 h-5 text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>

            {/* Action buttons */}
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity mr-2">
              {inFolder ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveFromFolder(video.video_id, inFolder); }}
                  className="p-2.5 rounded-lg hover:bg-white/10 text-muted hover:text-secondary transition-colors"
                  title="Remove from folder"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setAddingToFolder(video); }}
                  className="p-2.5 rounded-lg hover:bg-white/10 text-muted hover:text-secondary transition-colors"
                  title="Add to folder"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setShowDeleteVideoConfirm(video); }}
                className="p-2.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
                title="Delete video"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      );
    };

    return (
      <div className="min-h-screen pb-20 max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => onNavigate?.('practice')}
            aria-label="Back to Practice"
            className="mb-4 w-9 h-9 flex items-center justify-center rounded-lg text-secondary hover:text-primary hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-4xl font-heading font-bold text-primary mb-2">Flashcards</h1>
          <p className="text-secondary">Select a deck to start reviewing flashcards.</p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
          <input
            type="text"
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-base text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-muted hover:text-primary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort & Create Folder */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <ArrowUpDown className="w-4 h-4 text-muted" />
            {[
              { value: 'recent' as SortOption, label: 'Recent' },
              { value: 'alphabetical' as SortOption, label: 'A-Z' },
              { value: 'oldest' as SortOption, label: 'Oldest' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSortOption(option.value)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  sortOption === option.value
                    ? 'bg-accent text-app'
                    : 'bg-surface border border-white/10 text-secondary hover:text-primary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCreateFolder(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-white/10 text-secondary hover:text-primary hover:border-white/20 text-sm font-medium transition-all"
          >
            <FolderPlus className="w-4 h-4" />
            New Folder
          </button>
        </div>

        {/* Study Mode Dropdown */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-secondary mb-2">Choose what to study</label>
          <div className="flex gap-3">
            <select
              value={selectedVocabListId === null ? 'all-videos' : selectedVocabListId === -1 ? 'my-words' : selectedVocabListId.toString()}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all-videos') {
                  setSelectedVocabListId(null);
                } else if (val === 'my-words') {
                  setSelectedVocabListId(-1);
                } else {
                  setSelectedVocabListId(parseInt(val));
                }
              }}
              className="flex-1 bg-surface border border-white/10 rounded-xl px-4 py-4 text-primary text-lg font-medium focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent transition-all appearance-none cursor-pointer hover:border-white/20"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px', paddingRight: '44px' }}
            >
              <option value="all-videos">All Videos ({videos.length} videos)</option>
              {vocabLists.length > 0 && (
                <option value="my-words">Study My Words ({vocabLists.reduce((sum, l) => sum + l.word_count, 0)} words)</option>
              )}
              {vocabLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list.word_count} words)
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (selectedVocabListId === null) {
                  clearVocabListFilter();
                  loadAllVideos(videos);
                } else if (selectedVocabListId === -1) {
                  loadVocabTTSCards();
                } else {
                  loadVocabTTSCards(selectedVocabListId);
                }
              }}
              className="px-6 py-4 bg-accent hover:bg-accent/90 text-app font-semibold rounded-xl transition-colors"
            >
              Study
            </button>
          </div>
        </div>

        {/* Folders Section */}
        {folders.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-muted uppercase tracking-wider">Folders</h2>
              {draggingVideoId && (
                <span className="text-xs text-accent animate-pulse">Drop video on a folder</span>
              )}
            </div>
            <div className="space-y-3">
              {folders.map((folder) => {
                const folderVideos = videos.filter(v => folder.videoIds.includes(v.video_id));
                const isExpanded = expandedFolderId === folder.id;
                const isDragOver = dragOverFolderId === folder.id;

                return (
                  <div
                    key={folder.id}
                    className={`bg-surface border rounded-xl overflow-hidden transition-all ${
                      isDragOver
                        ? 'border-accent ring-2 ring-accent/30 bg-accent/5'
                        : 'border-white/5'
                    }`}
                    onDragOver={(e) => handleDragOver(e, folder.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, folder.id)}
                  >
                    {/* Folder Header */}
                    <div className="flex items-center group">
                      <button
                        onClick={() => setExpandedFolderId(isExpanded ? null : folder.id)}
                        className="flex-1 flex items-center gap-4 p-4 text-left"
                      >
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isDragOver ? 'bg-accent/30' : 'bg-accent/10'
                        }`}>
                          {isDragOver ? (
                            <FolderPlus className="w-6 h-6 text-accent" />
                          ) : isExpanded ? (
                            <FolderOpen className="w-6 h-6 text-accent" />
                          ) : (
                            <Folder className="w-6 h-6 text-accent" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-primary text-base">{folder.name}</h3>
                          <span className="text-xs text-muted">{folderVideos.length} videos</span>
                        </div>
                        <ChevronRight className={`w-5 h-5 text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>

                      {/* Folder actions */}
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity mr-3">
                        <button
                          onClick={() => folderVideos.length > 0 && loadFolderFlashcards(folder)}
                          disabled={folderVideos.length === 0}
                          className="p-2.5 rounded-lg hover:bg-accent/10 text-muted hover:text-accent transition-colors disabled:opacity-30"
                          title="Study this folder"
                        >
                          <Play className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setEditingFolder(folder)}
                          className="p-2.5 rounded-lg hover:bg-white/10 text-muted hover:text-secondary transition-colors"
                          title="Edit folder"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded folder contents */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/5 overflow-hidden"
                        >
                          <div className="p-3 space-y-2">
                            {folderVideos.length === 0 ? (
                              <p className="text-sm text-muted text-center py-6">
                                No videos in this folder yet
                              </p>
                            ) : (
                              folderVideos.map((video, index) => renderVideoCard(video, index, folder.id))
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        )}


        {/* Ungrouped Videos */}
        {ungroupedVideos.length > 0 && (
          <div>
            {folders.length > 0 && (
              <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-4">Videos</h2>
            )}
            <div className="space-y-3">
              {ungroupedVideos.map((video, index) => renderVideoCard(video, index))}
            </div>
          </div>
        )}

        {/* No results message */}
        {searchQuery && filteredAndSortedVideos.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-secondary">No videos found for "{searchQuery}"</p>
          </div>
        )}

        {/* Create Folder Modal */}
        <AnimatePresence>
          {showCreateFolder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
              onClick={() => setShowCreateFolder(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mx-auto mb-4">
                  <FolderPlus className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-bold text-primary text-center mb-4">Create Folder</h3>
                <input
                  type="text"
                  placeholder="Folder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  className="w-full bg-app border border-white/10 rounded-xl px-4 py-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 mb-4"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-app font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add to Folder Modal */}
        <AnimatePresence>
          {addingToFolder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
              onClick={() => setAddingToFolder(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-primary text-center mb-2">Add to Folder</h3>
                <p className="text-xs text-muted text-center mb-4 line-clamp-1">
                  {addingToFolder.title}
                </p>
                {folders.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-secondary mb-3">No folders yet</p>
                    <button
                      onClick={() => { setAddingToFolder(null); setShowCreateFolder(true); }}
                      className="px-4 py-2 rounded-xl bg-accent text-app text-sm font-medium hover:bg-accent/90 transition-colors"
                    >
                      Create Folder
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {folders.map(folder => {
                      const alreadyInFolder = folder.videoIds.includes(addingToFolder.video_id);
                      return (
                        <button
                          key={folder.id}
                          onClick={() => !alreadyInFolder && handleAddToFolder(addingToFolder, folder.id)}
                          disabled={alreadyInFolder}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                            alreadyInFolder
                              ? 'bg-white/5 text-muted cursor-not-allowed'
                              : 'bg-white/5 hover:bg-accent/10 text-primary hover:text-accent'
                          }`}
                        >
                          <Folder className="w-5 h-5" />
                          <span className="flex-1 text-sm font-medium">{folder.name}</span>
                          {alreadyInFolder && <span className="text-xs text-muted">Added</span>}
                        </button>
                      );
                    })}
                    {/* Create new folder button */}
                    <button
                      onClick={() => { setAddingToFolder(null); setShowCreateFolder(true); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left bg-accent/10 hover:bg-accent/20 text-accent transition-all border border-dashed border-accent/30"
                    >
                      <FolderPlus className="w-5 h-5" />
                      <span className="flex-1 text-sm font-medium">Create new folder</span>
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setAddingToFolder(null)}
                  className="w-full mt-4 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Folder Modal */}
        <AnimatePresence>
          {editingFolder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
              onClick={() => setEditingFolder(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-primary text-center mb-4">Edit Folder</h3>
                <input
                  type="text"
                  defaultValue={editingFolder.name}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameFolder(editingFolder.id, (e.target as HTMLInputElement).value);
                    }
                  }}
                  className="w-full bg-app border border-white/10 rounded-xl px-4 py-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 mb-4"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDeleteFolder(editingFolder.id)}
                    className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-medium hover:bg-red-500/20 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setEditingFolder(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Video Confirmation Modal */}
        <AnimatePresence>
          {showDeleteVideoConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
              onClick={() => !isDeletingVideo && setShowDeleteVideoConfirm(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-primary text-center mb-2">
                  Delete Video & Flashcards?
                </h3>
                <p className="text-sm text-secondary text-center mb-2">
                  Are you sure you want to delete:
                </p>
                <p className="text-sm text-primary font-medium text-center mb-4 px-4 line-clamp-2">
                  "{showDeleteVideoConfirm.title}"
                </p>
                <p className="text-xs text-muted text-center mb-6">
                  This will remove the video from your watch history and delete all flashcards associated with it.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteVideoConfirm(null)}
                    disabled={isDeletingVideo}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteVideoFlashcards(showDeleteVideoConfirm)}
                    disabled={isDeletingVideo}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDeletingVideo ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Join Class Modal */}
        <AnimatePresence>
          {showJoinClass && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
              onClick={() => !isJoiningClass && setShowJoinClass(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mx-auto mb-4">
                  <BookOpen className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-bold text-primary text-center mb-2">Join a Class</h3>
                <p className="text-sm text-secondary text-center mb-4">
                  Enter your class code to get pre-made vocab lists from your instructor.
                </p>
                <input
                  type="text"
                  placeholder="Enter class code"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && classCode.trim() && handleJoinClass()}
                  className="w-full bg-app border border-white/10 rounded-xl px-4 py-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 mb-4 uppercase"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowJoinClass(false); setClassCode(''); }}
                    disabled={isJoiningClass}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleJoinClass}
                    disabled={!classCode.trim() || isJoiningClass}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-app font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isJoiningClass ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-app/30 border-t-app animate-spin" />
                        Joining...
                      </>
                    ) : (
                      'Join Class'
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Leave Class Modal */}
        <AnimatePresence>
          {showLeaveClass && !confirmLeaveClass && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
              onClick={() => !isLeavingClass && setShowLeaveClass(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                  <LogOut className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-primary text-center mb-2">Leave a Class</h3>
                <p className="text-sm text-secondary text-center mb-4">
                  Select a class to leave. This will remove all vocab lists from that class.
                </p>
                {isLoadingEnrolled ? (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  </div>
                ) : enrolledClasses.length === 0 ? (
                  <p className="text-muted text-sm text-center py-4">You're not enrolled in any classes.</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {enrolledClasses.map((cls) => (
                      <button
                        key={cls.class_code}
                        onClick={() => setConfirmLeaveClass(cls)}
                        className="w-full px-4 py-3 bg-app border border-white/10 hover:border-red-500/50 rounded-xl text-left transition-colors group"
                      >
                        <div className="font-medium text-primary group-hover:text-red-400">{cls.class_name}</div>
                        <div className="text-xs text-muted">{cls.lists_count} lists · {cls.words_count} words</div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowLeaveClass(false)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm Leave Class Modal */}
        <AnimatePresence>
          {confirmLeaveClass && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
              onClick={() => !isLeavingClass && setConfirmLeaveClass(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-primary text-center mb-2">Are you sure?</h3>
                <p className="text-sm text-secondary text-center mb-4">
                  This will remove all vocab lists from <span className="text-primary font-medium">{confirmLeaveClass.class_name}</span>. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmLeaveClass(null)}
                    disabled={isLeavingClass}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleLeaveClass(confirmLeaveClass.class_code)}
                    disabled={isLeavingClass}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLeavingClass ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Leaving...
                      </>
                    ) : (
                      'Leave Class'
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── No videos ────────────────────────────────────────────────
  if (loadState === 'no-videos') {
    // If user has vocab lists, show dropdown to study them
    if (vocabLists.length > 0) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-primary mb-2">Practice</h1>
            <p className="text-secondary">Choose what to study</p>
          </div>

          {/* Study Mode Dropdown */}
          <div className="mb-6">
            <div className="flex gap-3">
              <select
                value={selectedVocabListId === null ? 'my-words' : selectedVocabListId === -1 ? 'my-words' : selectedVocabListId.toString()}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'my-words') {
                    setSelectedVocabListId(-1);
                  } else {
                    setSelectedVocabListId(parseInt(val));
                  }
                }}
                className="flex-1 bg-surface border border-white/10 rounded-xl px-4 py-4 text-primary text-lg font-medium focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent transition-all appearance-none cursor-pointer hover:border-white/20"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px', paddingRight: '44px' }}
              >
                <option value="my-words">Study All Words ({vocabLists.reduce((sum, l) => sum + l.word_count, 0)} words)</option>
                {vocabLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name} ({list.word_count} words)
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (selectedVocabListId === -1 || selectedVocabListId === null) {
                    loadVocabTTSCards();
                  } else {
                    loadVocabTTSCards(selectedVocabListId);
                  }
                }}
                className="px-6 py-4 bg-accent hover:bg-accent/90 text-app font-semibold rounded-xl transition-colors"
              >
                Study
              </button>
            </div>
          </div>

          <div className="text-center">
            <p className="text-muted text-sm mb-4">Want to add more?</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setShowJoinClass(true)}
                className="px-4 py-2 bg-surface border border-white/10 hover:border-white/20 text-secondary hover:text-primary font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
              >
                <BookOpen className="w-4 h-4" />
                Join Another Class
              </button>
              <button
                onClick={() => onNavigate?.('vocabulary')}
                className="px-4 py-2 bg-surface border border-white/10 hover:border-white/20 text-secondary hover:text-primary font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                Upload Your Own List
              </button>
              <button
                onClick={() => openLeaveClassModal()}
                className="px-4 py-2 bg-surface border border-white/10 hover:border-red-500/50 text-secondary hover:text-red-400 font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
              >
                <LogOut className="w-4 h-4" />
                Leave a Class
              </button>
            </div>
          </div>

          {/* Join Class Modal */}
          <AnimatePresence>
            {showJoinClass && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
                onClick={() => !isJoiningClass && setShowJoinClass(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mx-auto mb-4">
                    <BookOpen className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="text-lg font-bold text-primary text-center mb-2">Join a Class</h3>
                  <p className="text-sm text-secondary text-center mb-4">
                    Enter your class code to get pre-made vocab lists from your instructor.
                  </p>
                  <input
                    type="text"
                    placeholder="Enter class code"
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && classCode.trim() && handleJoinClass()}
                    className="w-full bg-app border border-white/10 rounded-xl px-4 py-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 mb-4 uppercase"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowJoinClass(false); setClassCode(''); }}
                      disabled={isJoiningClass}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleJoinClass}
                      disabled={!classCode.trim() || isJoiningClass}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-app font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                    >
                      {isJoiningClass ? 'Joining...' : 'Join'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Leave Class Modal */}
          <AnimatePresence>
            {showLeaveClass && !confirmLeaveClass && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
                onClick={() => !isLeavingClass && setShowLeaveClass(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                    <LogOut className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 className="text-lg font-bold text-primary text-center mb-2">Leave a Class</h3>
                  <p className="text-sm text-secondary text-center mb-4">
                    Select a class to leave. This will remove all vocab lists from that class.
                  </p>
                  {isLoadingEnrolled ? (
                    <div className="flex justify-center py-4">
                      <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    </div>
                  ) : enrolledClasses.length === 0 ? (
                    <p className="text-muted text-sm text-center py-4">You're not enrolled in any classes.</p>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {enrolledClasses.map((cls) => (
                        <button
                          key={cls.class_code}
                          onClick={() => setConfirmLeaveClass(cls)}
                          className="w-full px-4 py-3 bg-app border border-white/10 hover:border-red-500/50 rounded-xl text-left transition-colors group"
                        >
                          <div className="font-medium text-primary group-hover:text-red-400">{cls.class_name}</div>
                          <div className="text-xs text-muted">{cls.lists_count} lists · {cls.words_count} words</div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowLeaveClass(false)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Confirm Leave Class Modal */}
          <AnimatePresence>
            {confirmLeaveClass && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
                onClick={() => !isLeavingClass && setConfirmLeaveClass(null)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 className="text-lg font-bold text-primary text-center mb-2">Are you sure?</h3>
                  <p className="text-sm text-secondary text-center mb-4">
                    This will remove all vocab lists from <span className="text-primary font-medium">{confirmLeaveClass.class_name}</span>. This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmLeaveClass(null)}
                      disabled={isLeavingClass}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleLeaveClass(confirmLeaveClass.class_code)}
                      disabled={isLeavingClass}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isLeavingClass ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Leaving...
                        </>
                      ) : (
                        'Leave Class'
                      )}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <button
          onClick={() => onNavigate?.('practice')}
          aria-label="Back to Practice"
          className="absolute top-6 left-4 sm:left-6 w-9 h-9 flex items-center justify-center rounded-lg text-secondary hover:text-primary hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
          <BookOpen className="w-8 h-8 text-accent" />
        </div>
        <div className="text-center">
          <p className="text-xl text-primary font-semibold mb-2">Ready to start learning?</p>
          <p className="text-secondary text-sm max-w-sm">
            Add some words to start practicing.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => onNavigate?.('vocabulary')}
            className="w-full px-6 py-3 bg-accent hover:bg-accent/90 text-app font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Upload Your Own List
          </button>
          <a
            href="https://chromewebstore.google.com/detail/clipit/pcnnmkbacmcfldjgmaljkjdnfijkkokn"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-6 py-3 bg-surface border border-white/10 hover:border-white/20 text-primary font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Tv className="w-5 h-5" />
            Get Clip It Extension
          </a>
        </div>

        <p className="text-muted text-xs text-center max-w-xs">
          Join a community group, upload your own vocab list, or use Clip It to learn from {languageName} videos.
        </p>

        {/* Join Class Modal */}
        <AnimatePresence>
          {showJoinClass && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
              onClick={() => !isJoiningClass && setShowJoinClass(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mx-auto mb-4">
                  <BookOpen className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-bold text-primary text-center mb-2">Join a Class</h3>
                <p className="text-sm text-secondary text-center mb-4">
                  Enter your class code to get pre-made vocab lists from your instructor.
                </p>
                <input
                  type="text"
                  placeholder="Enter class code"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && classCode.trim() && handleJoinClass()}
                  className="w-full bg-app border border-white/10 rounded-xl px-4 py-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 mb-4 uppercase"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowJoinClass(false); setClassCode(''); }}
                    disabled={isJoiningClass}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleJoinClass}
                    disabled={!classCode.trim() || isJoiningClass}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-app font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isJoiningClass ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-app/30 border-t-app animate-spin" />
                        Joining...
                      </>
                    ) : (
                      'Join Class'
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Leave Class Modal */}
        <AnimatePresence>
          {showLeaveClass && !confirmLeaveClass && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
              onClick={() => !isLeavingClass && setShowLeaveClass(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                  <LogOut className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-primary text-center mb-2">Leave a Class</h3>
                <p className="text-sm text-secondary text-center mb-4">
                  Select a class to leave. This will remove all vocab lists from that class.
                </p>
                {isLoadingEnrolled ? (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  </div>
                ) : enrolledClasses.length === 0 ? (
                  <p className="text-muted text-sm text-center py-4">You're not enrolled in any classes.</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {enrolledClasses.map((cls) => (
                      <button
                        key={cls.class_code}
                        onClick={() => setConfirmLeaveClass(cls)}
                        className="w-full px-4 py-3 bg-app border border-white/10 hover:border-red-500/50 rounded-xl text-left transition-colors group"
                      >
                        <div className="font-medium text-primary group-hover:text-red-400">{cls.class_name}</div>
                        <div className="text-xs text-muted">{cls.lists_count} lists · {cls.words_count} words</div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowLeaveClass(false)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm Leave Class Modal */}
        <AnimatePresence>
          {confirmLeaveClass && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
              onClick={() => !isLeavingClass && setConfirmLeaveClass(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-primary text-center mb-2">Are you sure?</h3>
                <p className="text-sm text-secondary text-center mb-4">
                  This will remove all vocab lists from <span className="text-primary font-medium">{confirmLeaveClass.class_name}</span>. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmLeaveClass(null)}
                    disabled={isLeavingClass}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleLeaveClass(confirmLeaveClass.class_code)}
                    disabled={isLeavingClass}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLeavingClass ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Leaving...
                      </>
                    ) : (
                      'Leave Class'
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── No vocab ─────────────────────────────────────────────────
  if (loadState === 'no-vocab') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-3xl">
          {language === 'uk' ? '🇺🇦' : language === 'es' ? '🇪🇸' : language === 'en' ? '🇬🇧' : '🈚'}
        </div>
        <p className="text-primary font-semibold">No common {languageName} words found</p>
        <p className="text-secondary text-sm text-center max-w-sm">
          {selectedVideoId === 'all'
            ? `None of the tracked videos had ${languageName} words matching the frequency list.`
            : `No ${languageName} words from the frequency list were found in this video.`}
        </p>
        <div className="flex gap-3 mt-2">
          {videos.length > 1 && selectedVideoId !== 'all' && (
            <button
              onClick={() => loadAllVideos(videos)}
              className="px-5 py-2.5 rounded-xl bg-accent text-app text-sm font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20">
              Try all videos
            </button>
          )}
          <button
            onClick={handleBackToDecks}
            className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary text-sm font-semibold hover:bg-white/8 transition-colors">
            Back to Decks
          </button>
        </div>
      </div>
    );
  }

  // ── Time-Gated Complete (daily goal reached) ────────────────
  if (loadState === 'time-gated-complete') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-20 h-20 rounded-full bg-gradient-to-br from-accent/20 to-green-500/20 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-accent" />
        </motion.div>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center">
          <h2 className="text-2xl font-heading font-bold text-primary mb-2">
            {sessionStats.reviewed} cards — great work!
          </h2>
          <p className="text-secondary text-sm">
            You hit your daily goal of {getGoalLabel()}
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mt-4">
          <p className="text-secondary text-sm mb-4">Want to keep going?</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                // End session and go back to main screen
                resetSession();
                setLoadState('session-complete');
              }}
              className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-secondary text-sm font-semibold hover:bg-white/8 transition-colors">
              I'm done for today
            </button>
            <button
              onClick={() => {
                // Extend session and continue
                extendSession();
                setLoadState('loaded');
              }}
              className="px-5 py-3 rounded-xl bg-accent text-app text-sm font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20">
              Keep reviewing
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Session Complete ─────────────────────────────────────────
  if (loadState === 'session-complete') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <Trophy className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-heading font-bold text-primary">Session Complete!</h2>
        {sessionStats.reviewed > 0 ? (
          <div className="text-center">
            <p className="text-secondary text-sm mb-3">
              You reviewed <span className="text-accent font-semibold">{sessionStats.reviewed}</span> cards
            </p>
            <div className="flex gap-4 justify-center text-xs">
              <span className="text-red-400">Again: {sessionStats.again}</span>
              <span className="text-orange-400">Hard: {sessionStats.hard}</span>
              <span className="text-accent">Good: {sessionStats.good}</span>
              <span className="text-green-400">Easy: {sessionStats.easy}</span>
            </div>
          </div>
        ) : (
          <p className="text-secondary text-sm text-center max-w-sm">
            No cards are due for review right now. Come back later!
          </p>
        )}
        <div className="flex flex-col gap-3 mt-4">
          <button
            onClick={() => {
              resetSession();
              setCurrentIndex(0);
              setDueCards(cards);
              setSessionStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
              setLoadState('loaded');
              startSession();
            }}
            className="px-6 py-3 rounded-xl bg-accent text-app text-sm font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20">
            Review All Cards Again
          </button>
          <button
            onClick={handleBackToDecks}
            className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-secondary text-sm font-semibold hover:bg-white/8 transition-colors">
            Back to Decks
          </button>
        </div>
      </div>
    );
  }

  // ── Loaded ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center max-w-md mx-auto px-4 py-8 md:py-10">
      <HelpOverlay tips={flashcardsPageTips} />

      {/* Header stats */}
      <div className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 mb-5">
        <button
          onClick={() => handleBackToDecks()}
          aria-label="Back to decks"
          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-secondary hover:text-primary hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div id="section-deck-select" className="min-w-0">
          <h1 className="text-xl font-heading font-bold text-primary">Daily Review</h1>
          <button
            type="button"
            onClick={() => handleBackToDecks()}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 text-xs text-secondary hover:text-accent transition-colors mt-0.5 group cursor-pointer w-full max-w-full">
            {selectedVideoId === 'all' ? (
              <>
                <Layers className="w-3 h-3 shrink-0 mr-0.5" />
                <span className="truncate min-w-0">All Videos</span>
              </>
            ) : selectedVideoId.startsWith('folder_') ? (
              <>
                <Folder className="w-3 h-3 shrink-0 mr-0.5" />
                <span className="truncate min-w-0">{selectedVideoTitle}</span>
              </>
            ) : selectedVideoId.startsWith('vocablist_') ? (
              <>
                <BookOpen className="w-3 h-3 shrink-0 mr-0.5" />
                <span className="truncate min-w-0">{selectedVideoTitle}</span>
              </>
            ) : (
              <>
                <span className="w-3 h-3 mr-0.5" />
                <span className="truncate min-w-0">{selectedVideoTitle}</span>
              </>
            )}
            <span className="text-muted whitespace-nowrap">· Change deck</span>
          </button>
        </div>
        <div className="text-right shrink-0 w-[112px]">
          {session.isExtended ? (
            <>
              <div className="text-2xl font-bold text-accent">
                {Math.max(0, deckProgressTotal - currentIndex)}
                <span className="text-muted text-lg"> left</span>
              </div>
              <div className="text-xs text-secondary mt-1">
                Today: {dailyGoalReviewed} / {session.sessionCap}
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-accent">
                {deckProgressReviewed}
                <span className="text-muted text-lg"> / {deckProgressTotal}</span>
              </div>
              <div className="w-24 h-1.5 bg-surface-hover rounded-full mt-1.5 overflow-hidden">
                <motion.div
                  className="h-full bg-accent"
                  animate={{ width: `${deckProgressTotal ? Math.min(100, (deckProgressReviewed / deckProgressTotal) * 100) : 0}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <div className="text-xs text-secondary mt-1">
                Today: {dailyGoalReviewed} / {session.sessionCap}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Card area */}
      <div className="w-full space-y-4">
        {/* Video clip (YouTube), Netflix placeholder, or TTS card */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden ring-1 ring-white/10 bg-black">
          {currentCard && currentCard.card_type !== 'video' ? (
            // TTS-only card (no video context)
            <TTSCardPlaceholder
              word={currentCard.target_word}
              language={language}
            />
          ) : currentCard && isNetflixVideo(currentCard.video_id!) ? (
            // Netflix screenshot or placeholder with deep link button
            <NetflixVideoPlaceholder
              videoId={currentCard.video_id!}
              timestamp={currentCard.timestamp!}
            />
          ) : (
            <div
              ref={playerContainerRef}
              className="w-full h-full"
            />
          )}
          {/* Action buttons */}
          <div className="absolute top-2 right-2 flex gap-1">
            {currentCard?.card_type === 'video' && (
              <button
                onClick={handleRevertToTTS}
                disabled={isReverting}
                className="p-2 rounded-lg bg-black/60 hover:bg-blue-500/80 text-white/70 hover:text-white transition-colors disabled:opacity-50"
                title="Revert to TTS-only"
              >
                <RotateCcw className={`w-4 h-4 ${isReverting ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={handleDeleteCard}
              className="p-2 rounded-lg bg-black/60 hover:bg-red-500/80 text-white/70 hover:text-white transition-colors"
              title="Delete this flashcard"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          {/* Sentence context overlay */}
          {currentCard && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 py-2.5 text-center">
              <p className="text-sm font-medium leading-snug" style={{ color: '#ffffff' }}>
                {currentCard.sentence ? (
                  currentCard.sentence.split(new RegExp(`(${currentCard.target_word})`, 'g')).map((part, i) =>
                    part === currentCard.target_word ? (
                      <span key={i} className="text-accent font-bold">{part}</span>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )
                ) : (
                  <span className="text-accent">{currentCard.target_word}</span>
                )}
              </p>
              {isFlipped && currentCard.sentence_translation && currentCard.sentence_translation !== 'No translation available' && (
                <p className="text-xs mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {currentCard.sentence_translation}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Flashcard */}
        <div id="section-flashcard" className="relative w-full aspect-[4/3]" style={{ perspective: '1200px' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="w-full h-full relative cursor-pointer"
              onClick={() => setIsFlipped(!isFlipped)}
              style={{ transformStyle: 'preserve-3d' }}>

              <motion.div
                className="w-full h-full absolute inset-0"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                style={{ transformStyle: 'preserve-3d' }}>

                {/* Front - Korean word */}
                <div
                  className="absolute inset-0 bg-surface border border-white/10 rounded-2xl shadow-2xl flex flex-col items-center justify-center p-8"
                  style={{ backfaceVisibility: 'hidden' }}>
                  <div className="flex items-center gap-2 mb-5">
                    {currentStats && !currentStats.isNew && (
                      <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border border-accent/20 text-accent flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {currentStats.repetitions}x
                      </span>
                    )}
                    {currentStats?.isNew && (
                      <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent">
                        NEW
                      </span>
                    )}
                  </div>
                  <h2 className={`${getWordFontSize(currentCard?.target_word || '')} font-heading font-bold text-primary text-center mb-3 tracking-tight`}>
                    {currentCard?.target_word}
                  </h2>
                  {currentCard?.dictionary_form && currentCard.dictionary_form !== currentCard.target_word && (
                    <p className="text-sm text-muted font-mono">({currentCard.dictionary_form})</p>
                  )}
                  <div className="absolute bottom-5 text-muted text-xs flex items-center gap-1.5">
                    <RotateCw className="w-3.5 h-3.5" /> Tap to reveal
                  </div>
                </div>

                {/* Back - English definition */}
                <div
                  className="absolute inset-0 bg-surface-hover border border-accent/20 rounded-2xl shadow-2xl flex flex-col items-center justify-center p-8"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <div className="flex items-center gap-2 mb-5">
                    <span className="text-xs font-bold tracking-widest text-secondary uppercase">
                      English
                    </span>
                    {!isEditingDefinition && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditDefinition();
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-accent transition-colors"
                        title="Edit definition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {isEditingDefinition ? (
                    <div className="w-full max-w-xs" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editedDefinition}
                        onChange={(e) => setEditedDefinition(e.target.value)}
                        className="w-full bg-surface border border-white/20 rounded-lg px-4 py-3 text-primary text-center text-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveDefinition();
                          if (e.key === 'Escape') setIsEditingDefinition(false);
                        }}
                      />
                      <div className="flex gap-2 mt-3 justify-center">
                        <button
                          onClick={() => setIsEditingDefinition(false)}
                          className="px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-secondary text-sm font-medium hover:bg-white/10 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveDefinition}
                          className="px-4 py-1.5 rounded-lg bg-accent text-app text-sm font-medium hover:bg-accent/90 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <h2 className={`${getWordFontSize(currentCard?.english || '-')} font-heading font-bold text-primary text-center mb-4`}>
                      {currentCard?.english && currentCard.english !== 'definition not available'
                        ? currentCard.english
                        : '-'}
                    </h2>
                  )}
                  <div className="w-full border-t border-white/5 pt-4 mt-1 text-center">
                    <p className="text-sm text-muted italic">
                      {currentCard?.target_word}
                    </p>
                  </div>
                  {/* Example sentence for TTS cards */}
                  {currentCard?.card_type === 'tts' && currentCard?.sentence && (
                    <div className="w-full border-t border-white/5 pt-4 mt-4">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <p className="text-xs text-muted uppercase tracking-wider">Example</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (currentCard?.sentence) {
                              playTTS(currentCard.sentence);
                            }
                          }}
                          className="p-1.5 rounded-full bg-white/5 hover:bg-accent hover:text-app text-secondary transition-colors"
                          title="Listen to example"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-base text-primary text-center">
                        {currentCard.sentence}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Last rating feedback */}
      <AnimatePresence>
        {lastRatingInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 px-4 py-2 rounded-lg bg-surface border border-white/10 text-xs text-secondary flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-accent" />
            Next review for "{lastRatingInfo.word}" in {lastRatingInfo.nextDue}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <motion.div
        id="section-rating-buttons"
        className="grid grid-cols-4 gap-3 mt-8 w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}>

        <button
          onClick={() => handleRating(Rating.Again)}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface hover:bg-accent/10 border border-transparent hover:border-accent/40 group transition-all">
          {previewTimes && (
            <span className="text-[10px] text-muted font-medium">{formatNextReview(previewTimes.again)}</span>
          )}
          <X className="w-6 h-6 text-accent" />
          <span className="text-sm font-medium text-secondary group-hover:text-accent">Again</span>
        </button>

        <button
          onClick={() => handleRating(Rating.Hard)}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface hover:bg-accent/10 border border-transparent hover:border-accent/40 group transition-all">
          {previewTimes && (
            <span className="text-[10px] text-muted font-medium">{formatNextReview(previewTimes.hard)}</span>
          )}
          <ThumbsDown className="w-6 h-6 text-accent" />
          <span className="text-sm font-medium text-secondary group-hover:text-accent">Hard</span>
        </button>

        <button
          onClick={() => handleRating(Rating.Good)}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface hover:bg-accent/10 border border-transparent hover:border-accent/40 group transition-all">
          {previewTimes && (
            <span className="text-[10px] text-muted font-medium">{formatNextReview(previewTimes.good)}</span>
          )}
          <ThumbsUp className="w-6 h-6 text-accent" />
          <span className="text-sm font-medium text-secondary group-hover:text-accent">Good</span>
        </button>

        <button
          onClick={() => handleRating(Rating.Easy)}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface hover:bg-accent/10 border border-transparent hover:border-accent/40 group transition-all">
          {previewTimes && (
            <span className="text-[10px] text-muted font-medium">{formatNextReview(previewTimes.easy)}</span>
          )}
          <Check className="w-6 h-6 text-accent" />
          <span className="text-sm font-medium text-secondary group-hover:text-accent">Easy</span>
        </button>
      </motion.div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-primary text-center mb-2">Delete Flashcard?</h3>
              <p className="text-sm text-secondary text-center mb-6">
                Remove this flashcard? The word can reappear with a new clip when you watch more content.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteCard}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Video Flashcards Confirmation Modal */}
      <AnimatePresence>
        {showDeleteVideoConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            onClick={() => !isDeletingVideo && setShowDeleteVideoConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-primary text-center mb-2">
                Delete Video & Flashcards?
              </h3>
              <p className="text-sm text-secondary text-center mb-2">
                Are you sure you want to delete:
              </p>
              <p className="text-sm text-primary font-medium text-center mb-4 px-4 line-clamp-2">
                "{showDeleteVideoConfirm.title}"
              </p>
              <p className="text-xs text-muted text-center mb-6">
                This will remove the video from your watch history and delete all flashcards associated with it. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteVideoConfirm(null)}
                  disabled={isDeletingVideo}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteVideoFlashcards(showDeleteVideoConfirm)}
                  disabled={isDeletingVideo}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeletingVideo ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete All
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
