import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useAuthStore } from '../store/auth';
import { useWorkspaceStore } from '../store/workspace';
import { authApi, savedResponsesApi, customFieldsApi, templatesApi, outboundWebhooksApi, channelsApi } from '../api/client';
import { SavedResponse, CustomField, WhatsAppTemplate, OutboundWebhook, Channel } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Avatar from '../components/ui/Avatar';
import { PlusIcon, PencilIcon, TrashIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

const WEBHOOK_EVENTS = [
  'conversation.created', 'conversation.resolved', 'conversation.assigned',
  'message.received', 'message.sent', 'contact.created',
];

export default function Settings() {
  const { user, updateUser } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const [profile, setProfile] = useState({ name: user?.name || '', avatar: user?.avatar || '' });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [tab, setTab] = useState<'profile' | 'password' | 'notifications' | 'saved-responses' | 'custom-fields' | 'templates' | 'webhooks'>('profile');

  // Saved responses
  const [responses, setResponses] = useState<SavedResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', content: '', category: '' });
  const [savingResponse, setSavingResponse] = useState(false);

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [cfForm, setCfForm] = useState({ name: '', type: 'text', options: '' });
  const [showCfForm, setShowCfForm] = useState(false);
  const [savingCf, setSavingCf] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [tplForm, setTplForm] = useState({ name: '', content: '', language: 'en', category: 'MARKETING', channelId: '' });
  const [showTplForm, setShowTplForm] = useState(false);
  const [editingTplId, setEditingTplId] = useState<string | null>(null);
  const [savingTpl, setSavingTpl] = useState(false);

  // Webhooks
  const [webhooks, setWebhooks] = useState<OutboundWebhook[]>([]);
  const [whkForm, setWhkForm] = useState({ name: '', url: '', events: [] as string[], secret: '' });
  const [showWhkForm, setShowWhkForm] = useState(false);
  const [savingWhk, setSavingWhk] = useState(false);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileMsg('');
    try {
      const { data } = await authApi.updateMe(profile);
      updateUser(data);
      setProfileMsg('✅ Profile updated successfully');
    } catch (err: any) {
      setProfileMsg('❌ ' + (err.response?.data?.error || 'Failed to update profile'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      setPasswordMsg('❌ Passwords do not match');
      return;
    }
    if (passwords.new.length < 6) {
      setPasswordMsg('❌ Password must be at least 6 characters');
      return;
    }
    setSavingPassword(true);
    setPasswordMsg('');
    try {
      await authApi.changePassword(passwords.current, passwords.new);
      setPasswords({ current: '', new: '', confirm: '' });
      setPasswordMsg('✅ Password changed successfully');
    } catch (err: any) {
      setPasswordMsg('❌ ' + (err.response?.data?.error || 'Failed to change password'));
    } finally {
      setSavingPassword(false);
    }
  };

  const loadResponses = async () => {
    if (!currentWorkspace) return;
    setLoadingResponses(true);
    try {
      const { data } = await savedResponsesApi.list(currentWorkspace.id);
      setResponses(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingResponses(false);
    }
  };

  useEffect(() => {
    if (!currentWorkspace) return;
    if (tab === 'saved-responses') loadResponses();
    if (tab === 'custom-fields') {
      customFieldsApi.list(currentWorkspace.id).then(({ data }) => setCustomFields(data)).catch(console.error);
    }
    if (tab === 'templates') {
      templatesApi.list(currentWorkspace.id).then(({ data }) => setTemplates(data)).catch(console.error);
      channelsApi.list(currentWorkspace.id).then(({ data }) => setChannels(data)).catch(console.error);
    }
    if (tab === 'webhooks') {
      outboundWebhooksApi.list(currentWorkspace.id).then(({ data }) => setWebhooks(data)).catch(console.error);
    }
  }, [tab, currentWorkspace]);

  const resetForm = () => {
    setFormData({ title: '', content: '', category: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSaveResponse = async () => {
    if (!currentWorkspace || !formData.title.trim() || !formData.content.trim()) return;
    setSavingResponse(true);
    try {
      if (editingId) {
        const { data } = await savedResponsesApi.update(currentWorkspace.id, editingId, formData);
        setResponses(prev => prev.map(r => r.id === editingId ? data : r));
      } else {
        const { data } = await savedResponsesApi.create(currentWorkspace.id, formData);
        setResponses(prev => [...prev, data]);
      }
      resetForm();
    } finally {
      setSavingResponse(false);
    }
  };

  const handleEdit = (r: SavedResponse) => {
    setFormData({ title: r.title, content: r.content, category: r.category || '' });
    setEditingId(r.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!currentWorkspace) return;
    await savedResponsesApi.delete(currentWorkspace.id, id);
    setResponses(prev => prev.filter(r => r.id !== id));
  };

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'password', label: 'Password' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'saved-responses', label: 'Saved Responses' },
    { key: 'custom-fields', label: 'Custom Fields' },
    { key: 'templates', label: 'WA Templates' },
    { key: 'webhooks', label: 'Webhooks' },
  ] as const;

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Manage your account preferences</p>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="w-56 border-r border-gray-100 bg-white p-4 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${tab === key ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8">
            {tab === 'profile' && (
              <div className="max-w-lg">
                <h2 className="text-base font-semibold text-gray-900 mb-6">Profile Information</h2>
                <div className="flex items-center gap-4 mb-6">
                  {user && <Avatar name={user.name} src={user.avatar} size="xl" />}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <Input
                    label="Full name"
                    value={profile.name}
                    onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  />
                  <Input
                    label="Avatar URL (optional)"
                    placeholder="https://example.com/avatar.jpg"
                    value={profile.avatar}
                    onChange={(e) => setProfile((p) => ({ ...p, avatar: e.target.value }))}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                    <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 bg-gray-50" value={user?.email || ''} disabled />
                    <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                  </div>
                  {profileMsg && (
                    <p className={`text-sm ${profileMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{profileMsg}</p>
                  )}
                  <Button onClick={handleSaveProfile} loading={savingProfile}>Save Profile</Button>
                </div>
              </div>
            )}

            {tab === 'password' && (
              <div className="max-w-lg">
                <h2 className="text-base font-semibold text-gray-900 mb-6">Change Password</h2>
                <div className="space-y-4">
                  <Input
                    label="Current password"
                    type="password"
                    placeholder="••••••••"
                    value={passwords.current}
                    onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
                  />
                  <Input
                    label="New password"
                    type="password"
                    placeholder="Min. 6 characters"
                    value={passwords.new}
                    onChange={(e) => setPasswords((p) => ({ ...p, new: e.target.value }))}
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    placeholder="Repeat your new password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                  />
                  {passwordMsg && (
                    <p className={`text-sm ${passwordMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{passwordMsg}</p>
                  )}
                  <Button onClick={handleChangePassword} loading={savingPassword}>Change Password</Button>
                </div>
              </div>
            )}

            {tab === 'notifications' && (
              <div className="max-w-lg">
                <h2 className="text-base font-semibold text-gray-900 mb-6">Notification Preferences</h2>
                <div className="space-y-4">
                  {[
                    { label: 'New message notifications', desc: 'Get notified when you receive a new message' },
                    { label: 'Conversation assignments', desc: 'Get notified when a conversation is assigned to you' },
                    { label: 'Browser notifications', desc: 'Show desktop browser notifications' },
                  ].map(({ label, desc }) => (
                    <div key={label} className="flex items-start justify-between p-4 bg-white border border-gray-100 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                      </div>
                      <button className="relative w-10 h-5 bg-primary-500 rounded-full flex-shrink-0 ml-4 mt-0.5">
                        <span className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" />
                      </button>
                    </div>
                  ))}
                  <Button>Save Preferences</Button>
                </div>
              </div>
            )}

            {tab === 'saved-responses' && (
              <div className="max-w-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Saved Responses</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Pre-written messages your team can insert with one click (⚡ in the chat input)</p>
                  </div>
                  <Button
                    size="sm"
                    icon={<PlusIcon className="w-4 h-4" />}
                    onClick={() => { resetForm(); setShowForm(true); }}
                  >
                    New Response
                  </Button>
                </div>

                {/* Create/Edit form */}
                {showForm && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                      {editingId ? 'Edit Response' : 'New Saved Response'}
                    </h3>
                    <div className="space-y-3">
                      <Input
                        label="Title (shown in the picker)"
                        placeholder="e.g. Welcome message"
                        value={formData.title}
                        onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                      />
                      <Input
                        label="Category (optional)"
                        placeholder="e.g. Support, Sales, Billing"
                        value={formData.category}
                        onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}
                      />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Message content</label>
                        <textarea
                          value={formData.content}
                          onChange={e => setFormData(f => ({ ...f, content: e.target.value }))}
                          placeholder="Write the full message that will be inserted..."
                          rows={4}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveResponse}
                          loading={savingResponse}
                          disabled={!formData.title.trim() || !formData.content.trim()}
                        >
                          {editingId ? 'Save Changes' : 'Create Response'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={resetForm}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Responses list */}
                {loadingResponses ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : responses.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
                    <p className="text-gray-500 text-sm font-medium">No saved responses yet</p>
                    <p className="text-gray-400 text-xs mt-1">Create your first one to speed up replies</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {responses.map((r) => (
                      <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{r.title}</p>
                            {r.category && (
                              <span className="text-[11px] bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full flex-shrink-0">
                                {r.category}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleEdit(r)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                              title="Edit"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Custom Fields */}
            {tab === 'custom-fields' && (
              <div className="max-w-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Custom Contact Fields</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Add extra fields that appear in the contact panel for every conversation</p>
                  </div>
                  <Button size="sm" icon={<PlusIcon className="w-4 h-4" />} onClick={() => setShowCfForm(true)}>Add Field</Button>
                </div>
                {showCfForm && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">New Custom Field</h3>
                    <div className="space-y-3">
                      <Input label="Field name" placeholder="e.g. Order ID" value={cfForm.name} onChange={e => setCfForm(f => ({ ...f, name: e.target.value }))} />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select value={cfForm.type} onChange={e => setCfForm(f => ({ ...f, type: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="select">Select (dropdown)</option>
                        </select>
                      </div>
                      {cfForm.type === 'select' && (
                        <Input label="Options (comma-separated)" placeholder="Option A, Option B, Option C"
                          value={cfForm.options} onChange={e => setCfForm(f => ({ ...f, options: e.target.value }))} />
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" loading={savingCf} disabled={!cfForm.name.trim()} onClick={async () => {
                          if (!currentWorkspace) return;
                          setSavingCf(true);
                          try {
                            const options = cfForm.type === 'select' ? cfForm.options.split(',').map(s => s.trim()).filter(Boolean) : undefined;
                            const { data } = await customFieldsApi.create(currentWorkspace.id, { name: cfForm.name, type: cfForm.type, options });
                            setCustomFields(prev => [...prev, data]);
                            setCfForm({ name: '', type: 'text', options: '' });
                            setShowCfForm(false);
                          } finally { setSavingCf(false); }
                        }}>Create Field</Button>
                        <Button size="sm" variant="outline" onClick={() => setShowCfForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                )}
                {customFields.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">No custom fields yet</div>
                ) : (
                  <div className="space-y-2">
                    {customFields.map(f => (
                      <div key={f.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{f.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{f.type}{f.options ? ` · ${JSON.parse(f.options).join(', ')}` : ''}</p>
                        </div>
                        <button onClick={async () => {
                          if (!currentWorkspace) return;
                          await customFieldsApi.delete(currentWorkspace.id, f.id);
                          setCustomFields(prev => prev.filter(x => x.id !== f.id));
                        }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* WhatsApp Templates */}
            {tab === 'templates' && (
              <div className="max-w-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">WhatsApp Templates</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Pre-approved message templates for proactive outreach</p>
                  </div>
                  <Button size="sm" icon={<PlusIcon className="w-4 h-4" />} onClick={() => { setEditingTplId(null); setTplForm({ name: '', content: '', language: 'en', category: 'MARKETING', channelId: '' }); setShowTplForm(true); }}>New Template</Button>
                </div>
                {showTplForm && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">{editingTplId ? 'Edit Template' : 'New Template'}</h3>
                    <div className="space-y-3">
                      <Input label="Template name" placeholder="welcome_message" value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Message content</label>
                        <textarea value={tplForm.content} onChange={e => setTplForm(f => ({ ...f, content: e.target.value }))}
                          placeholder="Hello {{1}}, your order {{2}} is ready!" rows={4}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                        <p className="text-xs text-gray-400 mt-1">Use {'{{1}}'}, {'{{2}}'} for variables</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                          <select value={tplForm.category} onChange={e => setTplForm(f => ({ ...f, category: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                            <option value="MARKETING">Marketing</option>
                            <option value="UTILITY">Utility</option>
                            <option value="AUTHENTICATION">Authentication</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                          <select value={tplForm.channelId} onChange={e => setTplForm(f => ({ ...f, channelId: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                            <option value="">Any channel</option>
                            {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" loading={savingTpl} disabled={!tplForm.name.trim() || !tplForm.content.trim()} onClick={async () => {
                          if (!currentWorkspace) return;
                          setSavingTpl(true);
                          try {
                            if (editingTplId) {
                              const { data } = await templatesApi.update(currentWorkspace.id, editingTplId, tplForm);
                              setTemplates(prev => prev.map(t => t.id === editingTplId ? data : t));
                            } else {
                              const { data } = await templatesApi.create(currentWorkspace.id, tplForm);
                              setTemplates(prev => [data, ...prev]);
                            }
                            setShowTplForm(false);
                          } finally { setSavingTpl(false); }
                        }}>{editingTplId ? 'Save Changes' : 'Create Template'}</Button>
                        <Button size="sm" variant="outline" onClick={() => setShowTplForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                )}
                {templates.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">No templates yet</div>
                ) : (
                  <div className="space-y-3">
                    {templates.map(t => (
                      <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              t.status === 'approved' ? 'bg-green-100 text-green-700' :
                              t.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{t.status}</span>
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{t.category}</span>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => { setEditingTplId(t.id); setTplForm({ name: t.name, content: t.content, language: t.language, category: t.category, channelId: t.channelId || '' }); setShowTplForm(true); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50"><PencilIcon className="w-4 h-4" /></button>
                            <button onClick={async () => {
                              if (!currentWorkspace) return;
                              await templatesApi.delete(currentWorkspace.id, t.id);
                              setTemplates(prev => prev.filter(x => x.id !== t.id));
                            }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><TrashIcon className="w-4 h-4" /></button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{t.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Outbound Webhooks */}
            {tab === 'webhooks' && (
              <div className="max-w-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Outbound Webhooks</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Send HTTP POST notifications to your systems when events occur</p>
                  </div>
                  <Button size="sm" icon={<PlusIcon className="w-4 h-4" />} onClick={() => { setWhkForm({ name: '', url: '', events: [], secret: '' }); setShowWhkForm(true); }}>Add Webhook</Button>
                </div>
                {showWhkForm && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">New Webhook</h3>
                    <div className="space-y-3">
                      <Input label="Name" placeholder="My Zapier Hook" value={whkForm.name} onChange={e => setWhkForm(f => ({ ...f, name: e.target.value }))} />
                      <Input label="URL" placeholder="https://hooks.zapier.com/..." value={whkForm.url} onChange={e => setWhkForm(f => ({ ...f, url: e.target.value }))} />
                      <Input label="Secret (optional)" placeholder="Used in X-Webhook-Secret header" value={whkForm.secret} onChange={e => setWhkForm(f => ({ ...f, secret: e.target.value }))} />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
                        <div className="grid grid-cols-2 gap-2">
                          {WEBHOOK_EVENTS.map(event => (
                            <label key={event} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                              <input type="checkbox" checked={whkForm.events.includes(event)}
                                onChange={e => setWhkForm(f => ({ ...f, events: e.target.checked ? [...f.events, event] : f.events.filter(x => x !== event) }))}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                              {event}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" loading={savingWhk} disabled={!whkForm.name || !whkForm.url || !whkForm.events.length} onClick={async () => {
                          if (!currentWorkspace) return;
                          setSavingWhk(true);
                          try {
                            const { data } = await outboundWebhooksApi.create(currentWorkspace.id, whkForm);
                            setWebhooks(prev => [data, ...prev]);
                            setShowWhkForm(false);
                          } finally { setSavingWhk(false); }
                        }}>Create Webhook</Button>
                        <Button size="sm" variant="outline" onClick={() => setShowWhkForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                )}
                {webhooks.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">No webhooks yet</div>
                ) : (
                  <div className="space-y-3">
                    {webhooks.map(w => (
                      <div key={w.id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <GlobeAltIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <p className="text-sm font-semibold text-gray-900">{w.name}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${w.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {w.active ? 'Active' : 'Paused'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{w.url}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {JSON.parse(w.events).map((e: string) => (
                                <span key={e} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{e}</span>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={async () => {
                              if (!currentWorkspace) return;
                              const { data } = await outboundWebhooksApi.update(currentWorkspace.id, w.id, { active: !w.active });
                              setWebhooks(prev => prev.map(x => x.id === w.id ? data : x));
                            }} className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${w.active ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}>
                              {w.active ? 'Pause' : 'Enable'}
                            </button>
                            <button onClick={async () => {
                              if (!currentWorkspace) return;
                              await outboundWebhooksApi.delete(currentWorkspace.id, w.id);
                              setWebhooks(prev => prev.filter(x => x.id !== w.id));
                            }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><TrashIcon className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
