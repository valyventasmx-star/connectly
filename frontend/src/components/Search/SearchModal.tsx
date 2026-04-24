import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, UserIcon, ChatBubbleLeftRightIcon, DocumentTextIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { searchApi } from '../../api/client';
import { useWorkspaceStore } from '../../store/workspace';
import { formatDistanceToNow } from 'date-fns';

interface SearchResult {
  contacts: any[];
  conversations: any[];
  messages: any[];
}

export default function SearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ contacts: [], conversations: [], messages: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const { currentWorkspace, setActiveConversation, conversations } = useWorkspaceStore();
  const navigate = useNavigate();

  // ⌘K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQuery(''); setResults({ contacts: [], conversations: [], messages: [] }); }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!currentWorkspace || q.trim().length < 2) {
      setResults({ contacts: [], conversations: [], messages: [] });
      return;
    }
    setLoading(true);
    try {
      const { data } = await searchApi.search(currentWorkspace.id, q.trim());
      setResults(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timerRef.current);
  }, [query, doSearch]);

  const openConversation = (conv: any) => {
    setOpen(false);
    navigate('/inbox');
    setTimeout(() => {
      const found = conversations.find(c => c.id === conv.id);
      if (found) setActiveConversation(found);
    }, 100);
  };

  const openContact = (contact: any) => {
    setOpen(false);
    navigate('/contacts');
  };

  const hasResults = results.contacts.length + results.conversations.length + results.messages.length > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search contacts, conversations, messages..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              Start typing to search across your workspace
              <p className="text-xs mt-1 text-gray-300">⌘K to open · Esc to close</p>
            </div>
          ) : !hasResults && !loading ? (
            <div className="py-10 text-center text-sm text-gray-400">
              No results for "<span className="font-medium text-gray-600">{query}</span>"
            </div>
          ) : (
            <div className="py-2">
              {/* Contacts */}
              {results.contacts.length > 0 && (
                <div>
                  <div className="px-4 py-2 flex items-center gap-2">
                    <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Contacts</span>
                  </div>
                  {results.contacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => openContact(c)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                        {c.name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-500 truncate">{c.phone || c.email || c.company || ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Conversations */}
              {results.conversations.length > 0 && (
                <div>
                  <div className="px-4 py-2 flex items-center gap-2">
                    <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Conversations</span>
                  </div>
                  {results.conversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => openConversation(c)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                        {c.contact?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.contact?.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {c.messages?.[0]?.content || 'No messages'} · {c.channel?.name}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        c.status === 'open' ? 'bg-green-100 text-green-700' :
                        c.status === 'resolved' ? 'bg-gray-100 text-gray-600' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{c.status}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Messages */}
              {results.messages.length > 0 && (
                <div>
                  <div className="px-4 py-2 flex items-center gap-2">
                    <DocumentTextIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Messages</span>
                  </div>
                  {results.messages.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => openConversation({ id: m.conversationId, ...m.conversation })}
                      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                        {m.conversation?.contact?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-700 mb-0.5">{m.conversation?.contact?.name}</p>
                        <p className="text-sm text-gray-900 line-clamp-2 leading-relaxed">{m.content}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 text-[10px] text-gray-400">
          <span>⌘K to toggle</span>
          <span>·</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
