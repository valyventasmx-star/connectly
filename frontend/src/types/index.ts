export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isAdmin?: boolean;
  createdAt?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatar?: string;
  plan: string;
  timezone: string;
  role?: string;
  aiEnabled?: boolean;
  slaHours?: number;
  stripeSubscriptionId?: string;
  createdAt: string;
  _count?: { channels: number; contacts: number; conversations: number; members?: number };
}

export interface Channel {
  id: string;
  name: string;
  type: string;
  phoneNumber?: string;
  phoneNumberId?: string;
  wabaId?: string;
  accessToken?: string;
  webhookVerifyToken?: string;
  status: 'pending' | 'connected' | 'error';
  workspaceId: string;
  createdAt: string;
  _count?: { conversations: number };
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  workspaceId: string;
}

export interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;
  company?: string;
  notes?: string;
  lifecycleStage?: string;
  workspaceId: string;
  createdAt: string;
  contactTags?: { tag: Tag }[];
  _count?: { conversations: number };
}

export interface MessageReaction {
  id: string;
  emoji: string;
  messageId: string;
  userId: string;
  userName: string;
}

export interface Message {
  id: string;
  content: string;
  type: string;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  waMessageId?: string;
  mediaUrl?: string;
  mediaType?: string;
  isNote?: boolean;
  isAiReply?: boolean;
  conversationId: string;
  senderId?: string;
  senderName?: string;
  createdAt: string;
  reactions?: MessageReaction[];
}

export interface Conversation {
  id: string;
  status: 'open' | 'resolved' | 'pending';
  contactId: string;
  channelId: string;
  workspaceId: string;
  assigneeId?: string;
  lastMessageAt?: string;
  firstResponseAt?: string;
  snoozedUntil?: string;
  slaDueAt?: string;
  csatScore?: number;
  csatSentAt?: string;
  unreadCount: number;
  createdAt: string;
  contact: Contact;
  channel: Channel;
  assignee?: Pick<User, 'id' | 'name' | 'avatar'>;
  messages?: Message[];
  conversationTags?: { tag: Tag }[];
}

export interface InboxView {
  id: string;
  name: string;
  filters: string;
  workspaceId: string;
  userId: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  metadata?: string;
  workspaceId: string;
  createdAt: string;
}

export interface CsatResponse {
  id: string;
  score: number;
  comment?: string;
  conversationId: string;
  contactId: string;
  workspaceId: string;
  createdAt: string;
}

export interface SavedResponse {
  id: string;
  title: string;
  content: string;
  category?: string;
  workspaceId: string;
  createdAt: string;
}

export interface ContactActivity {
  id: string;
  type: string;
  description: string;
  metadata?: string;
  contactId: string;
  createdAt: string;
}

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string;
  workspaceId: string;
}

export interface CustomFieldValue {
  id: string;
  value: string;
  contactId: string;
  fieldId: string;
  field: CustomField;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  language: string;
  category: string;
  status: string;
  workspaceId: string;
  channelId?: string;
  createdAt: string;
}

export interface OutboundWebhook {
  id: string;
  name: string;
  url: string;
  events: string;
  active: boolean;
  secret?: string;
  workspaceId: string;
  createdAt: string;
}
