import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import { dashboardApi } from '../api/client';
import { formatDistanceToNow } from 'date-fns';
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CheckCircleIcon,
  UserIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

const CHANNEL_ICONS: Record<string, string> = { whatsapp: '💬', messenger: '📘', instagram: '📸' };

export default function Dashboard() {
  const { currentWorkspace, setActiveConversation } = useWorkspaceStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    dashboardApi.get(currentWorkspace.id)
      .then(r => setData(r.data))
      .catch(err => console.error('Dashboard load failed:', err))
      .finally(() => setLoading(false));
  }, [currentWorkspace?.id]);

  const { stats = {}, daily = [], recentConversations = [] } = data || {};
  const maxDaily = Math.max(...daily.map((d: any) => d.count), 1);

  const statCards = [
    { label: 'Open', value: stats.totalOpen, icon: ChatBubbleLeftRightIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'My Open', value: stats.myOpen, icon: UserIcon, color: 'text-primary-600', bg: 'bg-primary-50' },
    { label: 'Unassigned', value: stats.unassigned, icon: ExclamationTriangleIcon, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Resolved Today', value: stats.resolvedToday, icon: CheckCircleIcon, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'New Today', value: stats.newToday, icon: ArrowTrendingUpIcon, color: 'text-purple-600', bg: 'bg-purple-50' },
    {
      label: 'Avg First Response',
      value: stats.avgResponseTime != null ? `${stats.avgResponseTime}m` : '—',
      icon: ClockIcon,
      color: 'text-gray-600',
      bg: 'bg-gray-50',
    },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Overview for <span className="font-medium">{currentWorkspace?.name}</span>
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!currentWorkspace && (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              Select a workspace to view your dashboard
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          )}
          {/* Stat Cards */}
          {!loading && currentWorkspace && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {statCards.map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value ?? 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          )}

          {!loading && currentWorkspace && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 7-day trend chart */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 lg:col-span-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">New conversations — 7 days</h3>
              <div className="flex items-end gap-1.5 h-24">
                {daily.map((d: any) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                    <div
                      className="w-full bg-primary-400 rounded-t hover:bg-primary-500 transition-colors cursor-default"
                      style={{ height: `${Math.max((d.count / maxDaily) * 88, 4)}px` }}
                    />
                    <span className="text-[9px] text-gray-400 rotate-45 origin-left">
                      {new Date(d.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent conversations */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden lg:col-span-2">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Recent Conversations</h3>
                <button
                  onClick={() => navigate('/inbox')}
                  className="text-xs text-primary-600 hover:underline"
                >
                  View all →
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {recentConversations.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">No conversations yet</p>
                ) : (
                  recentConversations.map((conv: any) => {
                    const lastMsg = conv.messages?.[0];
                    const icon = CHANNEL_ICONS[conv.channel?.type] || '💬';
                    const isOverdue = conv.slaDueAt && new Date(conv.slaDueAt) < new Date() && conv.status === 'open';
                    return (
                      <div
                        key={conv.id}
                        className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => { setActiveConversation(conv); navigate('/inbox'); }}
                      >
                        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {conv.contact.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 truncate">{conv.contact.name}</span>
                            <span className="text-xs">{icon}</span>
                            {isOverdue && (
                              <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">SLA</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {lastMsg ? lastMsg.content : 'No messages yet'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            conv.status === 'open' ? 'bg-blue-50 text-blue-600' :
                            conv.status === 'resolved' ? 'bg-green-50 text-green-600' :
                            'bg-gray-100 text-gray-500'
                          }`}>{conv.status}</span>
                          <span className="text-[10px] text-gray-400">
                            {conv.lastMessageAt ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true }) : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>}
        </div>
      </div>
    </AppLayout>
  );
}
