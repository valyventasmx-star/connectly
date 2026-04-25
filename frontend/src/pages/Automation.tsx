import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import { automationApi } from '../api/client';
import { PlusIcon, TrashIcon, BoltIcon, PencilIcon } from '@heroicons/react/24/outline';

const TRIGGER_EVENTS = [
  { value: 'conversation.created', label: 'Conversation created' },
  { value: 'conversation.resolved', label: 'Conversation resolved' },
  { value: 'message.received', label: 'Message received (inbound)' },
  { value: 'message.sent', label: 'Message sent (outbound)' },
  { value: 'contact.created', label: 'Contact created' },
];

const ACTION_TYPES = [
  { value: 'assign_agent', label: 'Assign to agent' },
  { value: 'add_tag', label: 'Add tag to conversation' },
  { value: 'remove_tag', label: 'Remove tag from conversation' },
  { value: 'set_status', label: 'Set conversation status' },
  { value: 'set_lifecycle', label: 'Set contact lifecycle stage' },
  { value: 'send_message', label: 'Send auto-reply' },
  { value: 'add_note', label: 'Add internal note' },
  { value: 'send_webhook', label: 'Send webhook' },
];

const LIFECYCLE_STAGES = [
  { value: 'new_lead', label: 'New Lead' },
  { value: 'hot_lead', label: 'Hot Lead' },
  { value: 'payment', label: 'Payment' },
  { value: 'customer', label: 'Customer' },
  { value: 'cold_lead', label: 'Cold Lead' },
];

const CONDITION_FIELDS = [
  { value: 'contact.lifecycleStage', label: 'Contact lifecycle stage' },
  { value: 'contact.company', label: 'Contact company' },
  { value: 'channel.type', label: 'Channel type' },
  { value: 'status', label: 'Conversation status' },
];

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'is_set', label: 'is set' },
  { value: 'is_not_set', label: 'is not set' },
];

const emptyRule = () => ({
  name: '',
  description: '',
  trigger: { event: 'conversation.created', conditions: [] as any[] },
  actions: [{ type: 'send_message', message: '' }] as any[],
});

export default function Automation() {
  const { currentWorkspace } = useWorkspaceStore();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyRule());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    automationApi.list(currentWorkspace.id)
      .then(r => setRules(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentWorkspace]);

  const openCreate = () => { setEditing(null); setForm(emptyRule()); setShowForm(true); };
  const openEdit = (rule: any) => {
    setEditing(rule);
    setForm({ name: rule.name, description: rule.description || '', trigger: rule.trigger, actions: rule.actions });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!currentWorkspace || !form.name) return;
    setSaving(true);
    try {
      if (editing) {
        const { data } = await automationApi.update(currentWorkspace.id, editing.id, form);
        setRules(prev => prev.map(r => r.id === editing.id ? data : r));
      } else {
        const { data } = await automationApi.create(currentWorkspace.id, form);
        setRules(prev => [...prev, data]);
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: any) => {
    if (!currentWorkspace) return;
    const { data } = await automationApi.update(currentWorkspace.id, rule.id, { active: !rule.active });
    setRules(prev => prev.map(r => r.id === rule.id ? data : r));
  };

  const deleteRule = async (id: string) => {
    if (!currentWorkspace || !confirm('Delete this rule?')) return;
    await automationApi.delete(currentWorkspace.id, id);
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const addCondition = () => setForm(f => ({ ...f, trigger: { ...f.trigger, conditions: [...f.trigger.conditions, { field: 'status', operator: 'equals', value: '' }] } }));
  const removeCondition = (i: number) => setForm(f => ({ ...f, trigger: { ...f.trigger, conditions: f.trigger.conditions.filter((_: any, idx: number) => idx !== i) } }));
  const updateCondition = (i: number, key: string, val: string) => setForm(f => ({ ...f, trigger: { ...f.trigger, conditions: f.trigger.conditions.map((c: any, idx: number) => idx === i ? { ...c, [key]: val } : c) } }));

  const addAction = () => setForm(f => ({ ...f, actions: [...f.actions, { type: 'send_message', message: '' }] }));
  const removeAction = (i: number) => setForm(f => ({ ...f, actions: f.actions.filter((_: any, idx: number) => idx !== i) }));
  const updateAction = (i: number, val: any) => setForm(f => ({ ...f, actions: f.actions.map((a: any, idx: number) => idx === i ? val : a) }));

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Automation Rules</h1>
            <p className="text-sm text-gray-500">Automate repetitive tasks with trigger → action workflows</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors">
            <PlusIcon className="w-4 h-4" /> New Rule
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
          ) : !showForm && rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
                <BoltIcon className="w-8 h-8 text-primary-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">No automation rules yet</h3>
              <p className="text-sm text-gray-500 mb-4 max-w-sm">Automatically assign conversations, send replies, update lifecycle stages, and more.</p>
              <button onClick={openCreate} className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700">Create your first rule</button>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl">
              {/* Rule form */}
              {showForm && (
                <div className="bg-white border-2 border-primary-100 rounded-2xl p-6 space-y-6">
                  <h3 className="text-base font-semibold text-gray-900">{editing ? 'Edit Rule' : 'New Automation Rule'}</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rule name *</label>
                      <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="e.g. Auto-assign Sales conversations"
                        value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                      <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="What does this rule do?"
                        value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>

                  {/* Trigger */}
                  <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">⚡ Trigger</p>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">When this event happens</label>
                      <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                        value={form.trigger.event}
                        onChange={e => setForm(f => ({ ...f, trigger: { ...f.trigger, event: e.target.value } }))}>
                        {TRIGGER_EVENTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>

                    {/* Conditions */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-600">Conditions (all must match)</label>
                        <button onClick={addCondition} className="text-xs text-blue-600 hover:underline">+ Add condition</button>
                      </div>
                      {form.trigger.conditions.length === 0 && (
                        <p className="text-xs text-gray-400 italic">No conditions — rule runs on every event</p>
                      )}
                      {form.trigger.conditions.map((cond: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 mb-2">
                          <select className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                            value={cond.field} onChange={e => updateCondition(i, 'field', e.target.value)}>
                            {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                          <select className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                            value={cond.operator} onChange={e => updateCondition(i, 'operator', e.target.value)}>
                            {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          {!['is_set', 'is_not_set'].includes(cond.operator) && (
                            <input className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                              placeholder="value" value={cond.value}
                              onChange={e => updateCondition(i, 'value', e.target.value)} />
                          )}
                          <button onClick={() => removeCondition(i)} className="text-red-400 hover:text-red-600"><TrashIcon className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="bg-green-50 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">🎯 Actions (run in order)</p>
                    {form.actions.map((action: any, i: number) => (
                      <div key={i} className="bg-white rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <select className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                            value={action.type}
                            onChange={e => updateAction(i, { type: e.target.value })}>
                            {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                          </select>
                          {form.actions.length > 1 && (
                            <button onClick={() => removeAction(i)} className="text-red-400 hover:text-red-600 flex-shrink-0"><TrashIcon className="w-4 h-4" /></button>
                          )}
                        </div>

                        {action.type === 'send_message' && (
                          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" rows={2}
                            placeholder="Message to send automatically..."
                            value={action.message || ''} onChange={e => updateAction(i, { ...action, message: e.target.value })} />
                        )}
                        {action.type === 'add_note' && (
                          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" rows={2}
                            placeholder="Internal note content..."
                            value={action.note || ''} onChange={e => updateAction(i, { ...action, note: e.target.value })} />
                        )}
                        {action.type === 'set_lifecycle' && (
                          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                            value={action.stage || ''}
                            onChange={e => updateAction(i, { ...action, stage: e.target.value })}>
                            <option value="">Select stage...</option>
                            {LIFECYCLE_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        )}
                        {action.type === 'set_status' && (
                          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                            value={action.status || ''}
                            onChange={e => updateAction(i, { ...action, status: e.target.value })}>
                            <option value="">Select status...</option>
                            <option value="open">Open</option>
                            <option value="resolved">Resolved</option>
                            <option value="pending">Pending</option>
                          </select>
                        )}
                        {(action.type === 'assign_agent') && (
                          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                            placeholder="Agent user ID"
                            value={action.agentId || ''} onChange={e => updateAction(i, { ...action, agentId: e.target.value })} />
                        )}
                        {(action.type === 'add_tag' || action.type === 'remove_tag') && (
                          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                            placeholder="Tag ID"
                            value={action.tagId || ''} onChange={e => updateAction(i, { ...action, tagId: e.target.value })} />
                        )}
                        {action.type === 'send_webhook' && (
                          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                            placeholder="https://your-webhook-url.com/hook"
                            value={action.url || ''} onChange={e => updateAction(i, { ...action, url: e.target.value })} />
                        )}
                      </div>
                    ))}
                    <button onClick={addAction} className="text-sm text-green-700 hover:underline font-medium">+ Add another action</button>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={handleSave} disabled={saving || !form.name}
                      className="bg-primary-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
                      {saving ? 'Saving…' : editing ? 'Update Rule' : 'Create Rule'}
                    </button>
                    <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl border border-gray-200">Cancel</button>
                  </div>
                </div>
              )}

              {/* Rules list */}
              {rules.map(rule => (
                <div key={rule.id} className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${rule.active ? 'bg-green-400' : 'bg-gray-300'}`} />
                        <h4 className="text-sm font-semibold text-gray-900">{rule.name}</h4>
                        {rule.runCount > 0 && (
                          <span className="text-[10px] bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full font-medium">{rule.runCount} runs</span>
                        )}
                      </div>
                      {rule.description && <p className="text-xs text-gray-500 mb-2">{rule.description}</p>}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          ⚡ {TRIGGER_EVENTS.find(t => t.value === rule.trigger?.event)?.label || rule.trigger?.event}
                        </span>
                        {(rule.actions || []).map((a: any, i: number) => (
                          <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                            → {ACTION_TYPES.find(t => t.value === a.type)?.label || a.type}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => toggleActive(rule)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${rule.active ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                        {rule.active ? 'Pause' : 'Enable'}
                      </button>
                      <button onClick={() => openEdit(rule)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"><PencilIcon className="w-4 h-4" /></button>
                      <button onClick={() => deleteRule(rule.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
