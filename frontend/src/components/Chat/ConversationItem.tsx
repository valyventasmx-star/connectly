import { formatDistanceToNow } from 'date-fns';
import { Conversation } from '../../types';
import Avatar from '../ui/Avatar';

// ── Sentiment analysis (keyword heuristic, no API call) ──────────────────────
const NEG_WORDS = [
  'angry','furious','terrible','awful','horrible','useless','cancel','refund',
  'scam','fraud','urgent','emergency','disappointed','frustrated','unacceptable',
  'ridiculous','worst','hate','never again','incompetent','waste','rip off',
  'lawsuit','demand','asap','immediately',
];
const POS_WORDS = [
  'thank','thanks','perfect','great','excellent','amazing','wonderful','love',
  'happy','pleased','satisfied','helpful','awesome','fantastic','appreciate',
  'brilliant','gracias','perfecto','😊','😃','❤️','👍','🙏',
];

function getSentiment(text: string | null | undefined): 'negative' | 'positive' | 'neutral' {
  if (!text) return 'neutral';
  const lower = text.toLowerCase();
  const exclamations = (text.match(/!/g) || []).length;
  const capsRatio = (text.match(/[A-Z]/g) || []).length / Math.max(text.length, 1);
  const neg = NEG_WORDS.filter(w => lower.includes(w)).length
    + (exclamations > 2 ? 1 : 0)
    + (capsRatio > 0.4 ? 1 : 0);
  const pos = POS_WORDS.filter(w => lower.includes(w)).length;
  if (neg > pos && neg > 0) return 'negative';
  if (pos > neg && pos > 0) return 'positive';
  return 'neutral';
}

function SentimentBadge({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  const s = getSentiment(text);
  if (s === 'neutral') return null;
  return (
    <span
      className="flex-shrink-0 text-sm leading-none"
      title={s === 'negative' ? 'Customer seems frustrated' : 'Customer seems happy'}
    >
      {s === 'negative' ? '😠' : '😊'}
    </span>
  );
}

// ── Urgency badge (from AI triage) ───────────────────────────────────────────
const URGENCY_CONFIG: Record<number, { dot: string; label: string; className: string }> = {
  1: { dot: '🔴', label: 'Critical', className: 'bg-red-100 text-red-700' },
  2: { dot: '🟠', label: 'High',     className: 'bg-orange-100 text-orange-700' },
  3: { dot: '🟡', label: 'Medium',   className: 'bg-yellow-100 text-yellow-700' },
  4: { dot: '🟢', label: 'Low',      className: 'bg-blue-100 text-blue-600' },
  5: { dot: '⚪', label: 'Info',     className: 'bg-gray-100 text-gray-500' },
};

function UrgencyBadge({ score, reason }: { score: number; reason?: string }) {
  const cfg = URGENCY_CONFIG[score];
  if (!cfg) return null;
  return (
    <span
      title={reason || cfg.label}
      className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${cfg.className}`}
    >
      {cfg.dot} {cfg.label}
    </span>
  );
}

// ── SLA timer ────────────────────────────────────────────────────────────────
function SlaIndicator({ slaDueAt, status }: { slaDueAt?: string; status: string }) {
  if (!slaDueAt || status !== 'open') return null;
  const due = new Date(slaDueAt);
  const diffMs = due.getTime() - Date.now();
  const isOverdue = diffMs < 0;
  const hours = Math.abs(Math.floor(diffMs / 3600000));
  const mins = Math.abs(Math.floor((diffMs % 3600000) / 60000));
  const label = isOverdue
    ? `${hours > 0 ? hours + 'h ' : ''}${mins}m overdue`
    : `${hours > 0 ? hours + 'h ' : ''}${mins}m left`;
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
      isOverdue ? 'bg-red-100 text-red-600' :
      diffMs < 3600000 ? 'bg-orange-100 text-orange-600' :
      'bg-gray-100 text-gray-500'
    }`}>
      ⏱ {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export interface TriageInfo {
  urgencyScore: number;
  reason: string;
}

interface Props {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
  triageInfo?: TriageInfo;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
}

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: '💬',
  messenger: '📘',
  instagram: '📸',
  email: '📧',
  sms: '💬',
  telegram: '✈️',
};

export default function ConversationItem({ conversation, active, onClick, triageInfo, selected, onSelect }: Props) {
  const lastMsg = conversation.messages?.[0];
  const lastInbound = conversation.messages?.find(m => m.direction === 'inbound');
  const time = conversation.lastMessageAt
    ? formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: false })
    : '';
  const icon = CHANNEL_ICONS[conversation.channel?.type] || '💬';

  return (
    <div
      onClick={onSelect ? undefined : onClick}
      className={`conversation-item ${active ? 'active' : ''} ${selected ? 'bg-primary-50' : ''}`}
    >
      {onSelect ? (
        <input
          type="checkbox"
          checked={selected || false}
          onChange={e => { e.stopPropagation(); onSelect(conversation.id, e.target.checked); }}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 rounded border-gray-300 text-primary-600 flex-shrink-0 cursor-pointer"
        />
      ) : (
        <Avatar name={conversation.contact.name} size="md" />
      )}
      <div className="flex-1 min-w-0">
        {/* Row 1: name + time + sentiment */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {conversation.contact.name}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {lastInbound && <SentimentBadge text={lastInbound.content} />}
            <span className="text-xs text-gray-400">{time}</span>
          </div>
        </div>

        {/* Row 2: last message + channel + unread */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500 truncate flex-1">
            {lastMsg ? (
              <>
                {lastMsg.direction === 'outbound' && (
                  <span className="text-primary-500 font-medium mr-1">You: </span>
                )}
                {lastMsg.content || '📎 Attachment'}
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

        {/* Row 3: SLA + urgency + tags */}
        <div className="flex gap-1 mt-1 flex-wrap items-center">
          <SlaIndicator slaDueAt={(conversation as any).slaDueAt} status={conversation.status} />
          {triageInfo && (
            <UrgencyBadge score={triageInfo.urgencyScore} reason={triageInfo.reason} />
          )}
          {conversation.conversationTags && conversation.conversationTags.length > 0 &&
            conversation.conversationTags.slice(0, 2).map(({ tag }) => (
              <span
                key={tag.id}
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: tag.color + '20', color: tag.color }}
              >
                {tag.name}
              </span>
            ))
          }
        </div>
      </div>
    </div>
  );
}
