import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import { workspacesApi } from '../api/client';
import { Workspace } from '../types';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import {
  PlusIcon,
  BuildingOfficeIcon,
  UserPlusIcon,
  TrashIcon,
  PencilIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

export default function Workspaces() {
  const { workspaces, currentWorkspace, setCurrentWorkspace, addWorkspace, updateWorkspace, removeWorkspace } = useWorkspaceStore();
  const [selected, setSelected] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('agent');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selected) loadMembers(selected.id);
  }, [selected]);

  const loadMembers = async (wsId: string) => {
    const { data } = await workspacesApi.get(wsId);
    setMembers(data.members || []);
  };

  const handleCreate = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const { data } = await workspacesApi.create(form.name, form.description);
      addWorkspace({ ...data, role: 'owner' });
      setShowCreate(false);
      setForm({ name: '', description: '' });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selected || !form.name) return;
    setSaving(true);
    try {
      const { data } = await workspacesApi.update(selected.id, form);
      updateWorkspace({ ...selected, ...data });
      setSelected({ ...selected, ...data });
      setShowEdit(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ws: Workspace) => {
    if (!confirm(`Delete workspace "${ws.name}"? This cannot be undone.`)) return;
    await workspacesApi.delete(ws.id);
    removeWorkspace(ws.id);
    if (selected?.id === ws.id) setSelected(null);
    if (currentWorkspace?.id === ws.id) setCurrentWorkspace(workspaces.find((w) => w.id !== ws.id) || null);
  };

  const handleInvite = async () => {
    if (!selected || !inviteEmail) return;
    setSaving(true);
    try {
      const { data } = await workspacesApi.addMember(selected.id, inviteEmail, inviteRole);
      setMembers((m) => [...m, data]);
      setInviteEmail('');
      setShowInvite(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to invite member');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selected || !confirm('Remove this member?')) return;
    await workspacesApi.removeMember(selected.id, userId);
    setMembers((m) => m.filter((mem) => mem.user.id !== userId));
  };

  const openEdit = (ws: any) => {
    setForm({ name: ws.name, description: ws.description || '' });
    setShowEdit(true);
  };

  return (
    <AppLayout>
      <div className="flex flex-1 overflow-hidden">
        {/* Workspace list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Workspaces</h1>
              <p className="text-sm text-gray-500">Manage your client workspaces</p>
            </div>
            <Button icon={<PlusIcon className="w-4 h-4" />} onClick={() => { setForm({ name: '', description: '' }); setShowCreate(true); }}>
              New Workspace
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {workspaces.length === 0 ? (
              <EmptyState icon={<BuildingOfficeIcon className="w-8 h-8" />} title="No workspaces" description="Create your first workspace to get started" action={<Button onClick={() => setShowCreate(true)}>Create Workspace</Button>} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    onClick={() => setSelected(ws)}
                    className={`bg-white rounded-2xl border p-5 cursor-pointer hover:shadow-md transition-all ${selected?.id === ws.id ? 'border-primary-300 ring-1 ring-primary-300' : 'border-gray-100'}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={ws.name} size="md" />
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">{ws.name}</h3>
                          <span className="text-xs text-gray-500 capitalize">{ws.role || 'member'}</span>
                        </div>
                      </div>
                      {ws.id === currentWorkspace?.id && (
                        <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                      )}
                    </div>
                    {ws.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{ws.description}</p>}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{ws._count?.channels || 0} channels</span>
                        <span>{ws._count?.contacts || 0} contacts</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); openEdit(ws); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><PencilIcon className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(ws); }} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600"><TrashIcon className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 border-l border-gray-100 bg-white overflow-y-auto flex-shrink-0">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Avatar name={selected.name} size="lg" />
                <div>
                  <h3 className="font-semibold text-gray-900">{selected.name}</h3>
                  {selected.description && <p className="text-sm text-gray-500">{selected.description}</p>}
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Members</p>
                <button onClick={() => setShowInvite(true)} className="text-xs text-primary-600 font-medium hover:underline flex items-center gap-1">
                  <UserPlusIcon className="w-3.5 h-3.5" />Invite
                </button>
              </div>
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.user.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar name={m.user.name} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.user.name}</p>
                        <p className="text-xs text-gray-500">{m.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 capitalize">{m.role}</span>
                      {m.role !== 'owner' && (
                        <button onClick={() => handleRemoveMember(m.user.id)} className="text-gray-300 hover:text-red-500">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Button variant="secondary" size="sm" className="w-full justify-center" onClick={() => { setCurrentWorkspace(selected); }}>
                  Switch to this workspace
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Workspace"
        footer={<><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={handleCreate} loading={saving}>Create</Button></>}
      >
        <div className="space-y-4">
          <Input label="Workspace name *" placeholder="My Company" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" rows={3} placeholder="Optional description..." value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Workspace"
        footer={<><Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button><Button onClick={handleEdit} loading={saving}>Save</Button></>}
      >
        <div className="space-y-4">
          <Input label="Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Invite Modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite Team Member"
        footer={<><Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button><Button onClick={handleInvite} loading={saving}>Send Invite</Button></>}
      >
        <div className="space-y-4">
          <Input label="Email address" type="email" placeholder="colleague@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} autoFocus />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <p className="text-xs text-gray-500">The user must already have a Connectly account to be added.</p>
        </div>
      </Modal>
    </AppLayout>
  );
}
