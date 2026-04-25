import { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, Message } from '../../types';
import { messagesApi, csatApi } from '../../api/client';
import { useWorkspaceStore } from '../../store/workspace';
import { getSocket } from '../../hooks/useSocket';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import ContactPanel from './ContactPanel';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import { InformationCircleIcon, StarIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const isTypingRef = useRef(false);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  useKeyboardShortcuts();

  useEffect(() => {
    loadMessages();
    // Join conversation room for typing indicators
    const socket = getSocket();
    socket?.emit('join_conversation', conversation.id);
    return () => {
      socket?.emit('leave_conversation', conversation.id);
    };
  }, [conversation.id]);

  useEffect(() => {
    const handleNewMessage = (e: any) => {
      const msg = e.detail as Message;
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
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const { data } = await messagesApi.list(currentWorkspace.id, conversation.id, { limit: 100 });
      setMessages(data.messages);
      scrollToBottom(true);
    } catch (err) {
      console.error(err);
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

  const handleSend = async (content: string, isNote = false) => {
    if (!currentWorkspace) return;
    clearTimeout(typingDebounceRef.current);
    isTypingRef.current = false;
    emitTyping(false);
    const { data } = await messagesApi.send(currentWorkspace.id, conversation.id, content, undefined, isNote);
    setMessages((prev) => [...prev, data]);
    scrollToBottom();
  };

  const handleReactionUpdate = (messageId: string, reactions: any[]) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
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
    const prev = new Date(messages[idx - 1].createdAt);
    const curr = new Date(messages[idx].createdAt);
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
              via {conversation.channel?.name}
            </span>
            {conversation.status === 'resolved' && (
              <button
                onClick={handleSendCsat}
                className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 transition-colors"
                title="Send CSAT survey"
              >
                <StarIcon className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleExportConversation}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Export conversation"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowPanel((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${showPanel ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:bg-gray-100'}`}
              title="Toggle contact panel"
            >
              <InformationCircleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

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
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              No messages yet. Start the conversation!
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  showDate={shouldShowDate(idx)}
                  conversationId={conversation.id}
                  onReactionUpdate={handleReactionUpdate}
                />
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
        <ChatInput onSend={handleSend} onTyping={handleTypingStart} />
      </div>

      {/* Contact panel */}
      {showPanel && <ContactPanel conversation={conversation} />}
    </div>
  );
}
