import { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, Message } from '../../types';
import { messagesApi, csatApi, aiApi, snoozeApi, scheduledMessagesApi, conversationMergeApi, conversationsApi, revenueApi } from '../../api/client';
import { useWorkspaceStore } from '../../store/workspace';
import { getSocket } from '../../hooks/useSocket';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import ContactPanel from './ContactPanel';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import { InformationCircleIcon, StarIcon, ArrowDownTrayIcon, SparklesIcon, DocumentTextIcon, MoonIcon, ClockIcon, XMarkIcon, ArrowsRightLeftIcon, LanguageIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

interface Props {
  conversation: Conversation;
}

export default function ChatArea({ conversation }: Props) {
  const { currentWorkspace } = useWorkspaceStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [showMergeConv, setShowMergeConv] = useState(false);
  const [mergeConvId, setMergeConvId] = useState('');
  const [mergingConv, setMergingConv] = useState(false);
  const [translateMode, setTranslateMode] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [translateLang, setTranslateLang] = useState('English');
  const [convertedValue, setConvertedValue] = useState<number | null>((conversation as any).convertedValue ?? null);
  const [isConverted, setIsConverted] = useState(!!(conversation as any).convertedAt);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertInput, setConvertInput] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [scheduleContent, setScheduleContent] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const isTypingRef = useRef(false);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  useKeyboardShortcuts();

  // Join / leave socket room (only depends on conversation)
  useEffect(() => {
    const socket = getSocket();
    socket?.emit('join_conversation', conversation.id);
    return () => {
      socket?.emit('leave_conversation', conversation.id);
    };
  }, [conversation.id]);

  // Load messages when conversation changes OR workspace becomes available for the first time
  useEffect(() => {
    if (!currentWorkspace) return;
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, currentWorkspace?.id]);

  useEffect(() => {
    const handleNewMessage = (e: any) => {
      const msg = e.detail as Message;
      // Guard: detail may be null/undefined if socket emits an unexpected shape
      if (!msg || msg.conversationId !== conversation.id) return;
      if (msg.conversationId === conversation.id) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      }
    };

    const handleTyping = (e: any) => {
      const { userName, isTyping } = e.detail;
      if (isTyping) {
        setTypingUsers(prev => prev.includes(userName) ? prev : [...prev, userName]);
        clearTimeout(typingTimerRef.current[userName]);
        typingTimerRef.current[userName] = setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u !== userName));
        }, 3000);
      } else {
        setTypingUsers(prev => prev.filter(u => u !== userName));
      }
    };

    const handleReactionUpdated = (e: any) => {
      const { messageId, reactions } = e.detail;
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    };

    window.addEventListener('new_message', handleNewMessage);
    window.addEventListener('typing_indicator', handleTyping);
    window.addEventListener('reaction_updated', handleReactionUpdated);
    return () => {
      window.removeEventListener('new_message', handleNewMessage);
      window.removeEventListener('typing_indicator', handleTyping);
      window.removeEventListener('reaction_updated', handleReactionUpdated);
    };
  }, [conversation.id]);

  const loadMessages = async () => {
    if (!currentWorkspace) {
      console.warn('[ChatArea] loadMessages: currentWorkspace is null — skipping fetch');
      return;
    }
    setLoading(true);
    try {
      console.log(`[ChatArea] fetching messages: workspaceId=${currentWorkspace.id} conversationId=${conversation.id}`);
      const { data } = await messagesApi.list(currentWorkspace.id, conversation.id, { limit: 100 });
      const msgs: Message[] = Array.isArray(data?.messages) ? data.messages : [];
      console.log(`[ChatArea] fetched ${msgs.length} messages`, msgs);
      setMessages(msgs);
      scrollToBottom(true);
    } catch (err: any) {
      console.error('[ChatArea] loadMessages error:', err?.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = (instant = false) => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' });
    }, 50);
  };

  const emitTyping = useCallback((isTyping: boolean) => {
    const socket = getSocket();
    socket?.emit('typing', { conversationId: conversation.id, isTyping });
  }, [conversation.id]);

  const handleTypingStart = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emitTyping(true);
    }
    clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      isTypingRef.current = false;
      emitTyping(false);
    }, 2000);
  }, [emitTyping]);

  const handleSend = async (content: string, isNote = false, media?: { url: string; name: string; size: number; type: string }) => {
    if (!currentWorkspace) return;
    clearTimeout(typingDebounceRef.current);
    isTypingRef.current = false;
    emitTyping(false);

    // 1. Optimistic message — visible instantly, before the API round-trip
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const mediaType = media?.type || '';
    const optimistic: Message = {
      id: tempId,
      content: content || (media?.name ?? 'File'),
      type: media
        ? (mediaType.startsWith('image/') ? 'image'
          : mediaType.startsWith('audio/') ? 'audio'
          : mediaType.startsWith('video/') ? 'video'
          : 'document')
        : 'text',
      direction: 'outbound',
      status: 'sending',
      isNote,
      conversationId: conversation.id,
      createdAt: new Date().toISOString(),
      reactions: [],
      ...(media ? { mediaUrl: media.url, mediaType: media.type } : {}),
    };
    setMessages(prev => [...prev, optimistic]);
    scrollToBottom();

    try {
      const { data } = await messagesApi.send(currentWorkspace.id, conversation.id, content, undefined, isNote, media);
      // Replace optimistic temp (or just remove it if socket already added the real message)
      setMessages(prev => {
        const realAlreadyAdded = prev.some(m => m.id === data.id);
        if (realAlreadyAdded) return prev.filter(m => m.id !== tempId);
        return prev.map(m => m.id === tempId ? data : m);
      });
      scrollToBottom();
    } catch (err: any) {
      console.error('[ChatArea] send error:', err?.response?.data || err);
      // Mark optimistic message as failed
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as const } : m));
    }
  };

  const handleReactionUpdate = (messageId: string, reactions: any[]) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
  };

  const openMergeConv = async () => {
    if (!currentWorkspace) return;
    setShowMergeConv(true);
    try {
      const { data } = await conversationsApi.list(currentWorkspace.id, { limit: 50 });
      setConversations((data.conversations || data).filter((c: any) => c.id !== conversation.id));
    } catch { /* ignore */ }
  };

  const handleMergeConv = async () => {
    if (!currentWorkspace || !mergeConvId) return;
    setMergingConv(true);
    try {
      await conversationMergeApi.merge(currentWorkspace.id, conversation.id, mergeConvId);
      setShowMergeConv(false);
      setMergeConvId('');
      // Reload messages after merge
      const { data } = await messagesApi.list(currentWorkspace.id, conversation.id);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      alert('✅ Conversations merged successfully');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Merge failed');
    } finally {
      setMergingConv(false);
    }
  };

  const handleSendCsat = async () => {
    if (!currentWorkspace) return;
    try {
      await csatApi.send(currentWorkspace.id, conversation.id);
      alert('CSAT survey link sent to contact ✅');
    } catch {
      alert('Failed to send CSAT');
    }
  };

  const handleGetSuggestions = async () => {
    if (!currentWorkspace) return;
    setLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const { data } = await aiApi.suggestions(currentWorkspace.id, conversation.id);
      setSuggestions(data.suggestions || []);
    } catch { setSuggestions([]); }
    finally { setLoadingSuggestions(false); }
  };

  const handleGetSummary = async () => {
    if (!currentWorkspace) return;
    setLoadingSummary(true);
    setSummary(null);
    try {
      const { data } = await aiApi.summary(currentWorkspace.id, conversation.id);
      setSummary(data.summary);
    } catch { setSummary('Failed to generate summary.'); }
    finally { setLoadingSummary(false); }
  };

  const handleSnooze = async () => {
    if (!currentWorkspace || !snoozeUntil) return;
    await snoozeApi.snooze(currentWorkspace.id, conversation.id, snoozeUntil);
    setShowSnooze(false);
  };

  const handleSchedule = async () => {
    if (!currentWorkspace || !scheduleContent || !scheduleAt) return;
    await scheduledMessagesApi.create(currentWorkspace.id, conversation.id, {
      content: scheduleContent, scheduledAt: scheduleAt,
    });
    setScheduledMessages(prev => [...prev, { content: scheduleContent, scheduledAt: scheduleAt }]);
    setScheduleContent('');
    setScheduleAt('');
    setShowSchedule(false);
  };

  const translateMessage = async (msgId: string, text: string) => {
    if (!currentWorkspace || translations[msgId]) return;
    setTranslatingIds(prev => new Set(prev).add(msgId));
    try {
      const { data } = await aiApi.translate(currentWorkspace.id, text, translateLang);
      setTranslations(prev => ({ ...prev, [msgId]: data.translated }));
    } catch { /* ignore */ }
    finally { setTranslatingIds(prev => { const s = new Set(prev); s.delete(msgId); return s; }); }
  };

  const handleTranslateToggle = async () => {
    const newMode = !translateMode;
    setTranslateMode(newMode);
    if (newMode && currentWorkspace) {
      // Translate last 10 inbound messages
      const inbound = messages.filter(m => m.direction === 'inbound' && m.content && !translations[m.id]).slice(-10);
      for (const m of inbound) translateMessage(m.id, m.content);
    }
  };

  const handleMarkConverted = async () => {
    if (!currentWorkspace) return;
    const val = parseFloat(convertInput) || 0;
    await revenueApi.markConverted(currentWorkspace.id, conversation.id, val);
    setIsConverted(true);
    setConvertedValue(val);
    setShowConvertModal(false);
    setConvertInput('');
  };

  const handleUnmarkConverted = async () => {
    if (!currentWorkspace) return;
    await revenueApi.unmarkConverted(currentWorkspace.id, conversation.id);
    setIsConverted(false);
    setConvertedValue(null);
  };

  const handleExportConversation = () => {
    const lines = [`Conversation with ${conversation.contact.name}`, `Status: ${conversation.status}`, `Channel: ${conversation.channel?.name}`, '---', ''];
    messages.forEach(m => {
      const dir = m.direction === 'inbound' ? `[${conversation.contact.name}]` : '[Agent]';
      const note = m.isNote ? ' (internal note)' : '';
      const time = new Date(m.createdAt).toLocaleString();
      lines.push(`${dir}${note} ${time}`);
      lines.push(m.content);
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conversation.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shouldShowDate = (idx: number) => {
    if (idx === 0) return true;
    const msgList = Array.isArray(messages) ? messages : [];
    if (idx >= msgList.length) return false;
    const prev = new Date(msgList[idx - 1]?.createdAt);
    const curr = new Date(msgList[idx]?.createdAt);
    return prev.toDateString() !== curr.toDateString();
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Chat column */}
      <div className="flex flex-col flex-1 overflow-hidden bg-[#f7f8fc]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Avatar name={conversation.contact.name} size="md" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{conversation.contact.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{conversation.contact.phone || conversation.contact.email || ''}</span>
                <Badge label={conversation.status} variant="status" />
                {conversation.snoozedUntil && new Date(conversation.snoozedUntil) > new Date() && (
                  <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                    😴 Snoozed
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full mr-1">
              via {conversation.channel?.name}
            </span>
            <button onClick={handleGetSuggestions} disabled={loadingSuggestions}
              className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
              title="AI reply suggestions">
              <SparklesIcon className="w-5 h-5" />
            </button>
            <button onClick={handleGetSummary} disabled={loadingSummary}
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="AI conversation summary">
              <DocumentTextIcon className="w-5 h-5" />
            </button>
            <button onClick={() => setShowSnooze(v => !v)}
              className={`p-1.5 rounded-lg transition-colors ${showSnooze ? 'bg-yellow-50 text-yellow-600' : 'text-gray-400 hover:bg-yellow-50 hover:text-yellow-600'}`}
              title="Snooze conversation">
              <MoonIcon className="w-5 h-5" />
            </button>
            <button onClick={() => setShowSchedule(v => !v)}
              className={`p-1.5 rounded-lg transition-colors ${showSchedule ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-blue-50 hover:text-blue-600'}`}
              title="Schedule message">
              <ClockIcon className="w-5 h-5" />
            </button>
            <button onClick={openMergeConv}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-purple-50 hover:text-purple-600 transition-colors"
              title="Merge conversation">
              <ArrowsRightLeftIcon className="w-5 h-5" />
            </button>
            {conversation.status === 'resolved' && (
              <button onClick={handleSendCsat}
                className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 transition-colors"
                title="Send CSAT survey">
                <StarIcon className="w-5 h-5" />
              </button>
            )}
            {/* Auto-translate */}
            <button
              onClick={handleTranslateToggle}
              className={`p-1.5 rounded-lg transition-colors ${translateMode ? 'bg-green-50 text-green-600' : 'text-gray-400 hover:bg-green-50 hover:text-green-600'}`}
              title={translateMode ? 'Disable auto-translate' : 'Translate messages'}
            >
              <LanguageIcon className="w-5 h-5" />
            </button>
            {/* Revenue attribution */}
            <button
              onClick={isConverted ? handleUnmarkConverted : () => setShowConvertModal(true)}
              className={`p-1.5 rounded-lg transition-colors ${isConverted ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
              title={isConverted ? `Converted${convertedValue ? ' ($' + convertedValue + ')' : ''} — click to undo` : 'Mark as converted (won deal)'}
            >
              <CurrencyDollarIcon className="w-5 h-5" />
            </button>
            <button onClick={handleExportConversation}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Export conversation">
              <ArrowDownTrayIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowPanel((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${showPanel ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:bg-gray-100'}`}
              title="Toggle contact panel">
              <InformationCircleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* AI Summary */}
        {(loadingSummary || summary) && (
          <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-start gap-2">
            <DocumentTextIcon className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              {loadingSummary ? <p className="text-xs text-indigo-500">Generating summary…</p> : <p className="text-xs text-indigo-800">{summary}</p>}
            </div>
            <button onClick={() => setSummary(null)} className="text-indigo-400 hover:text-indigo-600"><XMarkIcon className="w-4 h-4" /></button>
          </div>
        )}

        {/* AI Suggestions */}
        {(loadingSuggestions || suggestions.length > 0) && (
          <div className="px-5 py-3 bg-purple-50 border-b border-purple-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-purple-700 flex items-center gap-1"><SparklesIcon className="w-3 h-3" />Suggested replies</p>
              <button onClick={() => setSuggestions([])} className="text-purple-400 hover:text-purple-600"><XMarkIcon className="w-4 h-4" /></button>
            </div>
            {loadingSuggestions ? <p className="text-xs text-purple-500">Generating suggestions…</p> : (
              <div className="space-y-1">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => handleSend(s)}
                    className="w-full text-left text-xs bg-white border border-purple-200 hover:border-purple-400 text-gray-700 px-3 py-2 rounded-lg transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Snooze panel */}
        {showSnooze && (
          <div className="px-5 py-3 bg-yellow-50 border-b border-yellow-100 flex items-center gap-3">
            <MoonIcon className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <p className="text-xs font-medium text-yellow-800">Snooze until:</p>
            <input type="datetime-local" value={snoozeUntil} onChange={e => setSnoozeUntil(e.target.value)}
              className="text-xs border border-yellow-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-300" />
            <button onClick={handleSnooze} disabled={!snoozeUntil}
              className="bg-yellow-500 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-yellow-600 disabled:opacity-50">
              Snooze
            </button>
            <button onClick={() => setShowSnooze(false)} className="text-yellow-400 hover:text-yellow-600 ml-auto"><XMarkIcon className="w-4 h-4" /></button>
          </div>
        )}

        {/* Schedule message panel */}
        {showSchedule && (
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <ClockIcon className="w-4 h-4 text-blue-600" />
              <p className="text-xs font-medium text-blue-800">Schedule a message</p>
              <button onClick={() => setShowSchedule(false)} className="text-blue-400 hover:text-blue-600 ml-auto"><XMarkIcon className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder="Message content…" value={scheduleContent} onChange={e => setScheduleContent(e.target.value)}
                className="flex-1 text-xs border border-blue-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)}
                className="text-xs border border-blue-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <button onClick={handleSchedule} disabled={!scheduleContent || !scheduleAt}
                className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                Schedule
              </button>
            </div>
          </div>
        )}

        {/* Merge Conversation Panel */}
        {showMergeConv && (
          <div className="px-4 py-3 bg-purple-50 border-b border-purple-100">
            <p className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1"><ArrowsRightLeftIcon className="w-3.5 h-3.5" />Merge into another conversation</p>
            <p className="text-xs text-purple-600 mb-2">All messages from this conversation will be moved to the selected one.</p>
            <div className="flex gap-2">
              <select
                className="flex-1 text-xs border border-purple-200 rounded-lg px-2 py-1.5 bg-white"
                value={mergeConvId}
                onChange={e => setMergeConvId(e.target.value)}
              >
                <option value="">Select target conversation…</option>
                {conversations.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.contact?.name || 'Unknown'} — {new Date(c.lastMessageAt || c.createdAt).toLocaleDateString()}</option>
                ))}
              </select>
              <button onClick={handleMergeConv} disabled={!mergeConvId || mergingConv}
                className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg disabled:opacity-50">
                {mergingConv ? '…' : 'Merge'}
              </button>
              <button onClick={() => setShowMergeConv(false)} className="px-2 py-1.5 text-gray-400 text-xs rounded-lg hover:bg-white">Cancel</button>
            </div>
          </div>
        )}

        {/* Revenue conversion modal */}
        {showConvertModal && (
          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100">
            <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1"><CurrencyDollarIcon className="w-3.5 h-3.5" />Mark as converted</p>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder="Deal value (optional, e.g. 500)"
                value={convertInput}
                onChange={e => setConvertInput(e.target.value)}
                className="flex-1 text-xs border border-emerald-200 rounded-lg px-2 py-1.5 bg-white"
              />
              <button onClick={handleMarkConverted} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg">Mark Won ✓</button>
              <button onClick={() => setShowConvertModal(false)} className="px-2 py-1.5 text-gray-400 text-xs hover:bg-white rounded-lg">Cancel</button>
            </div>
          </div>
        )}

        {/* Translate language picker */}
        {translateMode && (
          <div className="px-4 py-1.5 bg-green-50 border-b border-green-100 flex items-center gap-2">
            <LanguageIcon className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            <span className="text-xs text-green-700">Translating to:</span>
            <select
              value={translateLang}
              onChange={e => { setTranslateLang(e.target.value); setTranslations({}); }}
              className="text-xs border border-green-200 rounded px-1 py-0.5 bg-white text-green-700"
            >
              {['English','Spanish','Portuguese','French','German','Italian','Japanese','Chinese','Arabic'].map(l => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
        )}

        {/* Keyboard shortcut hint */}
        <div className="px-4 py-1 bg-gray-50 border-b border-gray-100 flex items-center gap-3 text-[10px] text-gray-400">
          <span><kbd className="bg-gray-200 px-1 rounded">J</kbd>/<kbd className="bg-gray-200 px-1 rounded">K</kbd> navigate</span>
          <span><kbd className="bg-gray-200 px-1 rounded">R</kbd> resolve</span>
          <span><kbd className="bg-gray-200 px-1 rounded">U</kbd> pending</span>
          <span><kbd className="bg-gray-200 px-1 rounded">⌘K</kbd> search</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : !Array.isArray(messages) || messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <span className="text-3xl">💬</span>
              <p className="text-gray-500 text-sm font-medium">No messages yet</p>
              <p className="text-gray-400 text-xs">Start the conversation using the input below.</p>
            </div>
          ) : (
            <>
              {(messages as Message[]).map((msg, idx) => (
                <div key={msg.id}>
                  <MessageBubble
                    message={msg}
                    showDate={shouldShowDate(idx)}
                    conversationId={conversation.id}
                    onReactionUpdate={handleReactionUpdate}
                  />
                  {/* Auto-translation: show for inbound messages when translate mode is on */}
                  {translateMode && msg.direction === 'inbound' && msg.content && (
                    <div className="ml-12 mt-0.5 mb-1">
                      {translatingIds.has(msg.id) ? (
                        <span className="text-[10px] text-gray-400 italic">Translating…</span>
                      ) : translations[msg.id] ? (
                        <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded-lg border border-green-100">
                          🌐 {translations[msg.id]}
                        </span>
                      ) : (
                        <button
                          onClick={() => translateMessage(msg.id, msg.content)}
                          className="text-[10px] text-gray-400 hover:text-green-600 underline"
                        >
                          Translate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 mt-2 ml-1">
                  <div className="flex gap-1 bg-white rounded-2xl px-4 py-2 shadow-sm border border-gray-100">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-gray-400">{typingUsers.join(', ')} typing…</span>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} onTyping={handleTypingStart} contact={conversation.contact as any} />
      </div>

      {/* Contact panel */}
      {showPanel && <ContactPanel conversation={conversation} />}
    </div>
  );
}
