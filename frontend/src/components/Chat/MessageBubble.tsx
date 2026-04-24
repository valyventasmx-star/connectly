import { Message } from '../../types';
import { format } from 'date-fns';
import { LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface Props {
  message: Message;
  showDate?: boolean;
}

const STATUS_ICONS: Record<string, string> = {
  sent: '✓',
  delivered: '✓✓',
  read: '✓✓',
  failed: '✗',
  pending: '⏳',
};

export default function MessageBubble({ message, showDate }: Props) {
  const isOut = message.direction === 'outbound';
  const isNote = message.isNote;
  const time = format(new Date(message.createdAt), 'HH:mm');

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
              {message.senderName && (
                <span className="text-[10px] text-amber-500">· {message.senderName}</span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap break-words">{message.content}</p>
            <p className="text-[10px] text-amber-400 mt-1.5 text-right">{time}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isOut ? 'items-end' : 'items-start'} mb-1`}>
      {showDate && (
        <div className="text-xs text-gray-400 text-center w-full mb-3 mt-2">
          {format(new Date(message.createdAt), 'EEEE, MMMM d')}
        </div>
      )}
      <div className={`group flex items-end gap-2 max-w-[75%] ${isOut ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={isOut ? 'message-bubble-out' : 'message-bubble-in'}>
          {!isOut && message.senderName && (
            <p className="text-xs font-semibold text-primary-600 mb-0.5">{message.senderName}</p>
          )}
          {message.isAiReply && (
            <div className="flex items-center gap-1 mb-1">
              <SparklesIcon className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] text-purple-400 font-medium">AI Reply</span>
            </div>
          )}
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
          <div className={`flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] opacity-70">{time}</span>
            {isOut && (
              <span className={`text-[10px] ${message.status === 'read' ? 'text-blue-300' : 'opacity-70'}`}>
                {STATUS_ICONS[message.status] || '✓'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
