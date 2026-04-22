import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import api from '../api/client';
import {
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface Analytics {
  overview: {
    totalConversations: number;
    openConversations: number;
    resolvedConversations: number;
    totalContacts: number;
    totalMessages: number;
    newContactsThisMonth: number;
    conversationsThisWeek: number;
    messagesThisMonth: number;
  };
  messages: { inbound: number; outbound: number; aiReplies: number };
  dailyMessages: { date: string; count: number }[];
  resolutionRate: number;
}

function StatCard({ icon, label, value, sub, color = 'primary' }: any) {
  const colors: any = {
    primary: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value?.toLocaleString()}</p>
      <p className="text-sm font-medium text-gray-600 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function Analytics() {
  const { currentWorkspace } = useWorkspaceStore();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    api.get(`/workspaces/${currentWorkspace.id}/analytics`)
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentWorkspace]);

  const maxDaily = data ? Math.max(...data.dailyMessages.map(d => d.count), 1) : 1;

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500">Last 30 days performance overview</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-16"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
          ) : data ? (
            <div className="space-y-6">
              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                <StatCard icon={<ChatBubbleLeftRightIcon className="w-5 h-5" />} label="Total Conversations" value={data.overview.totalConversations} color="primary" />
                <StatCard icon={<ChatBubbleLeftRightIcon className="w-5 h-5" />} label="Open Now" value={data.overview.openConversations} sub="Needs attention" color="orange" />
                <StatCard icon={<CheckCircleIcon className="w-5 h-5" />} label="Resolution Rate" value={`${data.resolutionRate}%`} color="green" />
                <StatCard icon={<UserGroupIcon className="w-5 h-5" />} label="Total Contacts" value={data.overview.totalContacts} sub={`+${data.overview.newContactsThisMonth} this month`} color="blue" />
                <StatCard icon={<SparklesIcon className="w-5 h-5" />} label="AI Replies" value={data.messages.aiReplies} sub="Automated responses" color="purple" />
              </div>

              {/* Message chart */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-6">Messages — Last 7 days</h3>
                <div className="flex items-end gap-3 h-40">
                  {data.dailyMessages.map((d) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-xs text-gray-500">{d.count}</span>
                      <div
                        className="w-full bg-primary-500 rounded-t-lg transition-all"
                        style={{ height: `${Math.max((d.count / maxDaily) * 120, 4)}px` }}
                      />
                      <span className="text-[10px] text-gray-400">
                        {new Date(d.date).toLocaleDateString('en', { weekday: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Message Breakdown</p>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Inbound</span>
                      <span className="font-semibold text-gray-900">{data.messages.inbound.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Outbound</span>
                      <span className="font-semibold text-gray-900">{data.messages.outbound.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">AI Replies</span>
                      <span className="font-semibold text-purple-600">{data.messages.aiReplies.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">This Week</p>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">New conversations</span>
                      <span className="font-semibold text-gray-900">{data.overview.conversationsThisWeek}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Messages (30d)</span>
                      <span className="font-semibold text-gray-900">{data.overview.messagesThisMonth.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contacts</p>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total</span>
                      <span className="font-semibold text-gray-900">{data.overview.totalContacts}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">New (30d)</span>
                      <span className="font-semibold text-green-600">+{data.overview.newContactsThisMonth}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">Select a workspace to view analytics</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
