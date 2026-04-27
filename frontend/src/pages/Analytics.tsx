import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import api from '../api/client';
import { csatApi } from '../api/client';
import {
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  SparklesIcon,
  StarIcon,
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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function HeatmapChart({ cells }: { cells: { day: number; hour: number; count: number }[] }) {
  const maxCount = Math.max(...cells.map(c => c.count), 1);
  const getCell = (day: number, hour: number) => cells.find(c => c.day === day && c.hour === hour);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-700';
    const pct = count / maxCount;
    if (pct < 0.2) return 'bg-primary-100 dark:bg-primary-900/40';
    if (pct < 0.4) return 'bg-primary-200 dark:bg-primary-800/60';
    if (pct < 0.6) return 'bg-primary-400 dark:bg-primary-600';
    if (pct < 0.8) return 'bg-primary-600 dark:bg-primary-500';
    return 'bg-primary-700 dark:bg-primary-400';
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex ml-10 mb-1">
          {HOURS.map(h => (
            <div key={h} className="flex-1 text-center text-[10px] text-gray-400">
              {h % 6 === 0 ? `${h}h` : ''}
            </div>
          ))}
        </div>
        {/* Rows */}
        {DAYS.map((day, dayIdx) => (
          <div key={day} className="flex items-center gap-0.5 mb-0.5">
            <div className="w-9 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 text-right pr-2">{day}</div>
            {HOURS.map(hour => {
              const cell = getCell(dayIdx, hour);
              const count = cell?.count || 0;
              return (
                <div
                  key={hour}
                  className={`flex-1 h-5 rounded-sm ${getColor(count)} transition-colors cursor-default`}
                  title={`${day} ${hour}:00 — ${count} messages`}
                />
              );
            })}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-1 mt-3 ml-10">
          <span className="text-xs text-gray-400 mr-1">Less</span>
          {['bg-gray-100 dark:bg-gray-700', 'bg-primary-100', 'bg-primary-200', 'bg-primary-400', 'bg-primary-600', 'bg-primary-700'].map((c, i) => (
            <div key={i} className={`w-4 h-4 rounded-sm ${c}`} />
          ))}
          <span className="text-xs text-gray-400 ml-1">More</span>
        </div>
      </div>
    </div>
  );
}

interface CsatData {
  total: number;
  avg: number | null;
  distribution: { score: number; count: number }[];
  responses: { id: string; score: number; comment?: string; createdAt: string }[];
}

export default function Analytics() {
  const { currentWorkspace } = useWorkspaceStore();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [heatmap, setHeatmap] = useState<{ cells: { day: number; hour: number; count: number }[]; total: number } | null>(null);
  const [byChannel, setByChannel] = useState<any[]>([]);
  const [byLanguage, setByLanguage] = useState<any[]>([]);
  const [csat, setCsat] = useState<CsatData | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    // All requests fire in parallel; each has its own .catch so one failure
    // never blocks the others from rendering
    Promise.all([
      api.get(`/workspaces/${currentWorkspace.id}/analytics`).catch(() => ({ data: null })),
      api.get(`/workspaces/${currentWorkspace.id}/analytics/heatmap`).catch(() => ({ data: null })),
      api.get(`/workspaces/${currentWorkspace.id}/analytics/by-channel`).catch(() => ({ data: [] })),
      api.get(`/workspaces/${currentWorkspace.id}/analytics/by-language`).catch(() => ({ data: [] })),
      csatApi.get(currentWorkspace.id).catch(() => ({ data: null })),
    ]).then(([a, h, c, l, cs]) => {
      if (a.data) setData(a.data);
      if (h.data) setHeatmap(h.data);
      if (Array.isArray(c.data)) setByChannel(c.data);
      if (Array.isArray(l.data)) setByLanguage(l.data);
      if (cs.data) setCsat(cs.data);
    }).finally(() => setLoading(false));
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
              {/* Heatmap */}
              {heatmap && heatmap.cells.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Message Volume Heatmap</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Inbound messages by hour of day × day of week (last 30 days) — {heatmap.total} total</p>
                  <HeatmapChart cells={heatmap.cells} />
                </div>
              )}

              {/* By Channel + By Language */}
              {(byChannel.length > 0 || byLanguage.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {byChannel.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Messages by Channel</h3>
                      {byChannel.map(ch => {
                        const max = Math.max(...byChannel.map(c => c.total), 1);
                        const EMOJI: Record<string, string> = { whatsapp: '💬', instagram: '📸', messenger: '💙', telegram: '✈️', email: '📧', widget: '🌐' };
                        return (
                          <div key={ch.channelId} className="mb-3">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="font-medium">{EMOJI[ch.type] || '📡'} {ch.name}</span>
                              <span className="text-gray-500 dark:text-gray-400">{ch.total.toLocaleString()}</span>
                            </div>
                            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-primary-500 rounded-full" style={{ width: `${(ch.total / max) * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {byLanguage.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Contacts by Language</h3>
                      {byLanguage.slice(0, 8).map(l => {
                        const max = Math.max(...byLanguage.map(x => x.count), 1);
                        const FLAG: Record<string, string> = { en: '🇺🇸', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', pt: '🇧🇷', it: '🇮🇹', ar: '🇸🇦', zh: '🇨🇳', ja: '🇯🇵', ko: '🇰🇷', hi: '🇮🇳', ru: '🇷🇺', tr: '🇹🇷', nl: '🇳🇱' };
                        const NAMES: Record<string, string> = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', hi: 'Hindi', ru: 'Russian', tr: 'Turkish', nl: 'Dutch', unknown: 'Unknown' };
                        return (
                          <div key={l.language} className="mb-3">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="font-medium">{FLAG[l.language] || '🌐'} {NAMES[l.language] || l.language}</span>
                              <span className="text-gray-500 dark:text-gray-400">{l.count.toLocaleString()}</span>
                            </div>
                            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${(l.count / max) * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {/* CSAT Section */}
              {csat && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Customer Satisfaction (CSAT)</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Last 30 days · {csat.total} response{csat.total !== 1 ? 's' : ''}</p>
                    </div>
                    {csat.avg !== null && (
                      <div className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-2">
                        <StarIcon className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                        <span className="text-2xl font-bold text-gray-900">{csat.avg}</span>
                        <span className="text-sm text-gray-400">/5</span>
                      </div>
                    )}
                  </div>
                  {csat.total === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">No CSAT responses yet. Send surveys from resolved conversations.</div>
                  ) : (
                    <div className="space-y-2">
                      {[5, 4, 3, 2, 1].map(score => {
                        const d = csat.distribution.find(x => x.score === score);
                        const count = d?.count || 0;
                        const pct = csat.total ? Math.round((count / csat.total) * 100) : 0;
                        const LABELS: Record<number, string> = { 5: '😄 Excellent', 4: '😊 Good', 3: '😐 Neutral', 2: '😞 Poor', 1: '😠 Terrible' };
                        const COLORS: Record<number, string> = { 5: 'bg-green-500', 4: 'bg-green-400', 3: 'bg-yellow-400', 2: 'bg-orange-400', 1: 'bg-red-500' };
                        return (
                          <div key={score} className="flex items-center gap-3">
                            <span className="text-xs w-24 text-gray-600 flex-shrink-0">{LABELS[score]}</span>
                            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${COLORS[score]}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-10 text-right flex-shrink-0">{count} <span className="text-gray-300">({pct}%)</span></span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Recent comments */}
                  {csat.responses?.filter(r => r.comment).slice(0, 3).length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Comments</p>
                      {csat.responses.filter(r => r.comment).slice(0, 3).map(r => (
                        <div key={r.id} className="flex items-start gap-2 bg-gray-50 rounded-lg p-3">
                          <span className="text-sm flex-shrink-0">{['', '😠', '😞', '😐', '😊', '😄'][r.score]}</span>
                          <p className="text-xs text-gray-600 italic">"{r.comment}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">Select a workspace to view analytics</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
