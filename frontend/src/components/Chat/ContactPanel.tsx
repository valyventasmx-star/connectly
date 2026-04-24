import { useState, useEffect } from 'react';
import { Conversation, ContactActivity } from '../../types';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import {
  PhoneIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  CheckIcon,
  ArrowPathIcon,
  TagIcon,
  ClockIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import api, { conversationsApi, tagsApi, contactActivityApi } from '../../api/client';
import { useWorkspaceStore } from '../../store/workspace';
import { formatDistanceToNow, format } from 'date-fns';

interface Props {
  conversation: Conversation;
}

const LIFECYCLE_STAGES = [
  { value: 'new_lead', label: '🆕 New Lead', color: 'text-blue-600' },
  { value: 'hot_lead', label: '🔥 Hot Lead', color: 'text-orange-600' },
  { value: 'payment', label: '💳 Payment', color: 'text-yellow-600' },
  { value: 'customer', label: '🏆 Customer', color: 'text-green-600' },
  { value: 'cold_lead', label: '❄️ Cold Lead', color: 'text-gray-500' },
];

const ACTIVITY_ICONS: Record<string, string> = {
  message_sent: '📤',
  message_received: '📥',
  status_changed: '🔄',
  note_added: '📝',
  tag_added: '🏷️',
  lifecycle_changed: '📊',
  assigned: '👤',
};

export default function ContactPanel({ conversation }: Props) {
  const { currentWorkspace, updateConversation } = useWorkspaceStore();
  const [updating, setUpdating] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string; avatar?: string }[]>([]);
  const [lifecycleStage, setLifecycleStage] = useState<string>(
    (conversation.contact as any).lifecycleStage || 'new_lead'
  );
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Conversation tags state
  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [updatingTags, setUpdatingTags] = useState(false);

  const { contact, channel, assignee } = conversation;

  useEffect(() => {
    if (!currentWorkspace) return;
    api.get(`/workspaces/${currentWorkspace.id}`).then(({ data }) => {
      setMembers(data.members?.map((m: any) => ({ id: m.user.id, name: m.user.name, avatar: m.user.avatar })) || []);
    }).catch(console.error);

    tagsApi.list(currentWorkspace.id).then(({ data }) => {
      setAllTags(data);
    }).catch(console.error);
  }, [currentWorkspace]);

  useEffect(() => {
    setLifecycleStage((conversation.contact as any).lifecycleStage || 'new_lead');
  }, [conversation.contact.id]);

  const loadActivity = async () => {
    if (!currentWorkspace) return;
    setLoadingActivity(true);
    try {
      const { data } = await contactActivityApi.list(currentWorkspace.id, contact.id);
      setActivities(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingActivity(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'activity') loadActivity();
  }, [activeTab, contact.id]);

  const updateStatus = async (status: string) => {
    if (!currentWorkspace) return;
    setUpdating(true);
    try {
      const { data } = await conversationsApi.update(currentWorkspace.id, conversation.id, { status });
      updateConversation(data);
      // Log activity
      await contactActivityApi.add(currentWorkspace.id, contact.id, {
        type: 'status_changed',
        description: `Conversation status changed to ${status}`,
      });
    } finally {
      setUpdating(false);
    }
  };

  const updateAssignee = async (assigneeId: string | null) => {
    if (!currentWorkspace) return;
    const { data } = await conversationsApi.update(currentWorkspace.id, conversation.id, { assigneeId });
    updateConversation(data);
    const member = members.find(m => m.id === assigneeId);
    if (assigneeId && member) {
      await contactActivityApi.add(currentWorkspace.id, contact.id, {
        type: 'assigned',
        description: `Conversation assigned to ${member.name}`,
      }).catch(() => {});
    }
  };

  const updateLifecycle = async (stage: string) => {
    if (!currentWorkspace) return;
    const prevStage = lifecycleStage;
    setLifecycleStage(stage);
    try {
      await api.patch(`/workspaces/${currentWorkspace.id}/contacts/${contact.id}`, { lifecycleStage: stage });
      const prev = LIFECYCLE_STAGES.find(s => s.value === prevStage)?.label || prevStage;
      const next = LIFECYCLE_STAGES.find(s => s.value === stage)?.label || stage;
      await contactActivityApi.add(currentWorkspace.id, contact.id, {
        type: 'lifecycle_changed',
        description: `Lifecycle stage changed from ${prev} to ${next}`,
      }).catch(() => {});
    } catch (e) {
      console.error(e);
    }
  };

  const addNote = async () => {
    if (!currentWorkspace || !newNote.trim()) return;
    setAddingNote(true);
    try {
      await contactActivityApi.add(currentWorkspace.id, contact.id, {
        type: 'note_added',
        description: newNote.trim(),
      });
      setNewNote('');
      loadActivity();
    } finally {
      setAddingNote(false);
    }
  };

  // Conversation tag management
  const currentTagIds = conversation.conversationTags?.map(ct => ct.tag.id) || [];

  const toggleTag = async (tagId: string) => {
    if (!currentWorkspace) return;
    setUpdatingTags(true);
    const newTagIds = currentTagIds.includes(tagId)
      ? currentTagIds.filter(id => id !== tagId)
      : [...currentTagIds, tagId];
    try {
      const { data } = await conversationsApi.update(currentWorkspace.id, conversation.id, { tagIds: newTagIds });
      updateConversation(data);
    } finally {
      setUpdatingTags(false);
    }
  };

  const channelTypeColor: Record<string, string> = {
    whatsapp: 'bg-green-100 text-green-700',
    messenger: 'bg-blue-100 text-blue-700',
    instagram: 'bg-pink-100 text-pink-700',
  };

  return (
    <div className="w-72 flex-shrink-0 border-l border-gray-100 bg-white overflow-y-auto">
      {/* Contact info */}
      <div className="p-5 text-center border-b border-gray-100">
        <Avatar name={contact.name} size="xl" className="mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900 text-base">{contact.name}</h3>
        {contact.company && <p className="text-sm text-gray-500 mt-0.5">{contact.company}</p>}
        {contact.contactTags && contact.contactTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center mt-2">
            {contact.contactTags.map(({ tag }) => (
              <Badge key={tag.id} label={tag.name} color={tag.color} />
            ))}
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'details' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Details
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'activity' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Activity
        </button>
      </div>

      {activeTab === 'details' ? (
        <>
          {/* Lifecycle stage */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Lifecycle Stage</p>
            <select
              value={lifecycleStage}
              onChange={e => updateLifecycle(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {LIFECYCLE_STAGES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Contact details */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact Details</p>
            <div className="space-y-2.5">
              {contact.phone && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <PhoneIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <EnvelopeIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{contact.email}</span>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <BuildingOfficeIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{contact.company}</span>
                </div>
              )}
            </div>
            {contact.notes && (
              <div className="mt-3 p-2.5 bg-yellow-50 rounded-lg text-xs text-gray-600 border border-yellow-100">
                {contact.notes}
              </div>
            )}
          </div>

          {/* Conversation Tags */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Conversation Tags</p>
              <button
                onClick={() => setShowTagPicker(!showTagPicker)}
                className="text-gray-400 hover:text-primary-600 transition-colors"
                title="Manage tags"
              >
                <TagIcon className="w-4 h-4" />
              </button>
            </div>
            {/* Current tags */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(conversation.conversationTags || []).length === 0 ? (
                <p className="text-xs text-gray-400">No tags</p>
              ) : (
                conversation.conversationTags!.map(({ tag }) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                    <button
                      onClick={() => toggleTag(tag.id)}
                      className="hover:opacity-70 transition-opacity"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            {/* Tag picker dropdown */}
            {showTagPicker && allTags.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden mt-2 bg-white shadow-sm">
                {allTags.map(tag => {
                  const active = currentTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      disabled={updatingTags}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
                        active ? 'bg-gray-50' : ''
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="flex-1 text-left text-gray-700">{tag.name}</span>
                      {active && <CheckIcon className="w-3.5 h-3.5 text-primary-600" />}
                    </button>
                  );
                })}
              </div>
            )}
            {showTagPicker && allTags.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">No tags created yet. Go to Settings → Tags.</p>
            )}
          </div>

          {/* Assignment */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Assigned To</p>
            <select
              value={conversation.assigneeId || ''}
              onChange={e => updateAssignee(e.target.value || null)}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Unassigned</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Conversation details */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Conversation</p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Status</span>
                <Badge label={conversation.status} variant="status" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Channel</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${channelTypeColor[channel?.type] || 'bg-gray-100 text-gray-600'}`}>
                  {channel?.name || channel?.type}
                </span>
              </div>
              {conversation.lastMessageAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Last message</span>
                  <span className="text-xs text-gray-600">
                    {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Actions</p>
            <div className="space-y-2">
              {conversation.status === 'open' && (
                <Button variant="secondary" size="sm" className="w-full justify-center"
                  icon={<CheckIcon className="w-4 h-4" />} onClick={() => updateStatus('resolved')} loading={updating}>
                  Resolve
                </Button>
              )}
              {conversation.status === 'resolved' && (
                <Button variant="secondary" size="sm" className="w-full justify-center"
                  icon={<ArrowPathIcon className="w-4 h-4" />} onClick={() => updateStatus('open')} loading={updating}>
                  Reopen
                </Button>
              )}
              {conversation.status !== 'pending' && (
                <Button variant="outline" size="sm" className="w-full justify-center"
                  onClick={() => updateStatus('pending')} loading={updating}>
                  Mark as Pending
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Activity Tab */
        <div className="flex flex-col h-full">
          {/* Add note */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Add Note</p>
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Write a note about this contact..."
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <Button
              size="sm"
              className="w-full justify-center mt-2"
              icon={<PlusIcon className="w-4 h-4" />}
              onClick={addNote}
              disabled={!newNote.trim()}
              loading={addingNote}
            >
              Add Note
            </Button>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">History</p>
            {loadingActivity ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8">
                <ClockIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No activity yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm">
                      {ACTIVITY_ICONS[activity.type] || '📋'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-relaxed">{activity.description}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {format(new Date(activity.createdAt), 'MMM d, yyyy · h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
