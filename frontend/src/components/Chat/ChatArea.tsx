import { useState, useEffect, useRef } from 'react';
import { Conversation, Message } from '../../types';
import { messagesApi } from '../../api/client';
import { useWorkspaceStore } from '../../store/workspace';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import ContactPanel from './ContactPanel';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface Props {
  conversation: Conversation;
}

export default function ChatArea({ conversation }: Props) {
  const { currentWorkspace } = useWorkspaceStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [conversation.id]);

  useEffect(() => {
    const handler = (e: any) => {
      const msg = e.detail as Message;
      if (msg.conversationId === conversation.id) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      }
    };
    window.addEventListener('new_message', handler);
    return () => window.removeEventListener('new_message', handler);
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

  const handleSend = async (content: string, isNote = false) => {
    if (!currentWorkspace) return;
    const { data } = await messagesApi.send(currentWorkspace.id, conversation.id, content, undefined, isNote);
    setMessages((prev) => [...prev, data]);
    scrollToBottom();
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
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
              via {conversation.channel?.name}
            </span>
            <button
              onClick={() => setShowPanel((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${showPanel ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:bg-gray-100'}`}
              title="Toggle contact panel"
            >
              <InformationCircleIcon className="w-5 h-5" />
            </button>
          </div>
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
                <MessageBubble key={msg.id} message={msg} showDate={shouldShowDate(idx)} />
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} />
      </div>

      {/* Contact panel */}
      {showPanel && <ContactPanel conversation={conversation} />}
    </div>
  );
}
