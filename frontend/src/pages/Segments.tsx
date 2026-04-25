import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import { segmentsApi } from '../api/client';
import { PlusIcon, TrashIcon, UserGroupIcon, PencilIcon, FunnelIcon } from '@heroicons/react/24/outline';

const FIELDS = [
  { value: 'lifecycleStage', label: 'Lifecycle stage' },
  { value: 'company', label: 'Company' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'name', label: 'Name' },
];

const OPERATORS = [
  { value: 'equals', label: '= equals' },
  { value: 'not_equals', label: '≠ not equals' },
  { value: 'contains', label: '~ contains' },
  { value: 'is_set', label: '✓ is set' },
  { value: 'is_not_set', label: '✗ is not set' },
];

const LIFECYCLE_VALUES = [
  { value: 'new_lead', label: 'New Lead' },
  { value: 'hot_lead', label: 'Hot Lead' },
  { value: 'payment', label: 'Payment' },
  { value: 'customer', label: 'Customer' },
  { value: 'cold_lead', label: 'Cold Lead' },
];

const PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const emptyFilter = () => ({ field: 'lifecycleStage', operator: 'equals', value: '' });

export default function Segments() {
  const { currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', color: PALETTE[0], filters: [emptyFilter()] });
  const [preview, setPreview] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    segmentsApi.list(currentWorkspace.id).then(r => setSegments(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [currentWorkspace]);

  const previewCount = async () => {
    if (!currentWorkspace) return;
    const { data } = await segmentsApi.preview(currentWorkspace.id, form.filters);
    setPreview(data.count);
  };

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', color: PALETTE[0], filters: [emptyFilter()] }); setPreview(null); setShowForm(true); };
  const openEdit = (seg: any) => { setEditing(seg); setForm({ name: seg.name, description: seg.description || '', color: seg.color, filters: seg.filters }); setPreview(null); setShowForm(true); };

  const handleSave = async () => {
    if (!currentWorkspace || !form.name) return;
    setSaving(true);
    try {
      if (editing) {
        const { data } = await segmentsApi.update(currentWorkspace.id, editing.id, form);
        setSegments(prev => prev.map(s => s.id === editing.id ? data : s));
      } else {
        const { data } = await segmentsApi.create(currentWorkspace.id, form);
        setSegments(prev => [...prev, data]);
      }
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const deleteSegment = async (id: string) => {
    if (!currentWorkspace || !confirm('Delete this segment?')) return;
    await segmentsApi.delete(currentWorkspace.id, id);
    setSegments(prev => prev.filter(s => s.id !== id));
  };

  const updateFilter = (i: number, key: string, val: string) =>
    setForm(f => ({ ...f, filters: f.filters.map((fl, idx) => idx === i ? { ...fl, [key]: val } : fl) }));

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Contact Segments</h1>
            <p className="text-sm text-gray-500">Save dynamic contact groups based on filters</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700">
            <PlusIcon className="w-4 h-4" /> New Segment
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
          ) : (
            <div className="max-w-3xl space-y-4">
              {/* Form */}
              {showForm && (
                <div className="bg-white border-2 border-primary-100 rounded-2xl p-6 space-y-5">
                  <h3 className="text-base font-semibold text-gray-900">{editing ? 'Edit Segment' : 'New Segment'}</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="e.g. Hot leads without email"
                        value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Optional description"
                        value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                    <div className="flex gap-2">
                      {PALETTE.map(c => (
                        <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                          className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Filters</label>
                      <button onClick={() => setForm(f => ({ ...f, filters: [...f.filters, emptyFilter()] }))}
                        className="text-xs text-primary-600 hover:underline">+ Add filter</button>
                    </div>
                    {form.filters.map((fl, i) => (
                      <div key={i} className="flex items-center gap-2 mb-2">
                        <select className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                          value={fl.field} onChange={e => updateFilter(i, 'field', e.target.value)}>
                          {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                        <select className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                          value={fl.operator} onChange={e => updateFilter(i, 'operator', e.target.value)}>
                          {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {!['is_set', 'is_not_set'].includes(fl.operator) && (
                          fl.field === 'lifecycleStage' ? (
                            <select className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                              value={fl.value} onChange={e => updateFilter(i, 'value', e.target.value)}>
                              <option value="">Select...</option>
                              {LIFECYCLE_VALUES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                            </select>
                          ) : (
                            <input className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                              placeholder="value" value={fl.value} onChange={e => updateFilter(i, 'value', e.target.value)} />
                          )
                        )}
                        {form.filters.length > 1 && (
                          <button onClick={() => setForm(f => ({ ...f, filters: f.filters.filter((_, idx) => idx !== i) }))}
                            className="text-red-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
                        )}
                      </div>
                    ))}
                    <button onClick={previewCount} className="text-xs text-primary-600 hover:underline mt-1">
                      Preview count
                    </button>
                    {preview !== null && (
                      <span className="ml-2 text-xs font-semibold text-primary-700">{preview} contacts match</span>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={handleSave} disabled={saving || !form.name}
                      className="bg-primary-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                      {saving ? 'Saving…' : editing ? 'Update' : 'Create Segment'}
                    </button>
                    <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl border border-gray-200">Cancel</button>
                  </div>
                </div>
              )}

              {/* Segments list */}
              {segments.length === 0 && !showForm ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
                    <FunnelIcon className="w-8 h-8 text-primary-400" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">No segments yet</h3>
                  <p className="text-sm text-gray-500 mb-4 max-w-sm">Create dynamic contact groups to target specific contacts for broadcasts or analysis.</p>
                  <button onClick={openCreate} className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700">Create first segment</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {segments.map(seg => (
                    <div key={seg.id} className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                          <h4 className="text-sm font-semibold text-gray-900">{seg.name}</h4>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => navigate(`/segments/${seg.id}`)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-primary-600"><UserGroupIcon className="w-4 h-4" /></button>
                          <button onClick={() => openEdit(seg)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"><PencilIcon className="w-4 h-4" /></button>
                          <button onClick={() => deleteSegment(seg.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                      </div>
                      {seg.description && <p className="text-xs text-gray-500 mb-2">{seg.description}</p>}
                      <div className="flex flex-wrap gap-1">
                        {(seg.filters || []).map((f: any, i: number) => (
                          <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {f.field} {f.operator} {f.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
