import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import api from '../api/client';
import { MegaphoneIcon, PaperAirplaneIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

interface Broadcast {
  id: string;
  name: string;
  message: string;
  variantMessage?: string;
  variantSentCount?: number;
  variantFailedCount?: number;
  status: string;
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  sentAt?: string;
}

const statusColor: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const LIFECYCLE_STAGES = [
  { value: '', label: 'All contacts' },
  { value: 'new_lead', label: 'New Lead' },
  { value: 'hot_lead', label: 'Hot Lead' },
  { value: 'payment', label: 'Payment' },
  { value: 'customer', label: 'Customer' },
];

export default function Broadcasts() {
  const { currentWorkspace, channels } = useWorkspaceStore();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', message: '', variantMessage: '', channelId: '', lifecycleStage: '' });
  const [abEnabled, setAbEnabled] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    api.get(`/workspaces/${currentWorkspace.id}/broadcasts`)
      .then(({ data }) => setBroadcasts(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentWorkspace]);

  const handleCreate = async () => {
    if (!currentWorkspace || !form.name || !form.message) return;
    setCreating(true);
    try {
      const { data } = await api.post(`/workspaces/${currentWorkspace.id}/broadcasts`, {
        name: form.name,
        message: form.message,
        channelId: form.channelId || undefined,
        variantMessage: abEnabled && form.variantMessage ? form.variantMessage : undefined,
      });
      setBroadcasts(prev => [data, ...prev]);
      setForm({ name: '', message: '', variantMessage: '', channelId: '', lifecycleStage: '' });
      setAbEnabled(false);
      setShowNew(false);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to create broadcast');
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async (broadcast: Broadcast) => {
    if (!currentWorkspace) return;
    if (!confirm(`Send "${broadcast.name}" to contacts? This cannot be undone.`)) return;
    setSending(broadcast.id);
    try {
      const { data } = await api.post(`/workspaces/${currentWorkspace.id}/broadcasts/${broadcast.id}/send`, {
        lifecycleStage: form.lifecycleStage || undefined,
      });
      setBroadcasts(prev => prev.map(b => b.id === broadcast.id ? data : b));
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to send broadcast');
    } finally {
      setSending(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentWorkspace) return;
    if (!confirm('Delete this broadcast?')) return;
    await api.delete(`/workspaces/${currentWorkspace.id}/broadcasts/${id}`);
    setBroadcasts(prev => prev.filter(b => b.id !== id));
  };

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Broadcasts</h1>
            <p className="text-sm text-gray-500">Send messages to multiple contacts at once</p>
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
            <PlusIcon className="w-4 h-4" /> New Broadcast
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* New broadcast form */}
          {showNew && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">New Broadcast</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Broadcast name</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. April Promotion"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-500">{abEnabled ? 'Message A (first 50%)' : 'Message'}</label>
                    <button
                      type="button"
                      onClick={() => setAbEnabled(v => !v)}
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold transition-colors ${abEnabled ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {abEnabled ? '🧪 A/B ON' : '+ A/B Test'}
                    </button>
                  </div>
                  <textarea
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    rows={4}
                    placeholder="Type your message here..."
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">{form.message.length} characters</p>
                </div>

                {abEnabled && (
                  <div className="border border-purple-100 bg-purple-50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-purple-700">🧪 Message B (second 50%)</span>
                      <span className="text-[10px] bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full">A/B Test</span>
                    </div>
                    <textarea
                      value={form.variantMessage}
                      onChange={e => setForm(f => ({ ...f, variantMessage: e.target.value }))}
                      rows={4}
                      placeholder="Type your variant B message..."
                      className="w-full text-sm border border-purple-200 bg-white rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                    />
                    <p className="text-xs text-purple-500">{form.variantMessage.length} characters · Contacts split 50/50 randomly</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Channel (optional)</label>
                    <select
                      value={form.channelId}
                      onChange={e => setForm(f => ({ ...f, channelId: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Auto-select connected channel</option>
                      {channels.filter(c => c.status === 'connected').map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Send to (lifecycle stage)</label>
                    <select
                      value={form.lifecycleStage}
                      onChange={e => setForm(f => ({ ...f, lifecycleStage: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {LIFECYCLE_STAGES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                  <button onClick={handleCreate} disabled={creating || !form.name || !form.message} className="btn-primary px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                    {creating ? 'Creating...' : 'Create Broadcast'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
          ) : broadcasts.length === 0 ? (
            <div className="text-center py-16">
              <MegaphoneIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No broadcasts yet</p>
              <p className="text-sm text-gray-400 mt-1">Create your first broadcast to send messages to multiple contacts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {broadcasts.map(b => (
                <div key={b.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 text-sm">{b.name}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${statusColor[b.status] || 'bg-gray-100 text-gray-600'}`}>
                        {b.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate mb-2">{b.message}</p>
                    {b.status === 'completed' && (
                      <div className="space-y-1">
                        {b.variantMessage ? (
                          <div className="flex gap-3 text-xs">
                            <span className="text-gray-500 font-semibold">A:</span>
                            <span className="text-green-600">✅ {b.sentCount} sent</span>
                            {b.failedCount > 0 && <span className="text-red-500">❌ {b.failedCount} failed</span>}
                            <span className="text-purple-600 font-semibold ml-2">B:</span>
                            <span className="text-green-600">✅ {b.variantSentCount ?? 0} sent</span>
                            {(b.variantFailedCount ?? 0) > 0 && <span className="text-red-500">❌ {b.variantFailedCount} failed</span>}
                          </div>
                        ) : (
                          <div className="flex gap-4 text-xs text-gray-400">
                            <span>✅ {b.sentCount} sent</span>
                            {b.failedCount > 0 && <span>❌ {b.failedCount} failed</span>}
                            <span>Total: {b.totalContacts}</span>
                          </div>
                        )}
                        {b.variantMessage && (
                          <div className="flex gap-2 text-xs">
                            <span className="bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-semibold">🧪 A/B</span>
                            <span className="text-gray-400">Total: {b.totalContacts}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {b.status === 'draft' && (
                      <button
                        onClick={() => handleSend(b)}
                        disabled={sending === b.id}
                        className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-500 hover:bg-primary-600 px-3 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        <PaperAirplaneIcon className="w-3.5 h-3.5" />
                        {sending === b.id ? 'Sending...' : 'Send'}
                      </button>
                    )}
                    <button onClick={() => handleDelete(b.id)} className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg">
                      <TrashIcon className="w-4 h-4" />
                    </button>
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
