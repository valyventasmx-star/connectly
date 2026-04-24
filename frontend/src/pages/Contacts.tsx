import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import { contactsApi } from '../api/client';
import api from '../api/client';
import { Contact } from '../types';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PhoneIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  PencilIcon,
  TrashIcon,
  UserGroupIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

const EMPTY_FORM = { name: '', phone: '', email: '', company: '', notes: '' };

export default function Contacts() {
  const { currentWorkspace } = useWorkspaceStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);

  // CSV import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null);

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
      const csv = await file.text();
      const { data } = await api.post(`/workspaces/${currentWorkspace.id}/contacts/import`, { csv });
      setImportResult({ created: data.created, skipped: data.skipped });
      load(); // reload list
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
    a.href = url;
    a.download = 'contacts_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const f = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <AppLayout>
      <div className="flex flex-1 overflow-hidden">
        {/* Main list */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Contacts</h1>
              <p className="text-sm text-gray-500">{total} total contacts</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Import result toast */}
              {importResult && (
                <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                  ✅ {importResult.created} imported, {importResult.skipped} skipped
                </span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImport}
              />
              <Button
                variant="outline"
                size="sm"
                icon={<ArrowDownTrayIcon className="w-4 h-4" />}
                onClick={downloadTemplate}
                title="Download CSV template"
              >
                Template
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={importing ? undefined : <ArrowUpTrayIcon className="w-4 h-4" />}
                loading={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                Import CSV
              </Button>
              <Button icon={<PlusIcon className="w-4 h-4" />} onClick={openCreate}>
                Add Contact
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="px-6 py-3 bg-white border-b border-gray-100">
            <div className="relative max-w-sm">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

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
                    {['Name', 'Phone', 'Email', 'Company', 'Added', ''].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {contacts.map((c) => (
                    <tr
                      key={c.id}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${selected?.id === c.id ? 'bg-primary-50' : 'bg-white'}`}
                      onClick={() => setSelected(c)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} size="sm" />
                          <span className="text-sm font-medium text-gray-900">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.phone || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.email || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.company || '—'}</td>
                      <td className="px-6 py-4 text-xs text-gray-400">
                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(c); }} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 border-l border-gray-100 bg-white overflow-y-auto flex-shrink-0">
            <div className="p-5 border-b border-gray-100 text-center">
              <Avatar name={selected.name} size="xl" className="mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900">{selected.name}</h3>
              {selected.company && <p className="text-sm text-gray-500">{selected.company}</p>}
            </div>
            <div className="p-4 space-y-3">
              {selected.phone && <div className="flex items-center gap-2 text-sm text-gray-600"><PhoneIcon className="w-4 h-4 text-gray-400" />{selected.phone}</div>}
              {selected.email && <div className="flex items-center gap-2 text-sm text-gray-600"><EnvelopeIcon className="w-4 h-4 text-gray-400" />{selected.email}</div>}
              {selected.notes && <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-xs text-gray-600">{selected.notes}</div>}
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" size="sm" className="flex-1 justify-center" icon={<PencilIcon className="w-3.5 h-3.5" />} onClick={() => openEdit(selected)}>Edit</Button>
                <Button variant="outline" size="sm" className="flex-1 justify-center text-red-600 border-red-200 hover:bg-red-50" icon={<TrashIcon className="w-3.5 h-3.5" />} onClick={() => handleDelete(selected)}>Delete</Button>
              </div>
            </div>
          </div>
        )}
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
    </AppLayout>
  );
}
