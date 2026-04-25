import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import { contactsApi } from '../api/client';

const STAGES = [
  { key: 'new_lead',   label: 'New Lead',   emoji: '🆕', color: 'border-blue-300 bg-blue-50',   badge: 'bg-blue-100 text-blue-700' },
  { key: 'hot_lead',   label: 'Hot Lead',   emoji: '🔥', color: 'border-orange-300 bg-orange-50', badge: 'bg-orange-100 text-orange-700' },
  { key: 'payment',    label: 'Payment',    emoji: '💳', color: 'border-yellow-300 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700' },
  { key: 'customer',   label: 'Customer',   emoji: '🏆', color: 'border-green-300 bg-green-50',  badge: 'bg-green-100 text-green-700' },
  { key: 'cold_lead',  label: 'Cold Lead',  emoji: '❄️', color: 'border-gray-200 bg-gray-50',   badge: 'bg-gray-100 text-gray-600' },
];

export default function Pipeline() {
  const { currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;
    contactsApi.list(currentWorkspace.id, { limit: 500 }).then(r => setContacts(r.data.contacts || r.data)).catch(console.error).finally(() => setLoading(false));
  }, [currentWorkspace]);

  const byStage = (stage: string) => contacts.filter(c => (c.lifecycleStage || 'new_lead') === stage);

  const handleDrop = async (stage: string, contactId: string) => {
    if (!currentWorkspace) return;
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, lifecycleStage: stage } : c));
    await contactsApi.update(currentWorkspace.id, contactId, { lifecycleStage: stage }).catch(console.error);
    setDragging(null);
  };

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500">Drag contacts between stages to update their lifecycle</p>
        </div>

        <div className="flex-1 overflow-x-auto p-6">
          {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
          ) : (
            <div className="flex gap-4 h-full min-w-max">
              {STAGES.map(stage => (
                <div
                  key={stage.key}
                  className={`w-64 flex flex-col rounded-2xl border-2 ${stage.color} flex-shrink-0`}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('contactId');
                    if (id) handleDrop(stage.key, id);
                  }}
                >
                  {/* Column header */}
                  <div className="p-3 border-b border-black/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{stage.emoji}</span>
                        <span className="text-sm font-semibold text-gray-800">{stage.label}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stage.badge}`}>
                        {byStage(stage.key).length}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {byStage(stage.key).map(contact => (
                      <div
                        key={contact.id}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData('contactId', contact.id); setDragging(contact.id); }}
                        onDragEnd={() => setDragging(null)}
                        onClick={() => navigate(`/contacts/${contact.id}`)}
                        className={`bg-white rounded-xl p-3 border border-gray-100 cursor-pointer hover:shadow-sm transition-all select-none ${dragging === contact.id ? 'opacity-50 rotate-1' : ''}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 flex-shrink-0">
                            {contact.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                        </div>
                        {contact.company && <p className="text-xs text-gray-500 truncate">{contact.company}</p>}
                        {contact.phone && <p className="text-xs text-gray-400 truncate">{contact.phone}</p>}
                      </div>
                    ))}
                    {byStage(stage.key).length === 0 && (
                      <div className="text-center py-8 text-xs text-gray-400">Drop contacts here</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
