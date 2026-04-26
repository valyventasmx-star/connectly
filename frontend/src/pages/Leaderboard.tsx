import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import api from '../api/client';
import Avatar from '../components/ui/Avatar';
import {
  TrophyIcon,
  ClockIcon,
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface AgentStat {
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  resolved: number;
  open: number;
  totalAssigned: number;
  messagesSent: number;
  avgResponseTime: number | null;
  resolutionRate: number;
}

const DAYS_OPTIONS = [7, 14, 30, 90];

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const { currentWorkspace } = useWorkspaceStore();
  const [stats, setStats] = useState<AgentStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);

  const load = () => {
    if (!currentWorkspace) return;
    setLoading(true);
    api.get(`/workspaces/${currentWorkspace.id}/leaderboard?days=${days}`)
      .then(r => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [currentWorkspace, days]);

  const maxResolved = Math.max(...stats.map(s => s.resolved), 1);

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TrophyIcon className="w-5 h-5 text-yellow-500" />
              Agent Leaderboard
            </h1>
            <p className="text-sm text-gray-500">Team performance rankings</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {DAYS_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    days === d ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={load}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
              title="Refresh"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!currentWorkspace ? (
            <div className="text-center py-20 text-gray-400">Select a workspace to view leaderboard</div>
          ) : loading && stats.length === 0 ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : stats.length === 0 ? (
            <div className="text-center py-20 text-gray-400">No agent data yet for this period</div>
          ) : (
            <div className="space-y-6">
              {/* Top 3 podium */}
              {stats.length >= 1 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {stats.slice(0, 3).map((agent, idx) => (
                    <div
                      key={agent.userId}
                      className={`bg-white rounded-2xl border p-6 text-center ${
                        idx === 0
                          ? 'border-yellow-200 bg-gradient-to-b from-yellow-50 to-white shadow-md'
                          : idx === 1
                          ? 'border-gray-200 bg-gradient-to-b from-gray-50 to-white'
                          : 'border-orange-100 bg-gradient-to-b from-orange-50 to-white'
                      }`}
                    >
                      <div className="text-3xl mb-2">{MEDALS[idx]}</div>
                      <div className="flex justify-center mb-3">
                        <Avatar name={agent.name} src={agent.avatar || undefined} size="lg" />
                      </div>
                      <p className="font-semibold text-gray-900">{agent.name}</p>
                      <p className="text-xs text-gray-500 capitalize mb-4">{agent.role}</p>
                      <div className="grid grid-cols-2 gap-3 text-left">
                        <div className="bg-white rounded-xl p-2.5 border border-gray-100">
                          <p className="text-lg font-bold text-green-600">{agent.resolved}</p>
                          <p className="text-[10px] text-gray-500">Resolved</p>
                        </div>
                        <div className="bg-white rounded-xl p-2.5 border border-gray-100">
                          <p className="text-lg font-bold text-primary-600">{agent.resolutionRate}%</p>
                          <p className="text-[10px] text-gray-500">Rate</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Full table */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">All Agents — Last {days} days</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Rank', 'Agent', 'Role', 'Resolved', 'Open', 'Messages', 'Avg Response', 'Resolution Rate'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {stats.map((agent, idx) => (
                        <tr key={agent.userId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className="text-sm font-bold text-gray-400">
                              {idx < 3 ? MEDALS[idx] : `#${idx + 1}`}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={agent.name} src={agent.avatar || undefined} size="sm" />
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{agent.name}</p>
                                <p className="text-xs text-gray-400">{agent.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                              agent.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                              agent.role === 'supervisor' ? 'bg-blue-100 text-blue-700' :
                              agent.role === 'viewer' ? 'bg-gray-100 text-gray-600' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {agent.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-green-600">{agent.resolved}</span>
                              <div className="flex-1 min-w-[60px]">
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-400 rounded-full"
                                    style={{ width: `${(agent.resolved / maxResolved) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-blue-600 font-medium">{agent.open}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{agent.messagesSent.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-700">
                              {agent.avgResponseTime != null
                                ? agent.avgResponseTime < 60
                                  ? `${agent.avgResponseTime}m`
                                  : `${Math.round(agent.avgResponseTime / 60)}h`
                                : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    agent.resolutionRate >= 70 ? 'bg-green-500' :
                                    agent.resolutionRate >= 40 ? 'bg-yellow-500' : 'bg-red-400'
                                  }`}
                                  style={{ width: `${agent.resolutionRate}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold text-gray-700">{agent.resolutionRate}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
