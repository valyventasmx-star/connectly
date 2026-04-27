import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, PlusIcon, BookmarkIcon, XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useWorkspaceStore } from '../../store/workspace';
import { useAuthStore } from '../../store/auth';
import { conversationsApi, inboxViewsApi, aiApi } from '../../api/client';
import { Conversation } from '../../types';
import ConversationItem, { TriageInfo } from './ConversationItem';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

const STATUS_FILTERS = ['all', 'open', 'pending', 'resolved'] as const;
const ASSIGN_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'unassigned', label: 'Unassigned' },
] as const;

interface Props {
  onNewConversation?: () => void;
}

export default function ConversationList({ onNewConversation }: Props) {
  const { currentWorkspace, conversations, setConversations, setActiveConversation, activeConversation } = useWorkspaceStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [assignFilter, setAssignFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [savedViews, setSavedViews] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [showSaveView, setShowSaveView] = useState(false);
  const [viewName, setViewName] = useState('');

  // AI Triage
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageMap, setTriageMap] = useState<Record<string, TriageInfo>>({});
  const [triageActive, setTriageActive] = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    loadConversations();
    inboxViewsApi.list(currentWorkspace.id).then(r => setSavedViews(r.data)).catch(() => {});
  }, [currentWorkspace, statusFilter, assignFilter]);

  const applyView = (view: any) => {
    const filters = JSON.parse(view.filters);
    setActiveView(view.id);
    if (filters.status) setStatusFilter(filters.status);
    if (filters.assigneeId === 'mine' && user) setAssignFilter('mine');
    else if (filters.assigneeId === 'null') setAssignFilter('unassigned');
    else setAssignFilter('all');
  };

  const saveCurrentView = async () => {
    if (!currentWorkspace || !viewName.trim()) return;
    const filters: any = { status: statusFilter };
    if (assignFilter === 'mine') filters.assigneeId = 'mine';
    else if (assignFilter === 'unassigned') filters.assigneeId = 'null';
    const { data } = await inboxViewsApi.create(currentWorkspace.id, viewName.trim(), filters);
    setSavedViews(v => [...v, data]);
    setViewName('');
    setShowSaveView(false);
  };

  const deleteView = async (viewId: string) => {
    if (!currentWorkspace) return;
    await inboxViewsApi.delete(currentWorkspace.id, viewId);
    setSavedViews(v => v.filter(vw => vw.id !== viewId));
    if (activeView === viewId) setActiveView(null);
  };

  useEffect(() => {
    const handler = () => {
      if (currentWorkspace) loadConversations();
    };
    window.addEventListener('conversation_updated', handler);
    return () => window.removeEventListener('conversation_updated', handler);
  }, [currentWorkspace]);

  const loadConversations = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (assignFilter === 'mine' && user) params.assigneeId = user.id;
      if (assignFilter === 'unassigned') params.assigneeId = 'null';
      const { data } = await conversationsApi.list(currentWorkspace.id, params);
      setConversations(data.conversations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runTriage = async () => {
    if (!currentWorkspace) return;
    setTriageLoading(true);
    try {
      const { data } = await aiApi.triage(currentWorkspace.id);
      const map: Record<string, TriageInfo> = {};
      for (const r of data.rankings) {
        map[r.id] = { urgencyScore: r.urgencyScore, reason: r.reason };
      }
      setTriageMap(map);
      setTriageActive(true);
    } catch (err) {
      console.error('Triage failed', err);
    } finally {
      setTriageLoading(false);
    }
  };

  const clearTriage = () => {
    setTriageMap({});
    setTriageActive(false);
  };

  const filtered = conversations.filter((c) =>
    !search || c.contact.name.toLowerCase().includes(search.toLowerCase())
  );

  // When triage is active, sort by urgency score (1 = most urgent first)
  const displayed = triageActive
    ? [...filtered].sort((a, b) => {
        const sa = triageMap[a.id]?.urgencyScore ?? 99;
        const sb = triageMap[b.id]?.urgencyScore ?? 99;
        return sa - sb;
      })
    : filtered;

  return (
    <div className="w-80 flex flex-col border-r border-gray-100 bg-white flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Conversations</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={triageActive ? clearTriage : runTriage}
              disabled={triageLoading}
              title={triageActive ? 'Clear AI triage' : 'AI Triage — sort by urgency'}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                triageActive
                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <SparklesIcon className={`w-3.5 h-3.5 ${triageLoading ? 'animate-pulse' : ''}`} />
              {triageLoading ? 'Analyzing…' : triageActive ? 'Triage ON' : 'Triage'}
            </button>
            <Button size="xs" variant="ghost" icon={<BookmarkIcon className="w-3.5 h-3.5" />}
              onClick={() => setShowSaveView(v => !v)} title="Save current view">
              {!showSaveView ? '' : ''}
            </Button>
            <Button size="xs" variant="ghost" icon={<PlusIcon className="w-4 h-4" />} onClick={onNewConversation}>
              New
            </Button>
          </div>
        </div>
        {showSaveView && (
          <div className="flex gap-2 mb-2">
            <input
              autoFocus
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="View name..."
              value={viewName}
              onChange={e => setViewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveCurrentView(); if (e.key === 'Escape') setShowSaveView(false); }}
            />
            <button onClick={saveCurrentView} className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-colors">
              Save
            </button>
          </div>
        )}
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Saved Views */}
      {savedViews.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5 overflow-x-auto">
          {savedViews.map(view => (
            <div key={view.id} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium flex-shrink-0 cursor-pointer transition-colors ${
              activeView === view.id ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
              <BookmarkIcon className="w-3 h-3" />
              <span onClick={() => applyView(view)}>{view.name}</span>
              <button onClick={() => deleteView(view.id)} className="ml-0.5 hover:text-red-500 transition-colors">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Assignment filter */}
      <div className="flex border-b border-gray-100 px-2 bg-gray-50">
        {ASSIGN_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setAssignFilter(f.value)}
            className={`px-3 py-2 text-xs font-semibold transition-colors ${
              assignFilter === f.value
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex border-b border-gray-100 px-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-2.5 text-xs font-medium capitalize transition-colors ${
              statusFilter === s
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* AI Triage active banner */}
      {triageActive && (
        <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border-b border-purple-100 flex-shrink-0">
          <SparklesIcon className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
          <span className="text-xs text-purple-700 flex-1">Sorted by AI urgency — most critical first</span>
          <button onClick={clearTriage} className="text-purple-400 hover:text-purple-600">
            <XMarkIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={<ChatBubbleLeftIcon className="w-8 h-8" />}
            title="No conversations"
            description={
              assignFilter === 'mine' ? 'No conversations assigned to you.' :
              assignFilter === 'unassigned' ? 'No unassigned conversations.' :
              statusFilter === 'open' ? 'No open conversations yet.' :
              `No ${statusFilter} conversations.`
            }
          />
        ) : (
          displayed.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              active={activeConversation?.id === conv.id}
              onClick={() => setActiveConversation(conv)}
              triageInfo={triageMap[conv.id]}
            />
          ))
        )}
      </div>
    </div>
  );
}
