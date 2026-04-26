import { useEffect, useState } from 'react';
import {
  PlusIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  TrashIcon,
  PencilIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import api from '../lib/api';
import { useStore } from '../store';

interface Template {
  id: string;
  name: string;
  content: string;
  language: string;
  category: string;
  status: string;
  channelId?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-600',
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const STATUS_ICONS: Record<string, JSX.Element> = {
  draft:    <DocumentTextIcon className="w-3.5 h-3.5" />,
  pending:  <ClockIcon        className="w-3.5 h-3.5" />,
  approved: <CheckCircleIcon  className="w-3.5 h-3.5" />,
  rejected: <XCircleIcon      className="w-3.5 h-3.5" />,
};

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const LANGUAGES  = [
  { code: 'es', label: 'Spanish' },
  { code: 'en', label: 'English' },
  { code: 'es_MX', label: 'Spanish (Mexico)' },
  { code: 'pt_BR', label: 'Portuguese (Brazil)' },
  { code: 'fr', label: 'French' },
];

export default function Templates() {
  const { currentWorkspace } = useStore();
  const [templates, setTemplates]   = useState<Template[]>([]);
  const [loading, setLoading]       = useState(true);
  const [syncing, setSyncing]       = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Template | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  // Form state
  const [name, setName]         = useState('');
  const [content, setContent]   = useState('');
  const [language, setLanguage] = useState('es');
  const [category, setCategory] = useState('MARKETING');
  const [saving, setSaving]     = useState(false);

  const wid = currentWorkspace?.id;

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function load() {
    if (!wid) return;
    try {
      const { data } = await api.get(`/workspaces/${wid}/templates`);
      setTemplates(data);
    } catch {
      showToast('Failed to load templates', false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [wid]);

  function openCreate() {
    setEditing(null);
    setName(''); setContent(''); setLanguage('es'); setCategory('MARKETING');
    setShowForm(true);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setName(t.name); setContent(t.content); setLanguage(t.language); setCategory(t.category);
    setShowForm(true);
  }

  async function handleSave() {
    if (!wid || !name.trim() || !content.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.patch(`/workspaces/${wid}/templates/${editing.id}`, {
          name, content, language, category,
        });
        setTemplates(prev => prev.map(t => t.id === editing.id ? data : t));
        showToast('Template updated');
      } else {
        const { data } = await api.post(`/workspaces/${wid}/templates`, {
          name, content, language, category,
        });
        setTemplates(prev => [data, ...prev]);
        showToast('Template created');
      }
      setShowForm(false);
    } catch {
      showToast('Save failed', false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(t: Template) {
    if (!wid) return;
    setSubmitting(t.id);
    try {
      const { data } = await api.post(`/workspaces/${wid}/templates/${t.id}/submit`);
      setTemplates(prev => prev.map(x => x.id === t.id ? data.template : x));
      showToast('Submitted to Meta for approval');
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Submission failed', false);
    } finally {
      setSubmitting(null);
    }
  }

  async function handleSync() {
    if (!wid) return;
    setSyncing(true);
    try {
      const { data } = await api.post(`/workspaces/${wid}/templates/sync`);
      showToast(`Synced ${data.synced} template(s) from Meta`);
      await load();
    } catch {
      showToast('Sync failed', false);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(id: string) {
    if (!wid || !confirm('Delete this template?')) return;
    setDeleting(id);
    try {
      await api.delete(`/workspaces/${wid}/templates/${id}`);
      setTemplates(prev => prev.filter(t => t.id !== id));
      showToast('Deleted');
    } catch {
      showToast('Delete failed', false);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">WhatsApp Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create message templates and submit them to Meta for approval</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync from Meta
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
          >
            <PlusIcon className="w-4 h-4" />
            New Template
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mx-6 mt-4 px-4 py-3 rounded-lg text-sm font-medium flex-shrink-0 ${toast.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {toast.msg}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <DocumentTextIcon className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-base font-medium text-gray-500">No templates yet</p>
            <p className="text-sm mt-1">Create your first WhatsApp message template</p>
            <button onClick={openCreate} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
              Create Template
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map(t => (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow">
                {/* Name + status */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight">{t.name}</h3>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLORS[t.status] ?? STATUS_COLORS.draft}`}>
                    {STATUS_ICONS[t.status] ?? STATUS_ICONS.draft}
                    {t.status}
                  </span>
                </div>

                {/* Meta info */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="bg-gray-100 px-2 py-0.5 rounded">{t.category}</span>
                  <span className="bg-gray-100 px-2 py-0.5 rounded">{t.language}</span>
                </div>

                {/* Content preview */}
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 bg-gray-50 rounded-lg p-3 font-mono text-xs">
                  {t.content}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                  {(t.status === 'draft' || t.status === 'rejected') && (
                    <button
                      onClick={() => handleSubmit(t)}
                      disabled={submitting === t.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <PaperAirplaneIcon className="w-3.5 h-3.5" />
                      {submitting === t.id ? 'Submitting…' : 'Submit to Meta'}
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(t)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Edit"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={deleting === t.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg ml-auto disabled:opacity-50"
                    title="Delete"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit Template' : 'New Template'}
              </h2>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. payment_confirmation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-gray-500">Lowercase letters, numbers, and underscores only</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message Body
                  <span className="text-gray-400 font-normal ml-1">(use {'{{1}}'} for variables)</span>
                </label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={5}
                  placeholder="Hi {{1}}, your order has been confirmed…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
                />
                <p className="mt-1 text-xs text-gray-500">{content.length} characters</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim() || !content.trim()}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Template')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
