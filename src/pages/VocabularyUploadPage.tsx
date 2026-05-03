import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import {
  Upload,
  FileText,
  Trash2,
  Plus,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { HelpOverlay, HelpTip } from '../components/HelpOverlay';

const uploadPageTips: HelpTip[] = [
  {
    id: 'priority-mode',
    text: 'Choose which words to extract from videos: your lists, our frequency list, or both.',
    targetId: 'section-word-source',
    position: 'right',
  },
  {
    id: 'csv-upload',
    text: 'Upload a CSV with word and translation. You can optionally add example sentences in columns 3-4.',
    targetId: 'section-csv-upload',
    position: 'right',
  },
  {
    id: 'anki-import',
    text: 'Import your Anki decks with review progress. Check "Include scheduling information" when exporting from Anki.',
    targetId: 'section-anki-import',
    position: 'right',
  },
  {
    id: 'lists',
    text: 'Your uploaded lists and imported Anki decks appear here. Click to expand and see all words.',
    targetId: 'section-word-lists',
    position: 'right',
  },
];

interface VocabList {
  id: number;
  name: string;
  language: string;
  word_count: number;
  created_at: string;
}

interface VocabWord {
  id: number;
  word: string;
  translation: string;
  example?: string;
  example_translation?: string;
  sort_order: number;
}

interface VocabListDetail extends VocabList {
  words: VocabWord[];
}

const PRIORITY_MODES = [
  {
    value: 'mixed',
    label: 'Both',
    description: 'Use words from both your uploaded lists and our frequency list',
  },
  {
    value: 'uploaded_only',
    label: 'My Words Only',
    description: 'Only show words from your uploaded vocabulary lists',
  },
  {
    value: 'frequency_only',
    label: 'Frequency List Only',
    description: 'Only show words from our curated frequency list (default behavior)',
  },
];

export function VocabularyUploadPage() {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ankiInputRef = useRef<HTMLInputElement>(null);

  // State
  const [lists, setLists] = useState<VocabList[]>([]);
  const [expandedListId, setExpandedListId] = useState<number | null>(null);
  const [expandedListWords, setExpandedListWords] = useState<VocabWord[]>([]);
  const [priorityMode, setPriorityMode] = useState('mixed');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingAnki, setIsUploadingAnki] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [deletingListId, setDeletingListId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ankiImportResult, setAnkiImportResult] = useState<{
    deck_name: string;
    imported: number;
    updated: number;
    skipped: number;
  } | null>(null);

  // Fetch lists and settings on mount
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    Promise.all([fetchLists(), fetchSettings()])
      .finally(() => setIsLoading(false));
  }, [token]);

  const fetchLists = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/lists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLists(data);
      }
    } catch (err) {
      console.error('Failed to fetch lists:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPriorityMode(data.priority_mode);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchListWords = async (listId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/lists/${listId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: VocabListDetail = await res.json();
        setExpandedListWords(data.words);
      }
    } catch (err) {
      console.error('Failed to fetch list words:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('[Upload] Starting upload for:', file.name);
    setIsUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('[Upload] Sending request to API...');
      const res = await fetch(`${API_BASE_URL}/vocab/lists/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      console.log('[Upload] Response status:', res.status);

      if (res.ok) {
        const newList = await res.json();
        console.log('[Upload] Success! List created:', newList);
        setLists([newList, ...lists]);
        setSuccess(`Successfully uploaded "${newList.name}" with ${newList.word_count} words!`);
      } else {
        const data = await res.json();
        console.error('[Upload] Error response:', data);
        setError(data.detail || 'Failed to upload file');
      }
    } catch (err) {
      console.error('[Upload] Exception:', err);
      setError('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteList = async (listId: number, listName: string) => {
    if (!confirm(`Are you sure you want to delete "${listName}"?`)) return;

    setDeletingListId(listId);
    try {
      const res = await fetch(`${API_BASE_URL}/vocab/lists/${listId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setLists(lists.filter((l) => l.id !== listId));
        if (expandedListId === listId) {
          setExpandedListId(null);
          setExpandedListWords([]);
        }
        setSuccess(`Deleted "${listName}"`);
      } else {
        setError('Failed to delete list');
      }
    } catch (err) {
      setError('Failed to delete list');
    } finally {
      setDeletingListId(null);
    }
  };

  const handlePriorityModeChange = async (mode: string) => {
    setPriorityMode(mode);
    setIsSavingSettings(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/vocab/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ priority_mode: mode }),
      });

      if (!res.ok) {
        setError('Failed to save settings');
      }
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const toggleListExpand = async (listId: number) => {
    if (expandedListId === listId) {
      setExpandedListId(null);
      setExpandedListWords([]);
    } else {
      setExpandedListId(listId);
      await fetchListWords(listId);
    }
  };

  const handleAnkiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAnki(true);
    setError(null);
    setSuccess(null);
    setAnkiImportResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', 'ko'); // TODO: Get from language context

    try {
      const res = await fetch(`${API_BASE_URL}/anki/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setAnkiImportResult(data);
        setSuccess(`Successfully imported "${data.deck_name}"!`);
        // Refresh lists to show the new Anki import
        fetchLists();
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to import Anki deck');
      }
    } catch (err) {
      console.error('[Anki Import] Exception:', err);
      setError('Failed to import Anki deck. Please try again.');
    } finally {
      setIsUploadingAnki(false);
      if (ankiInputRef.current) {
        ankiInputRef.current.value = '';
      }
    }
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  if (!token) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="min-h-screen pb-20 max-w-3xl mx-auto px-4 pt-8"
      >
        <div className="bg-surface border border-white/5 rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-secondary mx-auto mb-4" />
          <h2 className="text-xl font-bold text-primary mb-2">Login Required</h2>
          <p className="text-secondary">Please log in to upload and manage your vocabulary lists.</p>
        </div>
      </motion.div>
    );
  }

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex items-center justify-center"
      >
        <div className="w-10 h-10 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen pb-20 max-w-3xl mx-auto px-4 pt-8"
    >
      <HelpOverlay tips={uploadPageTips} />

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-heading font-bold text-primary mb-2">
          My Vocabulary
        </h1>
        <p className="text-secondary">
          Upload your own word lists and choose how they're used when studying.
        </p>
      </div>

      {/* Status Messages */}
      {(success || error) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            success
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span className="text-sm font-medium">{success || error}</span>
        </motion.div>
      )}

      <div className="space-y-10">
        {/* Priority Mode Selection */}
        <section id="section-word-source">
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            Word Source
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-primary">Choose your word source</p>
                <p className="text-xs text-secondary mt-0.5">
                  This controls which words are extracted when you watch videos
                </p>
              </div>
              {isSavingSettings && (
                <Loader2 className="w-5 h-5 text-accent animate-spin ml-auto" />
              )}
            </div>

            <div className="space-y-3">
              {PRIORITY_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => handlePriorityModeChange(mode.value)}
                  className={`w-full p-4 rounded-xl text-left transition-all border ${
                    priorityMode === mode.value
                      ? 'bg-accent/10 border-accent/30 ring-1 ring-accent/20'
                      : 'bg-app/50 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        priorityMode === mode.value
                          ? 'border-accent bg-accent'
                          : 'border-white/20'
                      }`}
                    >
                      {priorityMode === mode.value && (
                        <div className="w-2 h-2 rounded-full bg-app" />
                      )}
                    </div>
                    <div>
                      <p className={`font-semibold ${priorityMode === mode.value ? 'text-accent' : 'text-primary'}`}>
                        {mode.label}
                      </p>
                      <p className="text-xs text-secondary mt-0.5">{mode.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* CSV Format Requirements */}
        <section>
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            CSV Format
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-primary">File Requirements</p>
                <p className="text-xs text-secondary mt-0.5">
                  Your CSV file should follow one of these formats
                </p>
              </div>
            </div>

            <div className="bg-app/50 rounded-xl p-4 font-mono text-sm mb-4">
              <p className="text-muted mb-2"># Basic format (word + translation):</p>
              <p className="text-secondary">word,translation</p>
              <p className="text-primary">안녕하세요,Hello</p>
              <p className="text-primary">감사합니다,Thank you</p>
            </div>

            <div className="bg-app/50 rounded-xl p-4 font-mono text-sm">
              <p className="text-muted mb-2"># With example sentences (optional):</p>
              <p className="text-secondary">word,translation,example,example_translation</p>
              <p className="text-primary">사랑해요,I love you,나는 너를 사랑해요,I love you</p>
              <p className="text-primary">먹다,to eat,밥을 먹어요,I eat rice</p>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-secondary">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                Columns 1-2: Word and translation (required)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                Columns 3-4: Example sentence and translation (optional)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                Header row is optional (auto-detected)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                UTF-8 encoding supported
              </li>
            </ul>
          </div>
        </section>

        {/* Upload Section */}
        <section id="section-csv-upload">
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            Upload List
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl p-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                isUploading
                  ? 'border-accent/50 bg-accent/5'
                  : 'border-white/10 hover:border-accent/30 hover:bg-accent/5'
              }`}
            >
              {isUploading ? (
                <Loader2 className="w-10 h-10 text-accent animate-spin mb-3" />
              ) : (
                <Upload className="w-10 h-10 text-secondary mb-3" />
              )}
              <p className="font-semibold text-primary mb-1">
                {isUploading ? 'Uploading...' : 'Click to upload CSV'}
              </p>
              <p className="text-xs text-secondary">or drag and drop your file here</p>
            </label>
          </div>
        </section>

        {/* Anki Import Section */}
        <section id="section-anki-import">
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            Import from Anki
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-primary">Import Anki Deck</p>
                <p className="text-xs text-secondary mt-0.5">
                  Upload your .apkg file to import cards with their review progress
                </p>
              </div>
            </div>

            <input
              ref={ankiInputRef}
              type="file"
              accept=".apkg"
              onChange={handleAnkiUpload}
              className="hidden"
              id="anki-upload"
            />
            <label
              htmlFor="anki-upload"
              className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                isUploadingAnki
                  ? 'border-purple-500/50 bg-purple-500/5'
                  : 'border-white/10 hover:border-purple-500/30 hover:bg-purple-500/5'
              }`}
            >
              {isUploadingAnki ? (
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-2" />
              ) : (
                <Layers className="w-8 h-8 text-secondary mb-2" />
              )}
              <p className="font-semibold text-primary mb-1 text-sm">
                {isUploadingAnki ? 'Importing...' : 'Click to upload .apkg file'}
              </p>
              <p className="text-xs text-secondary">Your review progress will be preserved</p>
            </label>

            {/* Import Result */}
            {ankiImportResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl"
              >
                <p className="font-semibold text-purple-300 mb-2">Import Complete</p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary">{ankiImportResult.imported}</p>
                    <p className="text-xs text-secondary">New cards</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{ankiImportResult.updated}</p>
                    <p className="text-xs text-secondary">Updated</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-muted">{ankiImportResult.skipped}</p>
                    <p className="text-xs text-secondary">Skipped</p>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-300 font-medium flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                When exporting from Anki, check "Include scheduling information" to preserve your progress.
              </p>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-secondary">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                Imports cards with front/back content
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                Preserves review history and due dates
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                Converts Anki scheduling to FSRS
              </li>
            </ul>
          </div>
        </section>

        {/* My Lists */}
        <section id="section-word-lists">
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            My Word Lists ({lists.length})
          </h2>

          {lists.length === 0 ? (
            <div className="bg-surface border border-white/5 rounded-2xl p-8 text-center">
              <FileText className="w-12 h-12 text-secondary mx-auto mb-4" />
              <p className="text-secondary">No vocabulary lists uploaded yet.</p>
              <p className="text-sm text-muted mt-1">Upload a CSV file to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lists.map((list) => (
                <div
                  key={list.id}
                  className="bg-surface border border-white/5 rounded-2xl overflow-hidden"
                >
                  <div className="p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-primary truncate">{list.name}</p>
                      <p className="text-xs text-secondary mt-0.5">
                        {list.word_count} words &middot; {new Date(list.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleListExpand(list.id)}
                      className="p-2 text-secondary hover:text-primary transition-colors"
                    >
                      {expandedListId === list.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteList(list.id, list.name)}
                      disabled={deletingListId === list.id}
                      className="p-2 text-secondary hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingListId === list.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Words */}
                  {expandedListId === list.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-white/5"
                    >
                      <div className="p-4 max-h-64 overflow-y-auto">
                        {expandedListWords.length === 0 ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 text-accent animate-spin" />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {expandedListWords.map((word) => (
                              <div
                                key={word.id}
                                className="p-3 bg-app/30 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-medium text-primary flex-1">{word.word}</span>
                                  <span className="text-secondary text-sm">{word.translation}</span>
                                </div>
                                {word.example && (
                                  <div className="mt-2 pt-2 border-t border-white/5 text-xs">
                                    <p className="text-muted">{word.example}</p>
                                    {word.example_translation && (
                                      <p className="text-muted/70 mt-0.5">{word.example_translation}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}
