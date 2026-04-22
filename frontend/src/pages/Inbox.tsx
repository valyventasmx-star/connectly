import { useState } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import ConversationList from '../components/Chat/ConversationList';
import ChatArea from '../components/Chat/ChatArea';
import { useWorkspaceStore } from '../store/workspace';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { channelsApi, contactsApi, conversationsApi } from '../api/client';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import EmptyState from '../components/ui/EmptyState';

export default function Inbox() {
  const { activeConversation, currentWorkspace } = useWorkspaceStore();
  const [showNewConv, setShowNewConv] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [selectedContact, setSelectedContact] = useState('');
  const [creating, setCreating] = useState(false);
  const { addConversation, setActiveConversation } = useWorkspaceStore();

  const openNewConv = async () => {
    if (!currentWorkspace) return;
    const [chRes, coRes] = await Promise.all([
      channelsApi.list(currentWorkspace.id),
      contactsApi.list(currentWorkspace.id, { limit: 100 }),
    ]);
    setChannels(chRes.data);
    setContacts(coRes.data.contacts);
    setSelectedChannel('');
    setSelectedContact('');
    setShowNewConv(true);
  };

  const handleCreate = async () => {
    if (!currentWorkspace || !selectedChannel || !selectedContact) return;
    setCreating(true);
    try {
      const { data } = await conversationsApi.create(currentWorkspace.id, {
        contactId: selectedContact,
        channelId: selectedChannel,
      });
      addConversation(data);
      setActiveConversation(data);
      setShowNewConv(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create conversation');
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-1 overflow-hidden">
        <ConversationList onNewConversation={openNewConv} />
        <div className="flex-1 overflow-hidden flex">
          {activeConversation ? (
            <ChatArea conversation={activeConversation} />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <EmptyState
                icon={<ChatBubbleLeftRightIcon className="w-10 h-10" />}
                title="Select a conversation"
                description="Choose a conversation from the list to start messaging, or create a new one."
                action={
                  <Button onClick={openNewConv} icon={<span>+</span>}>
                    New Conversation
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </div>

      <Modal
        open={showNewConv}
        onClose={() => setShowNewConv(false)}
        title="New Conversation"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowNewConv(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating} disabled={!selectedChannel || !selectedContact}>
              Start Conversation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Contact</label>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={selectedContact}
              onChange={(e) => setSelectedContact(e.target.value)}
            >
              <option value="">Choose a contact...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Channel</label>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
            >
              <option value="">Choose a channel...</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name} ({ch.status})</option>
              ))}
            </select>
          </div>
          {channels.length === 0 && (
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
              No channels configured yet. Go to <strong>Channels</strong> to add your first WhatsApp number.
            </p>
          )}
          {contacts.length === 0 && (
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
              No contacts yet. Go to <strong>Contacts</strong> to add contacts first.
            </p>
          )}
        </div>
      </Modal>
    </AppLayout>
  );
}
