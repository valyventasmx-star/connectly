import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import api from '../api/client';

const STAGES = [
  { key: 'new_lead', label: 'New Lead', color: 'bg-blue-400', emoji: '🆕' },
  { key: 'hot_lead', label: 'Hot Lead', color: 'bg-orange-400', emoji: '🔥' },
  { key: 'payment', label: 'Payment', color: 'bg-yellow-400', emoji: '💳' },
  { key: 'customer', label: 'Customer', color: 'bg-green-400', emoji: '🏆' },
  { key: 'cold_lead', label: 'Cold Lead', color: 'bg-gray-400', emoji: '❄️' },
];

export default function Reports() {
  const { currentWorkspace } = useWorkspaceStore();
  const [lifecycle, setLifecycle] = useState<any>(null);
  const [conversations, setConversations] = useState<any>(null);
  const [tab, setTab] = useState<'lifecycle' | 'conversations'>('lifecycle');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    Promise.all([
      api.get(`/workspaces/${currentWorkspace.id}/reports/lifecycle`),
      api.get(`/workspaces/${currentWorkspace.id}/reports/conversations`),
    ]).then(([l, c]) => {
      setLifecycle(l.data);
      setConversations(c.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [currentWorkspace]);

  const maxCount = lifecycle ? Math.max(...lifecycle.funnel.map((s: any) => s.count), 1) : 1;

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">Track performance and contact journeys</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
            {[['lifecycle', 'Lifecycle'], ['conversations', 'Conversations']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
          ) : tab === 'lifecycle' && lifecycle ? (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <p className="text-2xl font-bold text-gray-900">{lifecycle.total}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Total contacts</p>
                </div>
                {lifecycle.funnel.slice(0, 3).map((s: any) => (
                  <div key={s.stage} className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="text-2xl font-bold text-gray-900">{s.count}</p>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">{s.stage.replace('_', ' ')}</p>
                    <p className="text-xs text-primary-600 mt-1">{s.conversionRate}% conversion</p>
                  </div>
                ))}
              </div>

              {/* Funnel chart */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-6">Lifecycle Journey Funnel</h3>
                <div className="space-y-3">
                  {lifecycle.funnel.map((s: any) => {
                    const stage = STAGES.find(st => st.key === s.stage);
                    const width = Math.max((s.count / maxCount) * 100, 2);
                    return (
                      <div key={s.stage} className="flex items-center gap-4">
                        <div className="w-28 text-right">
                          <span className="text-xs font-medium text-gray-600">{stage?.emoji} {stage?.label}</span>
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-8 relative">
                          <div
                            className={`${stage?.color} h-8 rounded-full flex items-center justify-end pr-3 transition-all`}
                            style={{ width: `${width}%` }}
                          >
                            {s.count > 0 && <span className="text-xs font-bold text-white">{s.count}</span>}
                          </div>
                        </div>
                        <div className="w-20 text-left">
                          <span className="text-xs text-gray-400">{s.conversionRate}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : tab === 'conversations' && conversations ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Open', value: conversations.open, color: 'text-orange-600' },
                  { label: 'Resolved', value: conversations.resolved, color: 'text-green-600' },
                  { label: 'Assigned', value: conversations.assigned, color: 'text-blue-600' },
                  { label: 'Unassigned', value: conversations.unassigned, color: 'text-gray-600' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* 30-day chart */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-6">Conversations — Last 30 days</h3>
                <div className="flex items-end gap-1 h-32">
                  {conversations.daily.map((d: any) => {
                    const max = Math.max(...conversations.daily.map((x: any) => x.count), 1);
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                        <div
                          className="w-full bg-primary-400 rounded-t transition-all"
                          style={{ height: `${Math.max((d.count / max) * 112, 2)}px` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                  <span>30 days ago</span>
                  <span>Today</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
