import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { PaperAirplaneIcon, FaceSmileIcon, PaperClipIcon, BoltIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { savedResponsesApi } from '../../api/client';
import { useWorkspaceStore } from '../../store/workspace';
import { SavedResponse } from '../../types';

interface Props {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplies, setQuickReplies] = useState<SavedResponse[]>([]);
  const [qrSearch, setQrSearch] = useState('');
  const [loadingQR, setLoadingQR] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { currentWorkspace } = useWorkspaceStore();

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowQuickReplies(false);
      }
    };
    if (showQuickReplies) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showQuickReplies]);

  const openQuickReplies = async () => {
    if (!currentWorkspace) return;
    setShowQuickReplies(true);
    setQrSearch('');
    setLoadingQR(true);
    try {
      const { data } = await savedResponsesApi.list(currentWorkspace.id);
      setQuickReplies(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingQR(false);
    }
  };

  const insertResponse = (text: string) => {
    setContent((prev) => prev ? prev + '\n' + text : text);
    setShowQuickReplies(false);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        textareaRef.current.focus();
      }
    }, 0);
  };

  const filteredQR = quickReplies.filter(
    (r) =>
      !qrSearch ||
      r.title.toLowerCase().includes(qrSearch.toLowerCase()) ||
      r.content.toLowerCase().includes(qrSearch.toLowerCase())
  );

  const handleSend = async () => {
    const text = content.trim();
    if (!text || sending || disabled) return;
    setSending(true);
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    try {
      await onSend(text);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  return (
    <div className="border-t border-gray-100 bg-white px-4 py-3">
      <div className="flex items-end gap-3 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
        <div className="flex gap-2 pb-0.5 relative" ref={popoverRef}>
          <button className="text-gray-400 hover:text-gray-600 transition-colors" title="Attach file">
            <PaperClipIcon className="w-5 h-5" />
          </button>
          <button className="text-gray-400 hover:text-gray-600 transition-colors" title="Emoji">
            <FaceSmileIcon className="w-5 h-5" />
          </button>
          {/* Quick replies button */}
          <button
            onClick={openQuickReplies}
            disabled={disabled}
            className="text-gray-400 hover:text-primary-600 transition-colors disabled:opacity-40"
            title="Quick replies"
          >
            <BoltIcon className="w-5 h-5" />
          </button>

          {/* Quick replies popover */}
          {showQuickReplies && (
            <div className="absolute bottom-10 left-0 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="p-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Replies</p>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    autoFocus
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Search responses..."
                    value={qrSearch}
                    onChange={(e) => setQrSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {loadingQR ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredQR.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    {quickReplies.length === 0 ? (
                      <span>No saved responses yet.<br />
                        <span className="text-xs">Add them in Settings → Saved Responses</span>
                      </span>
                    ) : 'No matches found'}
                  </div>
                ) : (
                  filteredQR.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => insertResponse(r.content)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                        {r.category && (
                          <span className="text-[10px] bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full flex-shrink-0">
                            {r.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">{r.content}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select a conversation to start messaging...' : 'Type a message... (Enter to send, Shift+Enter for new line)'}
          disabled={disabled || sending}
          rows={1}
          className="flex-1 bg-transparent resize-none text-sm text-gray-900 placeholder-gray-400 focus:outline-none max-h-[120px] overflow-y-auto"
          style={{ minHeight: '24px' }}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || sending || disabled}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-all"
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <PaperAirplaneIcon className="w-4 h-4" />
          )}
        </button>
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5 text-center">Press Enter to send · Shift+Enter for new line · ⚡ for quick replies</p>
    </div>
  );
}
