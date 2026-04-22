import { Message } from '../../types';
import { format } from 'date-fns';
import { CheckIcon } from '@heroicons/react/24/outline';

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
  const time = format(new Date(message.createdAt), 'HH:mm');

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
