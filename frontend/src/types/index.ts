export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
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
  workspaceId: string;
  createdAt: string;
  contactTags?: { tag: Tag }[];
  _count?: { conversations: number };
}

export interface Message {
  id: string;
  content: string;
  type: string;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  waMessageId?: string;
  conversationId: string;
  senderId?: string;
  senderName?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  status: 'open' | 'resolved' | 'pending';
  contactId: string;
  channelId: string;
  workspaceId: string;
  assigneeId?: string;
  lastMessageAt?: string;
  unreadCount: number;
  createdAt: string;
  contact: Contact;
  channel: Channel;
  assignee?: Pick<User, 'id' | 'name' | 'avatar'>;
  messages?: Message[];
  conversationTags?: { tag: Tag }[];
}
