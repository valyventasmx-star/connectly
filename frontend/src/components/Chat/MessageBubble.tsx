import { useState } from 'react';
import { Message } from '../../types';
import { format } from 'date-fns';
import { LockClosedIcon, SparklesIcon, FaceSmileIcon } from '@heroicons/react/24/outline';
import { reactionsApi } from '../../api/client';
import { useWorkspaceStore } from '../../store/workspace';
import { useAuthStore } from '../../store/auth';

interface Props {
  message: Message;
  showDate?: boolean;
  conversationId: string;
  onReactionUpdate?: (messageId: string, reactions: any[]) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Rendered separately for 'sending' (spinner) and 'failed' (red x)
const STATUS_TEXT: Record<string, { icon: string; color: string }> = {
  sending:   { icon: '',    color: 'opacity-50' },   // replaced by spinner below
  sent:      { icon: '✓',   color: 'opacity-60' },
  delivered: { icon: '✓✓',  color: 'opacity-60' },
  read:      { icon: '✓✓',  color: 'text-blue-300' },
  failed:    { icon: '✗',   color: 'text-red-400' },
  pending:   { icon: '⏳',  color: 'opacity-50' },
};

export default function MessageBubble({ message, showDate, conversationId, onReactionUpdate }: Props) {
  const isOut = message.direction === 'outbound';
  const isNote = message.isNote;
  const time = format(new Date(message.createdAt), 'HH:mm');
  const [showPicker, setShowPicker] = useState(false);
  const { currentWorkspace } = useWorkspaceStore();
  const { user } = useAuthStore();

  const handleReaction = async (emoji: string) => {
    if (!currentWorkspace) return;
    setShowPicker(false);
    try {
      const { data } = await reactionsApi.toggle(currentWorkspace.id, conversationId, message.id, emoji);
      onReactionUpdate?.(message.id, data);
    } catch (e) {
      console.error(e);
    }
  };

  // Group reactions by emoji
  const reactionGroups = (message.reactions || []).reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [], mine: false };
    acc[r.emoji].count++;
    acc[r.emoji].users.push(r.userName);
    if (r.userId === user?.id) acc[r.emoji].mine = true;
    return acc;
  }, {} as Record<string, { count: number; users: string[]; mine: boolean }>);

  const renderMedia = () => {
    if (!message.mediaUrl) return null;
    const type = message.mediaType || '';
    if (type.startsWith('image/') || message.type === 'image') {
      return (
        <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="block mb-2">
          <img src={message.mediaUrl} alt="media" className="max-w-full rounded-lg max-h-48 object-cover" />
        </a>
      );
    }
    if (type.startsWith('audio/') || message.type === 'audio') {
      return <audio controls src={message.mediaUrl} className="w-full mb-2 max-w-xs" />;
    }
    if (type.startsWith('video/') || message.type === 'video') {
      return <video controls src={message.mediaUrl} className="w-full rounded-lg mb-2 max-h-48" />;
    }
    return (
      <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 mb-2 text-xs underline opacity-80">
        📎 {message.content || 'Attachment'}
      </a>
    );
  };

  if (isNote) {
    return (
      <div className="flex flex-col items-center mb-3">
        {showDate && (
          <div className="text-xs text-gray-400 text-center w-full mb-3 mt-2">
            {format(new Date(message.createdAt), 'EEEE, MMMM d')}
          </div>
        )}
        <div className="w-full max-w-[75%] mx-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <LockClosedIcon className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Internal Note</span>
              {message.senderName && <span className="text-[10px] text-amber-500">· {message.senderName}</span>}
            </div>
            <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap break-words">{message.content}</p>
            <p className="text-[10px] text-amber-400 mt-1.5 text-right">{time}</p>
          </div>
        </div>
      </div>
    );
  }

  const isSending = message.status === 'sending';
  const isFailed  = message.status === 'failed';

  return (
    <div className={`flex flex-col ${isOut ? 'items-end' : 'items-start'} mb-1`}>
      {showDate && (
        <div className="text-xs text-gray-400 text-center w-full mb-3 mt-2">
          {format(new Date(message.createdAt), 'EEEE, MMMM d')}
        </div>
      )}
      <div className={`group relative flex items-end gap-2 max-w-[75%] ${isOut ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`${isOut ? 'message-bubble-out' : 'message-bubble-in'} ${isFailed ? 'opacity-70 ring-2 ring-red-400/40' : ''} ${isSending ? 'opacity-60' : ''}`}>
          {!isOut && message.senderName && (
            <p className="text-xs font-semibold text-primary-600 mb-0.5">{message.senderName}</p>
          )}
          {message.isAiReply && (
            <div className="flex items-center gap-1 mb-1">
              <SparklesIcon className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] text-purple-400 font-medium">AI Reply</span>
            </div>
          )}
          {renderMedia()}
          {message.content && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
          )}
          <div className={`flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] opacity-70">{isSending ? '' : time}</span>
            {isOut && (
              isSending ? (
                <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
              ) : isFailed ? (
                <span className="text-[10px] text-red-400 font-medium">✗ Failed</span>
              ) : (
                <span className={`text-[10px] ${STATUS_TEXT[message.status]?.color || 'opacity-60'}`}>
                  {STATUS_TEXT[message.status]?.icon || '✓'}
                </span>
              )
            )}
          </div>
        </div>

        {/* Reaction button on hover */}
        <div className={`opacity-0 group-hover:opacity-100 transition-opacity relative ${isOut ? 'mr-1' : 'ml-1'}`}>
          <button
            onClick={() => setShowPicker(v => !v)}
            className="p-1 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-500"
          >
            <FaceSmileIcon className="w-3.5 h-3.5" />
          </button>
          {showPicker && (
            <div className={`absolute bottom-8 ${isOut ? 'right-0' : 'left-0'} bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 flex gap-1 z-10`}>
              {QUICK_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="text-lg hover:scale-125 transition-transform p-0.5"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reaction chips */}
      {Object.keys(reactionGroups).length > 0 && (
        <div className={`flex gap-1 mt-1 flex-wrap ${isOut ? 'justify-end' : 'justify-start'} max-w-[75%]`}>
          {Object.entries(reactionGroups).map(([emoji, data]) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              title={data.users.join(', ')}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                data.mine
                  ? 'bg-primary-100 border-primary-300 text-primary-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {emoji} {data.count > 1 ? data.count : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
