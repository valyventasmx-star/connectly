import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useAuthStore } from '../store/auth';
import api from '../api/client';
import { format } from 'date-fns';
import {
  ShieldCheckIcon,
  TrashIcon,
  ArrowRightOnRectangleIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

// ── Types ────────────────────────────────────────────────────────────────────
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
  planExpiresAt: string | null;
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

interface ConvRow {
  id: string;
  status: string;
  lastMessageAt: string | null;
  contact: { name: string; phone: string | null; email: string | null };
  channel: { name: string; type: string };
  _count: { messages: number };
}

interface MsgRow {
  id: string;
  content: string;
  direction: string;
  status: string;
  isNote: boolean;
  isAiReply: boolean;
  senderName: string | null;
  createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const PLAN_BADGE: Record<string, string> = {
  free:   'bg-gray-100 text-gray-600',
  pro:    'bg-blue-100 text-blue-700',
  agency: 'bg-purple-100 text-purple-700',
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function ConfirmDelete({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Delete "{name}"?</h3>
        <p className="text-sm text-gray-500 mb-5">This is permanent and cannot be undone. All data will be deleted.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium">Delete permanently</button>
        </div>
      </div>
    </div>
  );
}

// ── Message log modal ────────────────────────────────────────────────────────
function MessageLogModal({ conv, onClose }: { conv: ConvRow; onClose: () => void }) {
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/conversations/${conv.id}/messages`)
      .then(r => setMessages(r.data.messages))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [conv.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{conv.contact.name}</h3>
            <p className="text-xs text-gray-400">{conv.channel.name} · {conv._count.messages} messages · {conv.status}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-gray-50">
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">No messages</p>
          ) : messages.map(m => (
            <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                m.isNote ? 'bg-amber-50 border border-amber-200 text-gray-700' :
                m.direction === 'outbound' ? 'bg-primary-600 text-white' :
                'bg-white border border-gray-100 text-gray-800 shadow-sm'
              }`}>
                {m.senderName && <p className={`text-[10px] font-semibold mb-0.5 ${m.direction === 'outbound' ? 'text-primary-200' : 'text-primary-500'}`}>{m.senderName}{m.isAiReply ? ' · AI' : ''}</p>}
                <p className="whitespace-pre-wrap break-words leading-snug">{m.content || '(media)'}</p>
                <p className={`text-[10px] mt-1 text-right ${m.direction === 'outbound' ? 'text-primary-200' : 'text-gray-400'}`}>
                  {format(new Date(m.createdAt), 'MMM d, HH:mm')} · {m.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Conversation log panel (inside workspace) ────────────────────────────────
function WorkspaceConvPanel({ workspace, onClose }: { workspace: WorkspaceRow; onClose: () => void }) {
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<ConvRow | null>(null);

  useEffect(() => {
    api.get(`/admin/workspaces/${workspace.id}/conversations`)
      .then(r => { setConvs(r.data.conversations); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workspace.id]);

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{workspace.name} — Conversations</h3>
              <p className="text-xs text-gray-400">{total} total</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><XMarkIcon className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : convs.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-10">No conversations yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Contact</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Channel</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Messages</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Last activity</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {convs.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedConv(c)}>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.contact.name}<span className="block text-xs text-gray-400 font-normal">{c.contact.phone || c.contact.email || ''}</span></td>
                      <td className="px-4 py-3 text-gray-500">{c.channel.name}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'open' ? 'bg-green-100 text-green-700' : c.status === 'resolved' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-700'}`}>{c.status}</span></td>
                      <td className="px-4 py-3 text-gray-500">{c._count.messages}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{c.lastMessageAt ? format(new Date(c.lastMessageAt), 'MMM d, HH:mm') : '—'}</td>
                      <td className="px-4 py-3"><ChevronRightIcon className="w-4 h-4 text-gray-300" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      {selectedConv && <MessageLogModal conv={selectedConv} onClose={() => setSelectedConv(null)} />}
    </>
  );
}

// ── Main Admin page ──────────────────────────────────────────────────────────
export default function Admin() {
  const { user, setAuth } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tab, setTab] = useState<'workspaces' | 'users'>('workspaces');
  const [loading, setLoading] = useState(false);

  // Plan editing state
  const [planUpdating, setPlanUpdating] = useState<string | null>(null);
  const [expiryEditing, setExpiryEditing] = useState<string | null>(null);
  const [expiryValue, setExpiryValue] = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'workspace' | 'user'; id: string; name: string } | null>(null);

  // Conversation logs
  const [logsWorkspace, setLogsWorkspace] = useState<WorkspaceRow | null>(null);

  // Impersonation banner
  const [impersonating, setImpersonating] = useState<string | null>(null);

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

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handlePlanChange = async (workspaceId: string, plan: string) => {
    setPlanUpdating(workspaceId);
    try {
      const expiry = expiryEditing === workspaceId ? expiryValue || null : undefined;
      await api.patch(`/admin/workspaces/${workspaceId}/plan`, {
        plan,
        ...(expiry !== undefined ? { planExpiresAt: expiry } : {}),
      });
      setWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, plan } : w));
    } catch { alert('Failed to update plan'); }
    finally { setPlanUpdating(null); }
  };

  const handleExpirySet = async (workspaceId: string, currentPlan: string) => {
    try {
      await api.patch(`/admin/workspaces/${workspaceId}/plan`, {
        plan: currentPlan,
        planExpiresAt: expiryValue || null,
      });
      setWorkspaces(prev => prev.map(w =>
        w.id === workspaceId ? { ...w, planExpiresAt: expiryValue || null } : w
      ));
      setExpiryEditing(null);
    } catch { alert('Failed to set expiry'); }
  };

  const handleAdminToggle = async (userId: string, isAdmin: boolean) => {
    try {
      await api.patch(`/admin/users/${userId}/admin`, { isAdmin });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isAdmin } : u));
    } catch { alert('Failed to update user'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'workspace') {
        await api.delete(`/admin/workspaces/${deleteTarget.id}`);
        setWorkspaces(prev => prev.filter(w => w.id !== deleteTarget.id));
      } else {
        await api.delete(`/admin/users/${deleteTarget.id}`);
        setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      }
    } catch { alert('Delete failed'); }
    finally { setDeleteTarget(null); }
  };

  const handleImpersonate = async (targetUser: UserRow) => {
    try {
      const { data } = await api.post(`/admin/users/${targetUser.id}/impersonate`);
      // Store original admin token so we can restore it
      const originalToken = localStorage.getItem('token')!;
      localStorage.setItem('_adminToken', originalToken);
      localStorage.setItem('_adminName', user.name);
      setAuth(data.user, data.token);
      setImpersonating(targetUser.name);
      window.location.href = '/dashboard';
    } catch { alert('Impersonation failed'); }
  };

  const exitImpersonation = () => {
    const adminToken = localStorage.getItem('_adminToken');
    if (!adminToken) return;
    localStorage.removeItem('_adminToken');
    localStorage.removeItem('_adminName');
    // Restore admin session
    api.get('/auth/me', { headers: { Authorization: `Bearer ${adminToken}` } }).then(({ data }) => {
      setAuth(data, adminToken);
      window.location.href = '/admin';
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Impersonation banner */}
      {localStorage.getItem('_adminToken') && (
        <div className="flex items-center justify-between px-5 py-2 bg-amber-500 text-white text-sm flex-shrink-0">
          <span>👤 Impersonating <strong>{localStorage.getItem('_adminName') ? 'another user' : ''}</strong> — you are seeing their account</span>
          <button onClick={exitImpersonation} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg font-medium text-xs transition-colors">
            <ArrowRightOnRectangleIcon className="w-4 h-4" /> Exit impersonation
          </button>
        </div>
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-purple-500" /> Admin Panel
          </h1>
          <p className="text-sm text-gray-500">Full platform control</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex justify-center py-16"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
          ) : (
            <>
              {/* Stat cards */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Total users" value={stats.totalUsers} />
                  <StatCard label="Workspaces" value={stats.totalWorkspaces} />
                  <StatCard label="Conversations" value={stats.totalConversations} />
                  <StatCard label="Messages" value={stats.totalMessages} />
                </div>
              )}

              {/* Plan distribution */}
              {stats && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Plan Distribution</p>
                  <div className="flex gap-6 flex-wrap">
                    {stats.planCounts.map(({ plan, _count }) => (
                      <div key={plan} className="text-center">
                        <p className="text-xl font-bold text-gray-900">{_count}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${PLAN_BADGE[plan] || 'bg-gray-100 text-gray-600'}`}>{plan}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                {(['workspaces', 'users'] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {t}
                  </button>
                ))}
              </div>

              {/* ── Workspaces table ── */}
              {tab === 'workspaces' && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Workspace</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Members</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Contacts</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Plan</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Expires</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {workspaces.map((w) => (
                        <tr key={w.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {w.name}
                            <span className="block text-xs text-gray-400 font-normal">{w._count.conversations} convs · {w._count.channels} channels</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{w._count.members}</td>
                          <td className="px-4 py-3 text-gray-500">{w._count.contacts}</td>
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
                          <td className="px-4 py-3">
                            {expiryEditing === w.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="date"
                                  value={expiryValue}
                                  onChange={e => setExpiryValue(e.target.value)}
                                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                />
                                <button onClick={() => handleExpirySet(w.id, w.plan)} className="text-xs bg-primary-600 text-white px-2 py-1 rounded-lg hover:bg-primary-700">Save</button>
                                <button onClick={() => setExpiryEditing(null)} className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setExpiryEditing(w.id); setExpiryValue(w.planExpiresAt ? w.planExpiresAt.slice(0, 10) : ''); }}
                                className="text-xs text-gray-400 hover:text-primary-600 underline-offset-2 hover:underline"
                              >
                                {w.planExpiresAt ? format(new Date(w.planExpiresAt), 'MMM d, yyyy') : 'Lifetime'}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setLogsWorkspace(w)}
                                title="View conversation logs"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                              >
                                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ type: 'workspace', id: w.id, name: w.name })}
                                title="Delete workspace"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Users table ── */}
              {tab === 'users' && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">User</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Email</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Workspaces</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Admin</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {u.name}
                            <span className="block text-xs text-gray-400 font-normal">{format(new Date(u.createdAt), 'MMM d, yyyy')}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{u.email}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {u.workspaceMembers.map(m => (
                              <span key={m.workspace.name} className="inline-flex items-center gap-1 mr-1">
                                {m.workspace.name}
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${PLAN_BADGE[m.workspace.plan] || 'bg-gray-100 text-gray-500'}`}>{m.workspace.plan}</span>
                              </span>
                            )) || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleAdminToggle(u.id, !u.isAdmin)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${u.isAdmin ? 'bg-purple-500' : 'bg-gray-200'}`}
                            >
                              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${u.isAdmin ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {u.id !== user.id && (
                                <button
                                  onClick={() => handleImpersonate(u)}
                                  title="Log in as this user"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                >
                                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                                </button>
                              )}
                              {u.id !== user.id && (
                                <button
                                  onClick={() => setDeleteTarget({ type: 'user', id: u.id, name: u.name })}
                                  title="Delete user"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              )}
                              {u.id === user.id && <span className="text-xs text-gray-300 italic">you</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <ConfirmDelete
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Conversation logs panel */}
      {logsWorkspace && (
        <WorkspaceConvPanel workspace={logsWorkspace} onClose={() => setLogsWorkspace(null)} />
      )}
    </AppLayout>
  );
}
