import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import { contactsApi, conversationsApi, contactActivityApi } from '../api/client';
import { formatDistanceToNow, format } from 'date-fns';
import { ArrowLeftIcon, ChatBubbleLeftIcon, PhoneIcon, EnvelopeIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';

const LIFECYCLE_COLORS: Record<string, string> = {
  new_lead: 'bg-blue-100 text-blue-700',
  hot_lead: 'bg-orange-100 text-orange-700',
  payment: 'bg-yellow-100 text-yellow-700',
  customer: 'bg-green-100 text-green-700',
  cold_lead: 'bg-gray-100 text-gray-600',
};

export default function ContactDetail() {
  const { contactId } = useParams<{ contactId: string }>();
  const { currentWorkspace, setActiveConversation } = useWorkspaceStore();
  const navigate = useNavigate();
  const [contact, setContact] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'conversations' | 'activity'>('conversations');

  useEffect(() => {
    if (!currentWorkspace || !contactId) return;
    setLoading(true);
    Promise.all([
      contactsApi.get(currentWorkspace.id, contactId),
      conversationsApi.list(currentWorkspace.id, { contactId }),
      contactActivityApi.list(currentWorkspace.id, contactId),
    ])
      .then(([cRes, convRes, actRes]) => {
        setContact(cRes.data);
        setConversations(convRes.data.conversations || []);
        setActivities(actRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentWorkspace, contactId]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  if (!contact) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full text-gray-500">Contact not found</div>
      </AppLayout>
    );
  }

  const lcClass = LIFECYCLE_COLORS[contact.lifecycleStage || ''] || 'bg-gray-100 text-gray-600';

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center gap-4">
          <button
            onClick={() => navigate('/contacts')}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <Avatar name={contact.name} src={contact.avatar} size="lg" />
            <div>
              <h1 className="text-base font-semibold text-gray-900">{contact.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lcClass}`}>
                {contact.lifecycleStage?.replace('_', ' ') || 'No stage'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Contact info */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact Info</h3>
                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <PhoneIcon className="w-4 h-4 text-gray-400" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                    <span>{contact.email}</span>
                  </div>
                )}
                {contact.company && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <BuildingOfficeIcon className="w-4 h-4 text-gray-400" />
                    <span>{contact.company}</span>
                  </div>
                )}
                {contact.notes && (
                  <div className="pt-2 border-t border-gray-50">
                    <p className="text-xs text-gray-500 mb-1">Notes</p>
                    <p className="text-sm text-gray-700">{contact.notes}</p>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-50">
                  <p className="text-xs text-gray-400">
                    Created {format(new Date(contact.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>

              {/* Tags */}
              {contact.contactTags?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {contact.contactTags.map(({ tag }: any) => (
                      <span key={tag.id} className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Stats</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{conversations.length}</p>
                    <p className="text-xs text-gray-500">Conversations</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">
                      {conversations.filter(c => c.status === 'resolved').length}
                    </p>
                    <p className="text-xs text-gray-500">Resolved</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Conversations + Activity */}
            <div className="lg:col-span-2">
              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-4">
                {(['conversations', 'activity'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {t}
                  </button>
                ))}
              </div>

              {tab === 'conversations' && (
                <div className="space-y-3">
                  {conversations.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
                      No conversations yet
                    </div>
                  ) : (
                    conversations.map(conv => {
                      const lastMsg = conv.messages?.[0];
                      return (
                        <div
                          key={conv.id}
                          className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-primary-200 cursor-pointer transition-colors"
                          onClick={() => { setActiveConversation(conv); navigate('/inbox'); }}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <ChatBubbleLeftIcon className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-900">{conv.channel?.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                conv.status === 'open' ? 'bg-blue-50 text-blue-600' :
                                conv.status === 'resolved' ? 'bg-green-50 text-green-600' :
                                'bg-gray-100 text-gray-500'
                              }`}>{conv.status}</span>
                            </div>
                            <span className="text-xs text-gray-400">
                              {conv.lastMessageAt ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true }) : ''}
                            </span>
                          </div>
                          {lastMsg && (
                            <p className="text-xs text-gray-500 line-clamp-2">{lastMsg.content}</p>
                          )}
                          {conv.assignee && (
                            <p className="text-xs text-gray-400 mt-2">Assigned to {conv.assignee.name}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {tab === 'activity' && (
                <div className="space-y-3">
                  {activities.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
                      No activity yet
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                      {activities.map((a: any) => (
                        <div key={a.id} className="flex gap-3 px-5 py-4">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-2 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700">{a.description}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {format(new Date(a.createdAt), 'MMM d, yyyy · h:mm a')}
                            </p>
                          </div>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full h-fit flex-shrink-0">{a.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
