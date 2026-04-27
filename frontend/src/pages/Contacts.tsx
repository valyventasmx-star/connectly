import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import { contactsApi, tagsApi, importApi, contactMergeApi, dedupApi } from '../api/client';
import { Contact } from '../types';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PhoneIcon,
  EnvelopeIcon,
  PencilIcon,
  TrashIcon,
  UserGroupIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  CheckIcon,
  ArrowsRightLeftIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

const EMPTY_FORM = { name: '', phone: '', email: '', company: '', notes: '' };

const LIFECYCLE_STAGES = [
  { value: 'new_lead', label: 'New Lead' },
  { value: 'hot_lead', label: 'Hot Lead' },
  { value: 'payment', label: 'Payment' },
  { value: 'customer', label: 'Customer' },
  { value: 'cold_lead', label: 'Cold Lead' },
];

const LIFECYCLE_COLORS: Record<string, string> = {
  new_lead: 'bg-blue-100 text-blue-700',
  hot_lead: 'bg-orange-100 text-orange-700',
  payment: 'bg-yellow-100 text-yellow-700',
  customer: 'bg-green-100 text-green-700',
  cold_lead: 'bg-gray-100 text-gray-600',
};

export default function Contacts() {
  const { currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);

  // Bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [bulkLifecycle, setBulkLifecycle] = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);

  // Merge contacts
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSecondaryId, setMergeSecondaryId] = useState('');
  const [merging, setMerging] = useState(false);

  // Deduplication
  const [showDedupModal, setShowDedupModal] = useState(false);
  const [dedupGroups, setDedupGroups] = useState<any[]>([]);
  const [dedupLoading, setDedupLoading] = useState(false);
  const [mergingDedup, setMergingDedup] = useState<string | null>(null);

  // CSV import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; created: number; updated: number; failed: number } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    if (currentWorkspace) load();
  }, [currentWorkspace, search]);

  const load = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const { data } = await contactsApi.list(currentWorkspace.id, { search, limit: 100 });
      setContacts(data.contacts);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', company: c.company || '', notes: c.notes || '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!currentWorkspace || !form.name) return;
    setSaving(true);
    try {
      if (editing) {
        const { data } = await contactsApi.update(currentWorkspace.id, editing.id, form);
        setContacts((prev) => prev.map((c) => (c.id === editing.id ? data : c)));
        if (selected?.id === editing.id) setSelected(data);
      } else {
        const { data } = await contactsApi.create(currentWorkspace.id, form);
        setContacts((prev) => [data, ...prev]);
        setTotal((t) => t + 1);
      }
      setShowForm(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Contact) => {
    if (!currentWorkspace || !confirm(`Delete contact "${c.name}"?`)) return;
    await contactsApi.delete(currentWorkspace.id, c.id);
    setContacts((prev) => prev.filter((x) => x.id !== c.id));
    setTotal((t) => t - 1);
    if (selected?.id === c.id) setSelected(null);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentWorkspace) return;
    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await importApi.csv(currentWorkspace.id, file);
      setImportResult(data);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const csv = 'name,phone,email,company,notes\nJohn Smith,+1 555 000 0001,john@example.com,Acme Corp,VIP customer\nJane Doe,+1 555 000 0002,jane@example.com,,';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'contacts_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Bulk actions
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map(c => c.id)));
    }
  };

  const bulkUpdateLifecycle = async (stage: string) => {
    if (!currentWorkspace || !stage || selectedIds.size === 0) return;
    setBulkWorking(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => contactsApi.update(currentWorkspace.id, id, { lifecycleStage: stage }))
      );
      setContacts(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, lifecycleStage: stage } : c));
      setSelectedIds(new Set());
      setShowBulkMenu(false);
    } catch (err) {
      alert('Bulk update failed');
    } finally {
      setBulkWorking(false);
    }
  };

  const bulkDelete = async () => {
    if (!currentWorkspace || selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} contact(s)?`)) return;
    setBulkWorking(true);
    try {
      await Promise.all(Array.from(selectedIds).map(id => contactsApi.delete(currentWorkspace.id, id)));
      setContacts(prev => prev.filter(c => !selectedIds.has(c.id)));
      setTotal(t => t - selectedIds.size);
      setSelectedIds(new Set());
    } catch (err) {
      alert('Bulk delete failed');
    } finally {
      setBulkWorking(false);
    }
  };

  const runDedup = async () => {
    if (!currentWorkspace) return;
    setDedupLoading(true);
    setShowDedupModal(true);
    try {
      const { data } = await dedupApi.findDuplicates(currentWorkspace.id);
      setDedupGroups(data.groups || []);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to find duplicates');
      setShowDedupModal(false);
    } finally {
      setDedupLoading(false);
    }
  };

  const handleDedupMerge = async (primaryId: string, secondaryId: string) => {
    if (!currentWorkspace) return;
    setMergingDedup(secondaryId);
    try {
      await contactMergeApi.merge(currentWorkspace.id, primaryId, secondaryId);
      // Remove the merged secondary from the group
      setDedupGroups(prev =>
        prev.map(g => ({ ...g, contacts: g.contacts.filter((c: any) => c.id !== secondaryId) }))
          .filter(g => g.contacts.length >= 2)
      );
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Merge failed');
    } finally {
      setMergingDedup(null);
    }
  };

  const handleMerge = async () => {
    if (!currentWorkspace || !selected || !mergeSecondaryId) return;
    setMerging(true);
    try {
      await contactMergeApi.merge(currentWorkspace.id, selected.id, mergeSecondaryId);
      setShowMergeModal(false);
      setMergeSecondaryId('');
      load(); // refresh list
      alert(`✅ Contacts merged. Secondary contact absorbed into ${selected.name}.`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  const f = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <AppLayout>
      <div className="flex flex-1 overflow-hidden flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Contacts</h1>
            <p className="text-sm text-gray-500">{total} total contacts</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {importResult && (
              <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                ✅ {importResult.created} created · {importResult.updated} updated{importResult.failed > 0 ? ` · ${importResult.failed} failed` : ''}
              </span>
            )}
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
            <Button variant="outline" size="sm" icon={<DocumentDuplicateIcon className="w-4 h-4" />} onClick={runDedup}>Find Duplicates</Button>
            <Button variant="outline" size="sm" icon={<ArrowDownTrayIcon className="w-4 h-4" />} onClick={downloadTemplate}>Template</Button>
            <Button variant="secondary" size="sm" icon={importing ? undefined : <ArrowUpTrayIcon className="w-4 h-4" />} loading={importing} onClick={() => fileInputRef.current?.click()}>Import CSV</Button>
            <Button icon={<PlusIcon className="w-4 h-4" />} onClick={openCreate}>Add Contact</Button>
          </div>
        </div>

        {/* Search + bulk bar */}
        <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-100 rounded-lg">
              <span className="text-xs font-medium text-primary-700">{selectedIds.size} selected</span>
              <div className="relative">
                <button
                  onClick={() => setShowBulkMenu(v => !v)}
                  className="text-xs bg-primary-600 text-white px-2.5 py-1 rounded-lg hover:bg-primary-700 transition-colors"
                  disabled={bulkWorking}
                >
                  Set stage ▾
                </button>
                {showBulkMenu && (
                  <div className="absolute top-8 left-0 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                    {LIFECYCLE_STAGES.map(s => (
                      <button key={s.value} onClick={() => bulkUpdateLifecycle(s.value)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={bulkDelete} disabled={bulkWorking}
                className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors">
                Delete
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700">
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
              </div>
            ) : contacts.length === 0 ? (
              <EmptyState
                icon={<UserGroupIcon className="w-8 h-8" />}
                title="No contacts yet"
                description="Add your first contact or import from a CSV file"
                action={<Button icon={<PlusIcon className="w-4 h-4" />} onClick={openCreate}>Add Contact</Button>}
              />
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox"
                        checked={selectedIds.size === contacts.length && contacts.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </th>
                    {['Name', 'Phone', 'Email', 'Company', 'Stage', 'Added', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {contacts.map((c) => {
                    const isChecked = selectedIds.has(c.id);
                    const lcClass = LIFECYCLE_COLORS[c.lifecycleStage || ''] || 'bg-gray-100 text-gray-600';
                    return (
                      <tr
                        key={c.id}
                        className={`transition-colors ${isChecked ? 'bg-primary-50' : 'bg-white hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(c.id)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        </td>
                        <td className="px-4 py-4 cursor-pointer" onClick={() => setSelected(c)}>
                          <div className="flex items-center gap-3">
                            <Avatar name={c.name} size="sm" />
                            <span className="text-sm font-medium text-gray-900">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">{c.phone || '—'}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{c.email || '—'}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{c.company || '—'}</td>
                        <td className="px-4 py-4">
                          {c.lifecycleStage ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lcClass}`}>
                              {c.lifecycleStage.replace('_', ' ')}
                            </span>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-400">
                          {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <button onClick={() => navigate(`/contacts/${c.id}`)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-primary-600" title="View detail">
                              <EyeIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setSelected(c); setShowMergeModal(true); }} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600" title="Merge contact">
                              <ArrowsRightLeftIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(c)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-64 border-l border-gray-100 bg-white overflow-y-auto flex-shrink-0">
              <div className="p-5 border-b border-gray-100 text-center">
                <Avatar name={selected.name} size="xl" className="mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900">{selected.name}</h3>
                {selected.company && <p className="text-sm text-gray-500">{selected.company}</p>}
                {selected.lifecycleStage && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${LIFECYCLE_COLORS[selected.lifecycleStage] || 'bg-gray-100 text-gray-600'}`}>
                    {selected.lifecycleStage.replace('_', ' ')}
                  </span>
                )}
              </div>
              <div className="p-4 space-y-3">
                {selected.phone && <div className="flex items-center gap-2 text-sm text-gray-600"><PhoneIcon className="w-4 h-4 text-gray-400" />{selected.phone}</div>}
                {selected.email && <div className="flex items-center gap-2 text-sm text-gray-600"><EnvelopeIcon className="w-4 h-4 text-gray-400" />{selected.email}</div>}
                {selected.notes && <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-xs text-gray-600">{selected.notes}</div>}
                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => navigate(`/contacts/${selected.id}`)}>
                    View
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 justify-center" icon={<PencilIcon className="w-3.5 h-3.5" />} onClick={() => openEdit(selected)}>Edit</Button>
                </div>
                <button onClick={() => setSelected(null)} className="w-full text-xs text-gray-400 hover:text-gray-600 mt-1">Close panel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Contact' : 'Add Contact'}
        footer={<><Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Add Contact'}</Button></>}
      >
        <div className="space-y-4">
          <Input label="Name *" placeholder="John Smith" value={form.name} onChange={f('name')} autoFocus />
          <Input label="Phone" placeholder="+1 555 000 0000" value={form.phone} onChange={f('phone')} />
          <Input label="Email" type="email" placeholder="john@example.com" value={form.email} onChange={f('email')} />
          <Input label="Company" placeholder="Acme Corp" value={form.company} onChange={f('company')} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="Add notes about this contact..."
              value={form.notes}
              onChange={f('notes')}
            />
          </div>
        </div>
      </Modal>

      {/* Deduplication Modal */}
      <Modal
        open={showDedupModal}
        onClose={() => setShowDedupModal(false)}
        title="Find Duplicate Contacts"
      >
        {dedupLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : dedupGroups.length === 0 ? (
          <div className="text-center py-10">
            <DocumentDuplicateIcon className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">No duplicates found!</p>
            <p className="text-xs text-gray-400 mt-1">All your contacts look unique.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <p className="text-xs text-gray-500">{dedupGroups.length} group{dedupGroups.length !== 1 ? 's' : ''} of potential duplicates found. The first contact in each group is the primary.</p>
            {dedupGroups.map((group, gi) => (
              <div key={gi} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Group {gi + 1}</span>
                  <span className="text-xs text-gray-400">matched by {group.matchKey === 'phone' ? 'phone number' : 'email'}</span>
                </div>
                {group.contacts.map((c: any, ci: number) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-3 border-t border-gray-50 first:border-0 bg-white">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={c.name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400 truncate">{c.phone || c.email || '—'}</p>
                      </div>
                      {ci === 0 && <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">Primary</span>}
                    </div>
                    {ci > 0 && (
                      <button
                        onClick={() => handleDedupMerge(group.contacts[0].id, c.id)}
                        disabled={mergingDedup === c.id}
                        className="text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 px-2.5 py-1 rounded-lg disabled:opacity-50 flex-shrink-0 ml-2"
                      >
                        {mergingDedup === c.id ? 'Merging…' : 'Merge into primary'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Merge Contact Modal */}
      <Modal
        open={showMergeModal}
        onClose={() => { setShowMergeModal(false); setMergeSecondaryId(''); }}
        title="Merge Contact"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowMergeModal(false); setMergeSecondaryId(''); }}>Cancel</Button>
            <Button onClick={handleMerge} loading={merging} disabled={!mergeSecondaryId}>Merge Contacts</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
            <strong>{selected?.name}</strong> will be the <strong>primary contact</strong>. All conversations from the secondary contact will be moved to them, and the secondary contact will be deleted.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Secondary contact to merge in</label>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={mergeSecondaryId}
              onChange={e => setMergeSecondaryId(e.target.value)}
            >
              <option value="">Select contact to merge in…</option>
              {contacts.filter(c => c.id !== selected?.id).map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `· ${c.phone}` : ''} {c.email ? `· ${c.email}` : ''}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-red-600">⚠️ This action cannot be undone. The secondary contact will be permanently deleted.</p>
        </div>
      </Modal>
    </AppLayout>
  );
}
