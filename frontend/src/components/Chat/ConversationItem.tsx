import { formatDistanceToNow } from 'date-fns';
import { Conversation } from '../../types';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';

interface Props {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: '💬',
  messenger: '📘',
  instagram: '📸',
};

export default function ConversationItem({ conversation, active, onClick }: Props) {
  const lastMsg = conversation.messages?.[0];
  const time = conversation.lastMessageAt
    ? formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: false })
    : '';
  const icon = CHANNEL_ICONS[conversation.channel?.type] || '💬';

  return (
    <div
      onClick={onClick}
      className={`conversation-item ${active ? 'active' : ''}`}
    >
      <Avatar name={conversation.contact.name} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {conversation.contact.name}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0">{time}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500 truncate flex-1">
            {lastMsg ? (
              <>
                {lastMsg.direction === 'outbound' && <span className="text-primary-500 font-medium mr-1">You: </span>}
                {lastMsg.content}
              </>
            ) : (
              <span className="text-gray-400 italic">No messages yet</span>
            )}
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span title={conversation.channel?.type}>{icon}</span>
            {conversation.unreadCount > 0 && (
              <span className="bg-primary-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
        {/* Tags */}
        {conversation.conversationTags && conversation.conversationTags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {conversation.conversationTags.slice(0, 2).map(({ tag }) => (
              <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
