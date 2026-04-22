import { create } from 'zustand';
import { Workspace, Channel, Conversation, Contact } from '../types';

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  channels: Channel[];
  conversations: Conversation[];
  contacts: Contact[];
  activeConversation: Conversation | null;

  setWorkspaces: (ws: Workspace[]) => void;
  setCurrentWorkspace: (ws: Workspace | null) => void;
  addWorkspace: (ws: Workspace) => void;
  updateWorkspace: (ws: Workspace) => void;
  removeWorkspace: (id: string) => void;

  setChannels: (channels: Channel[]) => void;
  addChannel: (channel: Channel) => void;
  updateChannel: (channel: Channel) => void;
  removeChannel: (id: string) => void;

  setConversations: (convs: Conversation[]) => void;
  addConversation: (conv: Conversation) => void;
  updateConversation: (conv: Partial<Conversation> & { id: string }) => void;
  setActiveConversation: (conv: Conversation | null) => void;

  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  updateContact: (contact: Contact) => void;
  removeContact: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  currentWorkspace: null,
  channels: [],
  conversations: [],
  contacts: [],
  activeConversation: null,

  setWorkspaces: (workspaces) => set({ workspaces }),
  setCurrentWorkspace: (currentWorkspace) => set({ currentWorkspace }),
  addWorkspace: (ws) => set((s) => ({ workspaces: [...s.workspaces, ws] })),
  updateWorkspace: (ws) =>
    set((s) => ({ workspaces: s.workspaces.map((w) => (w.id === ws.id ? ws : w)) })),
  removeWorkspace: (id) =>
    set((s) => ({ workspaces: s.workspaces.filter((w) => w.id !== id) })),

  setChannels: (channels) => set({ channels }),
  addChannel: (channel) => set((s) => ({ channels: [...s.channels, channel] })),
  updateChannel: (channel) =>
    set((s) => ({ channels: s.channels.map((c) => (c.id === channel.id ? channel : c)) })),
  removeChannel: (id) => set((s) => ({ channels: s.channels.filter((c) => c.id !== id) })),

  setConversations: (conversations) => set({ conversations }),
  addConversation: (conv) =>
    set((s) => {
      const exists = s.conversations.find((c) => c.id === conv.id);
      if (exists) return { conversations: s.conversations.map((c) => (c.id === conv.id ? conv : c)) };
      return { conversations: [conv, ...s.conversations] };
    }),
  updateConversation: (updates) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === updates.id ? { ...c, ...updates } : c
      ),
      activeConversation:
        s.activeConversation?.id === updates.id
          ? { ...s.activeConversation, ...updates }
          : s.activeConversation,
    })),
  setActiveConversation: (activeConversation) => set({ activeConversation }),

  setContacts: (contacts) => set({ contacts }),
  addContact: (contact) => set((s) => ({ contacts: [contact, ...s.contacts] })),
  updateContact: (contact) =>
    set((s) => ({ contacts: s.contacts.map((c) => (c.id === contact.id ? contact : c)) })),
  removeContact: (id) => set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),
}));
