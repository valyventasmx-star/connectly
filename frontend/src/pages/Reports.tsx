import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import { reportsApi, csatApi } from '../api/client';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const STAGES = [
  { key: 'new_lead', label: 'New Lead', color: 'bg-blue-400', emoji: '🆕' },
  { key: 'hot_lead', label: 'Hot Lead', color: 'bg-orange-400', emoji: '🔥' },
  { key: 'payment', label: 'Payment', color: 'bg-yellow-400', emoji: '💳' },
  { key: 'customer', label: 'Customer', color: 'bg-green-400', emoji: '🏆' },
  { key: 'cold_lead', label: 'Cold Lead', color: 'bg-gray-400', emoji: '❄️' },
];

type TabKey = 'lifecycle' | 'conversations' | 'leaderboard' | 'tags' | 'csat';

export default function Reports() {
  const { currentWorkspace } = useWorkspaceStore();
  const [tab, setTab] = useState<TabKey>('lifecycle');
  const [loading, setLoading] = useState(false);
  const [lifecycle, setLifecycle] = useState<any>(null);
  const [conversations, setConversations] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [csat, setCsat] = useState<any>(null);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    const fetchers: Promise<any>[] = [
      reportsApi.lifecycle(currentWorkspace.id).then(r => setLifecycle(r.data)),
      reportsApi.conversations(currentWorkspace.id).then(r => setConversations(r.data)),
      reportsApi.leaderboard(currentWorkspace.id).then(r => setLeaderboard(r.data)),
      reportsApi.tags(currentWorkspace.id).then(r => setTags(r.data)),
      csatApi.get(currentWorkspace.id).then(r => setCsat(r.data)),
    ];
    Promise.all(fetchers).catch(console.error).finally(() => setLoading(false));
  }, [currentWorkspace]);


  const tabs: { key: TabKey; label: string }[] = [
    { key: 'lifecycle', label: 'Lifecycle' },
    { key: 'conversations', label: 'Conversations' },
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'tags', label: 'Tags' },
    { key: 'csat', label: 'CSAT' },
  ];

  const maxLifecycle = lifecycle ? Math.max(...lifecycle.funnel.map((s: any) => s.count), 1) : 1;
  const maxTagCount = tags.length ? Math.max(...tags.map(t => t.total), 1) : 1;

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500">Track performance and contact journeys</p>
          </div>
          {currentWorkspace && (
            <div className="flex gap-2">
              <button
                onClick={() => reportsApi.exportContacts(currentWorkspace.id)}
                className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ArrowDownTrayIcon className="w-3.5 h-3.5" /> Export Contacts
              </button>
              <button
                onClick={() => reportsApi.exportConversations(currentWorkspace.id)}
                className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ArrowDownTrayIcon className="w-3.5 h-3.5" /> Export Conversations
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Lifecycle */}
              {tab === 'lifecycle' && lifecycle && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                      <p className="text-2xl font-bold text-gray-900">{lifecycle.total}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Total contacts</p>
                    </div>
                    {lifecycle.funnel.slice(0, 3).map((s: any) => (
                      <div key={s.stage} className="bg-white rounded-2xl border border-gray-100 p-5">
                        <p className="text-2xl font-bold text-gray-900">{s.count}</p>
                        <p className="text-xs text-gray-500 mt-0.5 capitalize">{s.stage.replace('_', ' ')}</p>
                        <p className="text-xs text-primary-600 mt-1">{s.conversionRate}%</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-6">Lifecycle Funnel</h3>
                    <div className="space-y-3">
                      {lifecycle.funnel.map((s: any) => {
                        const stage = STAGES.find(st => st.key === s.stage);
                        const width = Math.max((s.count / maxLifecycle) * 100, 2);
                        return (
                          <div key={s.stage} className="flex items-center gap-4">
                            <div className="w-28 text-right"><span className="text-xs font-medium text-gray-600">{stage?.emoji} {stage?.label}</span></div>
                            <div className="flex-1 bg-gray-100 rounded-full h-8 relative">
                              <div className={`${stage?.color} h-8 rounded-full flex items-center justify-end pr-3`} style={{ width: `${width}%` }}>
                                {s.count > 0 && <span className="text-xs font-bold text-white">{s.count}</span>}
                              </div>
                            </div>
                            <div className="w-16"><span className="text-xs text-gray-400">{s.conversionRate}%</span></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Conversations */}
              {tab === 'conversations' && conversations && (
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
                  <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-6">Last 30 days</h3>
                    <div className="flex items-end gap-1 h-32">
                      {conversations.daily.map((d: any) => {
                        const max = Math.max(...conversations.daily.map((x: any) => x.count), 1);
                        return (
                          <div key={d.date} className="flex-1 flex flex-col items-center" title={`${d.date}: ${d.count}`}>
                            <div className="w-full bg-primary-400 rounded-t" style={{ height: `${Math.max((d.count / max) * 112, 2)}px` }} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-400">
                      <span>30 days ago</span><span>Today</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Leaderboard */}
              {tab === 'leaderboard' && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">Agent Leaderboard — Last 30 days</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Ranked by resolved conversations</p>
                  </div>
                  {leaderboard.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-12">No agents yet</p>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {['#', 'Agent', 'Resolved', 'Assigned', 'Avg. First Response'].map(h => (
                            <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {leaderboard.map((agent, idx) => (
                          <tr key={agent.user.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-bold text-gray-400">
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                                  {agent.user.name[0]}
                                </div>
                                <span className="text-sm font-medium text-gray-900">{agent.user.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-green-600">{agent.resolved}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{agent.assigned}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {agent.avgResponseTime !== null ? `${agent.avgResponseTime}m` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Tags */}
              {tab === 'tags' && (
                <div className="space-y-6">
                  {tags.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-sm">No conversation tags yet</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                          <p className="text-2xl font-bold text-gray-900">{tags.length}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Total tags</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                          <p className="text-2xl font-bold text-gray-900">{tags.reduce((s, t) => s + t.total, 0)}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Tagged conversations</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                          <p className="text-2xl font-bold text-gray-900">{tags.reduce((s, t) => s + t.resolved, 0)}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Resolved</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                          <p className="text-2xl font-bold text-primary-600">
                            {tags.length ? Math.round(tags.reduce((s, t) => s + t.resolutionRate, 0) / tags.length) : 0}%
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">Avg. resolution rate</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-6">Tag Performance</h3>
                        <div className="space-y-4">
                          {tags.map(tag => (
                            <div key={tag.id} className="flex items-center gap-4">
                              <div className="w-28 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                                <span className="text-xs font-medium text-gray-700 truncate">{tag.name}</span>
                              </div>
                              <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                                <div className="h-6 rounded-full flex items-center justify-end pr-2"
                                  style={{ width: `${Math.max((tag.total / maxTagCount) * 100, 4)}%`, backgroundColor: tag.color }}>
                                  {tag.total > 0 && <span className="text-[10px] font-bold text-white">{tag.total}</span>}
                                </div>
                              </div>
                              <div className="w-16 text-right">
                                <span className="text-xs text-green-600 font-medium">{tag.resolutionRate}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              {/* CSAT */}
              {tab === 'csat' && (
                <div className="space-y-6">
                  {!csat || csat.total === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-sm">No CSAT responses yet</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                          <p className="text-2xl font-bold text-gray-900">{csat.total}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Total responses</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                          <p className="text-2xl font-bold text-primary-600">{csat.avg ?? '—'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Avg. score (1–5)</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                          <p className="text-2xl font-bold text-green-600">
                            {csat.total ? Math.round((csat.distribution?.filter((d: any) => d.score >= 4).reduce((s: number, d: any) => s + d.count, 0) / csat.total) * 100) : 0}%
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">Satisfied (4–5 stars)</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-6">Score Distribution</h3>
                        <div className="space-y-3">
                          {(csat.distribution || []).map((d: any) => {
                            const max = Math.max(...(csat.distribution || []).map((x: any) => x.count), 1);
                            const stars = '⭐'.repeat(d.score);
                            return (
                              <div key={d.score} className="flex items-center gap-4">
                                <div className="w-16 text-right text-xs font-medium text-gray-600">{stars}</div>
                                <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                                  <div
                                    className="h-6 rounded-full bg-primary-400 flex items-center justify-end pr-2"
                                    style={{ width: `${Math.max((d.count / max) * 100, d.count > 0 ? 4 : 0)}%` }}
                                  >
                                    {d.count > 0 && <span className="text-[10px] font-bold text-white">{d.count}</span>}
                                  </div>
                                </div>
                                <div className="w-12 text-xs text-gray-400">{d.count}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {csat.responses?.filter((r: any) => r.comment).length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                          <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Comments</h3>
                          <div className="space-y-3">
                            {csat.responses.filter((r: any) => r.comment).slice(0, 10).map((r: any) => (
                              <div key={r.id} className="border-b border-gray-50 pb-3 last:border-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs">{'⭐'.repeat(r.score)}</span>
                                  <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm text-gray-700">{r.comment}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
