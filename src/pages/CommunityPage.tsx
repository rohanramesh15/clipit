import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Search,
  Globe,
  Lock,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  LogOut,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE_URL } from '../config';
import { Skeleton } from '../components/Skeleton';
import { SegmentedTabs } from '../components/SegmentedTabs';

interface CommunityGroup {
  id: number;
  name: string;
  description: string | null;
  language: string;
  is_public: boolean;
  invite_code: string;
  member_count: number;
  word_count: number;
  list_count: number;
  role?: string;
  last_synced_at?: string;
  creator_id?: number;
  member_permission?: string;
}

interface VocabList {
  id: number;
  name: string;
  word_count: number;
  added_by: number | null;
  created_at: string;
}

interface VocabWord {
  id: number;
  word: string;
  translation: string;
  example: string | null;
  example_translation: string | null;
  sort_order: number;
}

type Tab = 'my-groups' | 'discover';

export function CommunityPage() {
  const { token, user } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('my-groups');
  const [myGroups, setMyGroups] = useState<CommunityGroup[]>([]);
  const [publicGroups, setPublicGroups] = useState<CommunityGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<CommunityGroup | null>(null);

  // Create group form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupLanguage, setNewGroupLanguage] = useState(language);
  const [newGroupIsPublic, setNewGroupIsPublic] = useState(true);
  const [newGroupPermission, setNewGroupPermission] = useState('all');
  const [isCreating, setIsCreating] = useState(false);

  // Join by code
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Group detail
  const [groupLists, setGroupLists] = useState<VocabList[]>([]);
  const [expandedListId, setExpandedListId] = useState<number | null>(null);
  const [expandedListWords, setExpandedListWords] = useState<VocabWord[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);

  // Copy invite code
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Add list modal
  const [showAddListModal, setShowAddListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isAddingList, setIsAddingList] = useState(false);

  // Fetch my groups
  const fetchMyGroups = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/community/my-groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyGroups(data);
      }
    } catch (err) {
      console.error('Error fetching my groups:', err);
    }
  }, [token]);

  // Fetch public groups
  const fetchPublicGroups = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      // Only show communities for the currently selected learning language.
      if (language) params.set('language', language);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`${API_BASE_URL}/community/groups?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPublicGroups(data);
      }
    } catch (err) {
      console.error('Error fetching public groups:', err);
    }
  }, [token, language, searchQuery]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.all([fetchMyGroups(), fetchPublicGroups()]);
      setIsLoading(false);
    };
    load();
  }, [fetchMyGroups, fetchPublicGroups]);

  // Refetch public groups when filter changes
  useEffect(() => {
    if (activeTab === 'discover') {
      fetchPublicGroups();
    }
  }, [activeTab, language, searchQuery, fetchPublicGroups]);

  // Fetch group lists when group is selected
  useEffect(() => {
    if (selectedGroup) {
      fetchGroupLists(selectedGroup.id);
    }
  }, [selectedGroup]);

  const fetchGroupLists = async (groupId: number) => {
    if (!token) return;
    setIsLoadingLists(true);
    try {
      const res = await fetch(`${API_BASE_URL}/community/groups/${groupId}/lists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGroupLists(data);
      }
    } catch (err) {
      console.error('Error fetching group lists:', err);
    } finally {
      setIsLoadingLists(false);
    }
  };

  const fetchListWords = async (listId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/community/lists/${listId}/words`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setExpandedListWords(data);
      }
    } catch (err) {
      console.error('Error fetching list words:', err);
    }
  };

  const handleToggleList = (listId: number) => {
    if (expandedListId === listId) {
      setExpandedListId(null);
      setExpandedListWords([]);
    } else {
      setExpandedListId(listId);
      fetchListWords(listId);
    }
  };

  // Create group
  const handleCreateGroup = async () => {
    if (!token || !newGroupName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/community/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDescription.trim() || null,
          language: newGroupLanguage,
          is_public: newGroupIsPublic,
          member_permission: newGroupPermission,
        }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setNewGroupName('');
        setNewGroupDescription('');
        fetchMyGroups();
        fetchPublicGroups();
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to create community');
      }
    } catch (err) {
      console.error('Error creating group:', err);
      alert('Failed to create community');
    } finally {
      setIsCreating(false);
    }
  };

  // Join group by code
  const handleJoinByCode = async () => {
    if (!token || !joinCode.trim()) return;
    setIsJoining(true);
    try {
      const res = await fetch(`${API_BASE_URL}/community/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ invite_code: joinCode.trim().toUpperCase() }),
      });
      if (res.ok) {
        setShowJoinModal(false);
        setJoinCode('');
        fetchMyGroups();
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to join community');
      }
    } catch (err) {
      console.error('Error joining group:', err);
      alert('Failed to join community');
    } finally {
      setIsJoining(false);
    }
  };

  // Join public group
  const handleJoinPublicGroup = async (groupId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/community/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ group_id: groupId }),
      });
      if (res.ok) {
        fetchMyGroups();
        fetchPublicGroups();
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to join community');
      }
    } catch (err) {
      console.error('Error joining group:', err);
    }
  };

  // Leave group
  const handleLeaveGroup = async (groupId: number) => {
    if (!token) return;
    if (!confirm('Are you sure you want to leave this community?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/community/leave?group_id=${groupId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchMyGroups();
        setSelectedGroup(null);
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to leave community');
      }
    } catch (err) {
      console.error('Error leaving group:', err);
    }
  };

  // Delete group
  const handleDeleteGroup = async (groupId: number) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this community? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/community/groups/${groupId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchMyGroups();
        fetchPublicGroups();
        setSelectedGroup(null);
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to delete community');
      }
    } catch (err) {
      console.error('Error deleting group:', err);
    }
  };

  // Copy invite code
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Add vocab list to group
  const handleAddList = async () => {
    if (!token || !selectedGroup || !newListName.trim()) return;
    setIsAddingList(true);
    try {
      const res = await fetch(`${API_BASE_URL}/community/groups/${selectedGroup.id}/lists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newListName.trim() }),
      });
      if (res.ok) {
        setShowAddListModal(false);
        setNewListName('');
        fetchGroupLists(selectedGroup.id);
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to add list');
      }
    } catch (err) {
      console.error('Error adding list:', err);
    } finally {
      setIsAddingList(false);
    }
  };

  // Check if user is member of a group
  const isMember = (groupId: number) => {
    return myGroups.some(g => g.id === groupId);
  };

  // Check if user can add content
  const canAddContent = (group: CommunityGroup) => {
    if (!user) return false;
    const membership = myGroups.find(g => g.id === group.id);
    if (!membership) return false;
    if (group.member_permission === 'all') return true;
    return membership.role === 'creator';
  };

  const languageFlags: Record<string, string> = {
    ko: '🇰🇷',
    uk: '🇺🇦',
    es: '🇪🇸',
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-20">
        <Skeleton className="h-9 w-44 rounded-lg mb-3" />
        <Skeleton className="h-5 w-72 rounded mb-8" />
        <div className="flex gap-3 mb-8">
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  // Group detail view
  if (selectedGroup) {
    return (
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-20">
        {/* Back button */}
        <button
          onClick={() => setSelectedGroup(null)}
          className="flex items-center gap-2 text-secondary hover:text-primary transition-colors mb-6"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Communities
        </button>

        {/* Group header */}
        <div className="bg-surface border border-white/5 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Users className="w-8 h-8" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-primary">{selectedGroup.name}</h1>
                {selectedGroup.is_public ? (
                  <Globe className="w-4 h-4 text-muted" />
                ) : (
                  <Lock className="w-4 h-4 text-muted" />
                )}
              </div>
              {selectedGroup.description && (
                <p className="text-secondary mb-2">{selectedGroup.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted">
                <span>{languageFlags[selectedGroup.language]} {selectedGroup.language.toUpperCase()}</span>
                <span>{selectedGroup.member_count} members</span>
                <span>{selectedGroup.list_count} lists</span>
                <span>{selectedGroup.word_count} words</span>
              </div>
            </div>
          </div>

          {/* Invite code (for private groups or if creator) */}
          {(!selectedGroup.is_public || myGroups.find(g => g.id === selectedGroup.id)?.role === 'creator') && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-3">
                <span className="text-sm text-secondary">Invite Code:</span>
                <code className="bg-app px-3 py-1.5 rounded-lg text-accent font-mono">
                  {selectedGroup.invite_code}
                </code>
                <button
                  onClick={() => handleCopyCode(selectedGroup.invite_code)}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  {copiedCode === selectedGroup.invite_code ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 pt-4 border-t border-white/5 flex gap-3">
            {myGroups.find(g => g.id === selectedGroup.id)?.role === 'creator' ? (
              <button
                onClick={() => handleDeleteGroup(selectedGroup.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />Delete Community
              </button>
            ) : isMember(selectedGroup.id) ? (
              <button
                onClick={() => handleLeaveGroup(selectedGroup.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-secondary hover:bg-white/5 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Leave Community
              </button>
            ) : (
              <button
                onClick={() => handleJoinPublicGroup(selectedGroup.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-app font-bold hover:bg-accent-hover transition-colors"
              >
                <Plus className="w-4 h-4" />
                Join Community
              </button>
            )}
          </div>
        </div>

        {/* Vocab lists */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-primary">Vocabulary Lists</h2>
            {canAddContent(selectedGroup) && (
              <button
                onClick={() => setShowAddListModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-app font-bold text-sm hover:bg-accent-hover transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add List
              </button>
            )}
          </div>

          {isLoadingLists ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          ) : groupLists.length === 0 ? (
            <div className="bg-surface border border-white/5 rounded-2xl p-8 text-center">
              <FileText className="w-12 h-12 text-muted mx-auto mb-3" />
              <p className="text-secondary">No vocabulary lists yet</p>
              {canAddContent(selectedGroup) && (
                <button
                  onClick={() => setShowAddListModal(true)}
                  className="mt-4 text-accent hover:underline"
                >
                  Add the first list
                </button>
              )}
            </div>
          ) : (
            groupLists.map(list => (
              <div key={list.id} className="bg-surface border border-white/5 rounded-2xl overflow-hidden">
                <button
                  onClick={() => handleToggleList(list.id)}
                  className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-primary">{list.name}</p>
                    <p className="text-xs text-secondary">
                      {list.word_count} words
                    </p>
                  </div>
                  {expandedListId === list.id ? (
                    <ChevronUp className="w-5 h-5 text-muted" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted" />
                  )}
                </button>

                <AnimatePresence>
                  {expandedListId === list.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5"
                    >
                      <div className="p-4 max-h-64 overflow-y-auto space-y-2">
                        {expandedListWords.length === 0 ? (
                          <p className="text-center text-muted py-4">No words yet</p>
                        ) : (
                          expandedListWords.map(word => (
                            <div key={word.id} className="p-3 bg-app/30 rounded-lg">
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
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>

        {/* Add List Modal */}
        <AnimatePresence>
          {showAddListModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowAddListModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-md"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-primary">Add Vocabulary List</h2>
                  <button onClick={() => setShowAddListModal(false)} className="text-muted hover:text-primary">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="List name..."
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  className="w-full bg-app border border-white/10 rounded-xl px-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:border-accent/50 mb-6"
                />

                <button
                  onClick={handleAddList}
                  disabled={!newListName.trim() || isAddingList}
                  className="w-full bg-accent text-app font-bold py-3 rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {isAddingList ? 'Adding...' : 'Add List'}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Main community view
  return (
    <div className="max-w-6xl mx-auto px-4 pt-8 pb-20">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-primary mb-2">Communities</h1>
        <p className="text-secondary">Discover and share vocabulary with others</p>
      </div>

      {/* Tabs and actions */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <SegmentedTabs
          layoutId="community-tab-pill"
          active={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'my-groups', label: 'My Communities' },
            { id: 'discover', label: 'Discover' },
          ]}
        />

        <div className="flex gap-2">
          <button
            onClick={() => setShowJoinModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface text-secondary hover:text-primary transition-colors border border-white/5"
          >
            <Lock className="w-4 h-4" />
            Join by Code
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-app font-bold hover:bg-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>
      </div>

      {/* My Groups Tab */}
      {activeTab === 'my-groups' && (
        <div className="space-y-4">
          {myGroups.length === 0 ? (
            <div className="rounded-2xl p-12 text-center">
              <Users className="w-16 h-16 text-muted mx-auto mb-4" />
              <h3 className="text-xl font-bold text-primary mb-2">No communities yet</h3>
              <p className="text-secondary">
                Join a public community or create your own to start sharing vocabulary
              </p>
            </div>
          ) : (
            myGroups.map(group => (
              <div
                key={group.id}
                className="bg-surface border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors cursor-pointer"
                onClick={() => setSelectedGroup(group)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-primary">{group.name}</h3>
                      {group.is_public ? (
                        <Globe className="w-3.5 h-3.5 text-muted" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-muted" />
                      )}
                      {group.role === 'creator' && (
                        <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">Owner</span>
                      )}
                    </div>
                    <p className="text-sm text-secondary">
                      {languageFlags[group.language]} {group.list_count} lists · {group.word_count} words · {group.member_count} members
                    </p>
                  </div>
                  {!group.is_public && (
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-app px-2 py-1 rounded text-muted">{group.invite_code}</code>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleCopyCode(group.invite_code);
                        }}
                        className="p-1.5 rounded hover:bg-white/5"
                      >
                        {copiedCode === group.invite_code ? (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-muted" />
                        )}
                      </button>
                    </div>
                  )}
                  <ChevronRight className="w-5 h-5 text-muted" />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Discover Tab */}
      {activeTab === 'discover' && (
        <div className="space-y-4">
          {/* Search (groups are filtered to the currently selected language) */}
          <div className="flex gap-3 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
              <input
                type="text"
                placeholder="Search communities..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-xl pl-10 pr-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>

          {publicGroups.length === 0 ? (
            <div className="rounded-2xl p-12 text-center">
              <Globe className="w-16 h-16 text-muted mx-auto mb-4" />
              <h3 className="text-xl font-bold text-primary mb-2">No public communities found</h3>
              <p className="text-secondary">
                Be the first to create a public community for others to discover
              </p>
            </div>
          ) : (
            publicGroups.map(group => (
              <div
                key={group.id}
                className="bg-surface border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedGroup(group)}>
                    <h3 className="font-bold text-primary">{group.name}</h3>
                    <p className="text-sm text-secondary">
                      {languageFlags[group.language]} {group.member_count} members · {group.word_count} words
                    </p>
                  </div>
                  {isMember(group.id) ? (
                    <span className="text-sm text-green-400 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      Joined
                    </span>
                  ) : (
                    <button
                      onClick={() => handleJoinPublicGroup(group.id)}
                      className="px-4 py-2 rounded-lg bg-accent text-app font-bold text-sm hover:bg-accent-hover transition-colors"
                    >
                      Join
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Community Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-primary">Create Community</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-secondary mb-1 block">Community Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Kpop Vocab, Study Community"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    className="w-full bg-app border border-white/10 rounded-xl px-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:border-accent/50"
                  />
                </div>

                <div>
                  <label className="text-sm text-secondary mb-1 block">Description (optional)</label>
                  <textarea
                    placeholder="What's this community about?"
                    value={newGroupDescription}
                    onChange={e => setNewGroupDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-app border border-white/10 rounded-xl px-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:border-accent/50 resize-none"
                  />
                </div>

                <div>
                  <label className="text-sm text-secondary mb-1 block">Language</label>
                  <div className="flex gap-2">
                    {['ko', 'uk', 'es'].map(lang => (
                      <button
                        key={lang}
                        onClick={() => setNewGroupLanguage(lang)}
                        className={`flex-1 py-2 rounded-lg border transition-colors ${
                          newGroupLanguage === lang
                            ? 'bg-accent/10 border-accent text-primary'
                            : 'border-white/10 text-secondary hover:border-white/20'
                        }`}
                      >
                        {languageFlags[lang]} {lang.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-secondary mb-1 block">Visibility</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewGroupIsPublic(true)}
                      className={`flex-1 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                        newGroupIsPublic
                          ? 'bg-accent/10 border-accent text-primary'
                          : 'border-white/10 text-secondary hover:border-white/20'
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                      Public
                    </button>
                    <button
                      onClick={() => setNewGroupIsPublic(false)}
                      className={`flex-1 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                        !newGroupIsPublic
                          ? 'bg-accent/10 border-accent text-primary'
                          : 'border-white/10 text-secondary hover:border-white/20'
                      }`}
                    >
                      <Lock className="w-4 h-4" />
                      Private
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-secondary mb-1 block">Who can add vocabulary?</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewGroupPermission('all')}
                      className={`flex-1 py-2 rounded-lg border transition-colors ${
                        newGroupPermission === 'all'
                          ? 'bg-accent/10 border-accent text-primary'
                          : 'border-white/10 text-secondary hover:border-white/20'
                      }`}
                    >
                      All Members
                    </button>
                    <button
                      onClick={() => setNewGroupPermission('creator_only')}
                      className={`flex-1 py-2 rounded-lg border transition-colors ${
                        newGroupPermission === 'creator_only'
                          ? 'bg-accent/10 border-accent text-primary'
                          : 'border-white/10 text-secondary hover:border-white/20'
                      }`}
                    >
                      Only Me
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || isCreating}
                className="w-full mt-6 bg-accent text-app font-bold py-3 rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create Community'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join by Code Modal */}
      <AnimatePresence>
        {showJoinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowJoinModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-primary">Join by Invite Code</h2>
                <button onClick={() => setShowJoinModal(false)} className="text-muted hover:text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <input
                type="text"
                placeholder="Enter 6-character code..."
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-full bg-app border border-white/10 rounded-xl px-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:border-accent/50 font-mono text-center text-base tracking-wider mb-6"
              />

              <button
                onClick={handleJoinByCode}
                disabled={joinCode.length !== 6 || isJoining}
                className="w-full bg-accent text-app font-bold py-3 rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {isJoining ? 'Joining...' : 'Join Community'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
