import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useWorkspaceStore } from '../../store/workspace';
import { useAuthStore } from '../../store/auth';
import { conversationsApi } from '../../api/client';
import { Conversation } from '../../types';
import ConversationItem from './ConversationItem';
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

  useEffect(() => {
    if (!currentWorkspace) return;
    loadConversations();
  }, [currentWorkspace, statusFilter, assignFilter]);

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

  const filtered = conversations.filter((c) =>
    !search || c.contact.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-80 flex flex-col border-r border-gray-100 bg-white flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Conversations</h2>
          <Button size="xs" variant="ghost" icon={<PlusIcon className="w-4 h-4" />} onClick={onNewConversation}>
            New
          </Button>
        </div>
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

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
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
          filtered.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              active={activeConversation?.id === conv.id}
              onClick={() => setActiveConversation(conv)}
            />
          ))
        )}
      </div>
    </div>
  );
}
