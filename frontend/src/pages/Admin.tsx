import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useAuthStore } from '../store/auth';
import api from '../api/client';
import {
  UserGroupIcon,
  BuildingOfficeIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

interface AdminStats {
  totalUsers: number;
  totalWorkspaces: number;
  totalConversations: number;
  totalMessages: number;
  planCounts: { plan: string; _count: number }[];
}

interface WorkspaceRow {
  id: string;
  name: string;
  plan: string;
  createdAt: string;
  _count: { members: number; channels: number; contacts: number; conversations: number };
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  workspaceMembers: { workspace: { name: string; plan: string } }[];
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tab, setTab] = useState<'overview' | 'workspaces' | 'users'>('overview');
  const [loading, setLoading] = useState(false);
  const [planUpdating, setPlanUpdating] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/workspaces'),
      api.get('/admin/users'),
    ]).then(([s, w, u]) => {
      setStats(s.data);
      setWorkspaces(w.data);
      setUsers(u.data.users);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handlePlanChange = async (workspaceId: string, plan: string) => {
    setPlanUpdating(workspaceId);
    try {
      await api.patch(`/admin/workspaces/${workspaceId}/plan`, { plan });
      setWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, plan } : w));
    } catch (e) {
      alert('Failed to update plan');
    } finally {
      setPlanUpdating(null);
    }
  };

  const handleAdminToggle = async (userId: string, isAdmin: boolean) => {
    try {
      await api.patch(`/admin/users/${userId}/admin`, { isAdmin });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isAdmin } : u));
    } catch {
      alert('Failed to update user');
    }
  };

  if (!user?.isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col flex-1 items-center justify-center text-gray-400">
          <ShieldCheckIcon className="w-12 h-12 mb-3" />
          <p className="font-medium">Admin access required</p>
        </div>
      </AppLayout>
    );
  }

  const planBadge: Record<string, string> = {
    free: 'bg-gray-100 text-gray-600',
    pro: 'bg-primary-100 text-primary-700',
    agency: 'bg-purple-100 text-purple-700',
  };

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500">Platform management</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-16"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
          ) : (
            <div className="space-y-6">
              {/* Stat cards */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatPill label="Total users" value={stats.totalUsers} />
                  <StatPill label="Workspaces" value={stats.totalWorkspaces} />
                  <StatPill label="Conversations" value={stats.totalConversations} />
                  <StatPill label="Messages" value={stats.totalMessages} />
                </div>
              )}

              {/* Plan distribution */}
              {stats && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Plan Distribution</p>
                  <div className="flex gap-4 flex-wrap">
                    {stats.planCounts.map(({ plan, _count }) => (
                      <div key={plan} className="text-center">
                        <p className="text-xl font-bold text-gray-900">{_count}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${planBadge[plan] || 'bg-gray-100 text-gray-600'}`}>{plan}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                {(['workspaces', 'users'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Workspaces table */}
              {tab === 'workspaces' && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Workspace</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Members</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Contacts</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Plan</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Change plan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {workspaces.map((w) => (
                        <tr key={w.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{w.name}</td>
                          <td className="px-4 py-3 text-gray-500">{w._count.members}</td>
                          <td className="px-4 py-3 text-gray-500">{w._count.contacts}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${planBadge[w.plan] || 'bg-gray-100 text-gray-600'}`}>{w.plan}</span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={w.plan}
                              onChange={(e) => handlePlanChange(w.id, e.target.value)}
                              disabled={planUpdating === w.id}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              <option value="free">Free</option>
                              <option value="pro">Pro</option>
                              <option value="agency">Agency</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Users table */}
              {tab === 'users' && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">User</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Email</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Workspaces</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                          <td className="px-4 py-3 text-gray-500">{u.email}</td>
                          <td className="px-4 py-3 text-gray-500">
                            {u.workspaceMembers.map(m => m.workspace.name).join(', ') || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleAdminToggle(u.id, !u.isAdmin)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                u.isAdmin ? 'bg-primary-500' : 'bg-gray-200'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  u.isAdmin ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
