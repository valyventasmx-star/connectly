import { useState, useEffect } from 'react';
import { Conversation } from '../../types';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import {
  PhoneIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  CheckIcon,
  ArrowPathIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import api, { conversationsApi } from '../../api/client';
import { useWorkspaceStore } from '../../store/workspace';
import { formatDistanceToNow } from 'date-fns';

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

export default function ContactPanel({ conversation }: Props) {
  const { currentWorkspace, updateConversation } = useWorkspaceStore();
  const [updating, setUpdating] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string; avatar?: string }[]>([]);
  const [lifecycleStage, setLifecycleStage] = useState<string>(
    (conversation.contact as any).lifecycleStage || 'new_lead'
  );
  const { contact, channel, assignee } = conversation;

  useEffect(() => {
    if (!currentWorkspace) return;
    api.get(`/workspaces/${currentWorkspace.id}`).then(({ data }) => {
      setMembers(data.members?.map((m: any) => ({ id: m.user.id, name: m.user.name, avatar: m.user.avatar })) || []);
    }).catch(console.error);
  }, [currentWorkspace]);

  useEffect(() => {
    setLifecycleStage((conversation.contact as any).lifecycleStage || 'new_lead');
  }, [conversation.contact.id]);

  const updateStatus = async (status: string) => {
    if (!currentWorkspace) return;
    setUpdating(true);
    try {
      const { data } = await conversationsApi.update(currentWorkspace.id, conversation.id, { status });
      updateConversation(data);
    } finally {
      setUpdating(false);
    }
  };

  const updateAssignee = async (assigneeId: string | null) => {
    if (!currentWorkspace) return;
    const { data } = await conversationsApi.update(currentWorkspace.id, conversation.id, { assigneeId });
    updateConversation(data);
  };

  const updateLifecycle = async (stage: string) => {
    if (!currentWorkspace) return;
    setLifecycleStage(stage);
    try {
      await api.patch(`/workspaces/${currentWorkspace.id}/contacts/${contact.id}`, { lifecycleStage: stage });
    } catch (e) {
      console.error(e);
    }
  };

  const channelTypeColor: Record<string, string> = {
    whatsapp: 'bg-green-100 text-green-700',
    messenger: 'bg-blue-100 text-blue-700',
    instagram: 'bg-pink-100 text-pink-700',
  };

  const currentStage = LIFECYCLE_STAGES.find(s => s.value === lifecycleStage);

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
    </div>
  );
}
