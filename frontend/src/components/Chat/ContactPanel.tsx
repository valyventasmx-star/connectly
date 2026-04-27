import { useState, useEffect } from 'react';
import { Conversation, ContactActivity, CustomField, CustomFieldValue } from '../../types';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import {
  PhoneIcon, EnvelopeIcon, BuildingOfficeIcon,
  CheckIcon, ArrowPathIcon, TagIcon, ClockIcon,
  PlusIcon, XMarkIcon, BellSnoozeIcon,
} from '@heroicons/react/24/outline';
import api, { conversationsApi, tagsApi, contactActivityApi, customFieldsApi } from '../../api/client';
import { useWorkspaceStore } from '../../store/workspace';
import { formatDistanceToNow, format, addHours, addDays } from 'date-fns';

interface Props { conversation: Conversation; }

const LIFECYCLE_STAGES = [
  { value: 'new_lead', label: '🆕 New Lead' },
  { value: 'hot_lead', label: '🔥 Hot Lead' },
  { value: 'payment', label: '💳 Payment' },
  { value: 'customer', label: '🏆 Customer' },
  { value: 'cold_lead', label: '❄️ Cold Lead' },
];

const ACTIVITY_ICONS: Record<string, string> = {
  message_sent: '📤', message_received: '📥', status_changed: '🔄',
  note_added: '📝', tag_added: '🏷️', lifecycle_changed: '📊', assigned: '👤',
};

const SNOOZE_OPTIONS = [
  { label: '1 hour', getValue: () => addHours(new Date(), 1) },
  { label: '4 hours', getValue: () => addHours(new Date(), 4) },
  { label: 'Tomorrow', getValue: () => addDays(new Date(), 1) },
  { label: 'Next week', getValue: () => addDays(new Date(), 7) },
];

export default function ContactPanel({ conversation }: Props) {
  const { currentWorkspace, updateConversation } = useWorkspaceStore();
  const [updating, setUpdating] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [lifecycleStage, setLifecycleStage] = useState<string>(
    (conversation.contact as any).lifecycleStage || 'new_lead'
  );
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showSnoozePicker, setShowSnoozePicker] = useState(false);
  const [updatingTags, setUpdatingTags] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [savingField, setSavingField] = useState<string | null>(null);

  const { contact, channel } = conversation;

  useEffect(() => {
    if (!currentWorkspace) return;
    api.get(`/workspaces/${currentWorkspace.id}`).then(({ data }) => {
      setMembers(data.members?.map((m: any) => ({ id: m.user.id, name: m.user.name })) || []);
    }).catch(console.error);
    tagsApi.list(currentWorkspace.id).then(({ data }) => setAllTags(data)).catch(console.error);
    customFieldsApi.list(currentWorkspace.id).then(({ data }) => setCustomFields(data)).catch(console.error);
    customFieldsApi.getValues(currentWorkspace.id, contact.id).then(({ data }) => {
      const map: Record<string, string> = {};
      (data as CustomFieldValue[]).forEach(v => { map[v.fieldId] = v.value; });
      setFieldValues(map);
    }).catch(console.error);
  }, [currentWorkspace, contact.id]);

  useEffect(() => {
    setLifecycleStage((conversation.contact as any).lifecycleStage || 'new_lead');
  }, [conversation.contact.id]);

  const loadActivity = async () => {
    if (!currentWorkspace) return;
    setLoadingActivity(true);
    try {
      const { data } = await contactActivityApi.list(currentWorkspace.id, contact.id);
      setActivities(data);
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
      await contactActivityApi.add(currentWorkspace.id, contact.id, {
        type: 'status_changed', description: `Conversation status changed to ${status}`,
      }).catch(() => {});
    } finally { setUpdating(false); }
  };

  const updateAssignee = async (assigneeId: string | null) => {
    if (!currentWorkspace) return;
    const { data } = await conversationsApi.update(currentWorkspace.id, conversation.id, { assigneeId });
    updateConversation(data);
  };

  const updateLifecycle = async (stage: string) => {
    if (!currentWorkspace) return;
    const prev = LIFECYCLE_STAGES.find(s => s.value === lifecycleStage)?.label || lifecycleStage;
    const next = LIFECYCLE_STAGES.find(s => s.value === stage)?.label || stage;
    setLifecycleStage(stage);
    try {
      await api.patch(`/workspaces/${currentWorkspace.id}/contacts/${contact.id}`, { lifecycleStage: stage });
      await contactActivityApi.add(currentWorkspace.id, contact.id, {
        type: 'lifecycle_changed', description: `Lifecycle changed from ${prev} to ${next}`,
      }).catch(() => {});
    } catch (e) { console.error(e); }
  };

  const snooze = async (until: Date) => {
    if (!currentWorkspace) return;
    setShowSnoozePicker(false);
    const { data } = await conversationsApi.update(currentWorkspace.id, conversation.id, {
      snoozedUntil: until.toISOString(),
    });
    updateConversation(data);
  };

  const unsnooze = async () => {
    if (!currentWorkspace) return;
    const { data } = await conversationsApi.update(currentWorkspace.id, conversation.id, {
      snoozedUntil: null, status: 'open',
    });
    updateConversation(data);
  };

  const addNote = async () => {
    if (!currentWorkspace || !newNote.trim()) return;
    setAddingNote(true);
    try {
      await contactActivityApi.add(currentWorkspace.id, contact.id, {
        type: 'note_added', description: newNote.trim(),
      });
      setNewNote('');
      loadActivity();
    } finally { setAddingNote(false); }
  };

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
    } finally { setUpdatingTags(false); }
  };

  const saveFieldValue = async (fieldId: string, value: string) => {
    if (!currentWorkspace) return;
    setSavingField(fieldId);
    try {
      await customFieldsApi.setValue(currentWorkspace.id, contact.id, fieldId, value);
      setFieldValues(prev => ({ ...prev, [fieldId]: value }));
    } finally { setSavingField(null); }
  };

  const channelTypeColor: Record<string, string> = {
    whatsapp: 'bg-green-100 text-green-700',
    messenger: 'bg-blue-100 text-blue-700',
    instagram: 'bg-pink-100 text-pink-700',
  };

  const isSnoozed = conversation.snoozedUntil && new Date(conversation.snoozedUntil) > new Date();

  return (
    <div className="hidden md:block w-72 flex-shrink-0 border-l border-gray-100 bg-white overflow-y-auto">
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
        <button onClick={() => setActiveTab('details')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${activeTab === 'details' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'}`}>
          Details
        </button>
        <button onClick={() => setActiveTab('activity')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${activeTab === 'activity' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'}`}>
          Activity
        </button>
      </div>

      {activeTab === 'details' ? (
        <>
          {/* Lifecycle */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Lifecycle Stage</p>
            <select value={lifecycleStage} onChange={e => updateLifecycle(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
              {LIFECYCLE_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Contact details */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact Details</p>
            <div className="space-y-2.5">
              {contact.phone && <div className="flex items-center gap-2.5 text-sm text-gray-600"><PhoneIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />{contact.phone}</div>}
              {contact.email && <div className="flex items-center gap-2.5 text-sm text-gray-600"><EnvelopeIcon className="w-4 h-4 text-gray-400 flex-shrink-0" /><span className="truncate">{contact.email}</span></div>}
              {contact.company && <div className="flex items-center gap-2.5 text-sm text-gray-600"><BuildingOfficeIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />{contact.company}</div>}
            </div>
            {contact.notes && <div className="mt-3 p-2.5 bg-yellow-50 rounded-lg text-xs text-gray-600 border border-yellow-100">{contact.notes}</div>}
          </div>

          {/* Custom fields */}
          {customFields.length > 0 && (
            <div className="p-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Custom Fields</p>
              <div className="space-y-2">
                {customFields.map(field => (
                  <div key={field.id}>
                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{field.name}</label>
                    {field.type === 'select' ? (
                      <select
                        value={fieldValues[field.id] || ''}
                        onChange={e => saveFieldValue(field.id, e.target.value)}
                        className="w-full mt-0.5 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">— select —</option>
                        {JSON.parse(field.options || '[]').map((o: string) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        value={fieldValues[field.id] || ''}
                        onChange={e => setFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                        onBlur={e => saveFieldValue(field.id, e.target.value)}
                        className="w-full mt-0.5 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversation tags */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Conversation Tags</p>
              <button onClick={() => setShowTagPicker(!showTagPicker)} className="text-gray-400 hover:text-primary-600 transition-colors">
                <TagIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(conversation.conversationTags || []).length === 0
                ? <p className="text-xs text-gray-400">No tags</p>
                : conversation.conversationTags!.map(({ tag }) => (
                  <span key={tag.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: tag.color }}>
                    {tag.name}
                    <button onClick={() => toggleTag(tag.id)}><XMarkIcon className="w-3 h-3" /></button>
                  </span>
                ))}
            </div>
            {showTagPicker && (
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                {allTags.length === 0
                  ? <p className="text-xs text-gray-400 p-3">No tags yet</p>
                  : allTags.map(tag => {
                    const active = currentTagIds.includes(tag.id);
                    return (
                      <button key={tag.id} onClick={() => toggleTag(tag.id)} disabled={updatingTags}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${active ? 'bg-gray-50' : ''}`}>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1 text-left text-gray-700">{tag.name}</span>
                        {active && <CheckIcon className="w-3.5 h-3.5 text-primary-600" />}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Assignment */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Assigned To</p>
            <select value={conversation.assigneeId || ''} onChange={e => updateAssignee(e.target.value || null)}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Unassigned</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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
                  <span className="text-xs text-gray-600">{formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}</span>
                </div>
              )}
              {conversation.firstResponseAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">First response</span>
                  <span className="text-xs text-gray-600">{formatDistanceToNow(new Date(conversation.firstResponseAt), { addSuffix: true })}</span>
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

              {/* Snooze */}
              <div className="relative">
                {isSnoozed ? (
                  <Button variant="outline" size="sm" className="w-full justify-center text-yellow-600 border-yellow-200"
                    icon={<BellSnoozeIcon className="w-4 h-4" />} onClick={unsnooze}>
                    Unsnooze
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="w-full justify-center"
                      icon={<BellSnoozeIcon className="w-4 h-4" />} onClick={() => setShowSnoozePicker(v => !v)}>
                      Snooze
                    </Button>
                    {showSnoozePicker && (
                      <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-10">
                        {SNOOZE_OPTIONS.map(opt => (
                          <button key={opt.label} onClick={() => snooze(opt.getValue())}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col">
          {/* Add note */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Add Note</p>
            <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
              placeholder="Write a note about this contact..."
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
            <Button size="sm" className="w-full justify-center mt-2" icon={<PlusIcon className="w-4 h-4" />}
              onClick={addNote} disabled={!newNote.trim()} loading={addingNote}>
              Add Note
            </Button>
          </div>

          {/* Timeline */}
          <div className="p-4">
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
                {activities.map(activity => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm">
                      {ACTIVITY_ICONS[activity.type] || '📋'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-relaxed">{activity.description}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{format(new Date(activity.createdAt), 'MMM d · h:mm a')}</p>
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
