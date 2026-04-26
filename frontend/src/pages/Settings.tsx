import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useAuthStore } from '../store/auth';
import { useWorkspaceStore } from '../store/workspace';
import {
  authApi, savedResponsesApi, customFieldsApi, templatesApi, outboundWebhooksApi, channelsApi,
  apiKeysApi, auditLogApi, autoAssignApi, workspacesApi, twoFactorApi, brandingApi,
} from '../api/client';
import { SavedResponse, CustomField, WhatsAppTemplate, OutboundWebhook, Channel } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Avatar from '../components/ui/Avatar';
import { PlusIcon, PencilIcon, TrashIcon, GlobeAltIcon, ClipboardDocumentIcon, KeyIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';

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
  const [tab, setTab] = useState<'profile' | 'password' | '2fa' | 'notifications' | 'saved-responses' | 'custom-fields' | 'templates' | 'webhooks' | 'api-keys' | 'audit-log' | 'auto-assign' | 'business-hours' | 'branding' | 'usage' | 'members'>('profile');

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

  // API Keys
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);

  // Audit log
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Members / Roles
  const [membersData, setMembersData] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);

  // Auto-assign rules
  const [autoRules, setAutoRules] = useState<any[]>([]);
  const [ruleForm, setRuleForm] = useState({ name: '', strategy: 'round_robin', assigneeIds: '' });
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [members, setMembers] = useState<any[]>([]);

  // Business hours / SLA
  const [slaHours, setSlaHours] = useState(24);
  const [savingSla, setSavingSla] = useState(false);

  // Business hours
  const [oooEnabled, setOooEnabled] = useState(false);
  const [oooMessage, setOooMessage] = useState('We are currently away. We will get back to you during business hours.');
  const [businessHours, setBusinessHours] = useState<any[]>([
    { day: 1, label: 'Mon', start: '09:00', end: '18:00', enabled: true },
    { day: 2, label: 'Tue', start: '09:00', end: '18:00', enabled: true },
    { day: 3, label: 'Wed', start: '09:00', end: '18:00', enabled: true },
    { day: 4, label: 'Thu', start: '09:00', end: '18:00', enabled: true },
    { day: 5, label: 'Fri', start: '09:00', end: '18:00', enabled: true },
    { day: 6, label: 'Sat', start: '10:00', end: '15:00', enabled: false },
    { day: 0, label: 'Sun', start: '10:00', end: '15:00', enabled: false },
  ]);
  const [savingBh, setSavingBh] = useState(false);

  // Branding
  const [branding, setBranding] = useState({ brandingName: '', brandingLogo: '', brandingColor: '#6366f1' });
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingMsg, setBrandingMsg] = useState('');

  // Usage
  const [usage, setUsage] = useState<any>(null);

  // 2FA
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaQr, setTwoFaQr] = useState<string | null>(null);
  const [twoFaToken, setTwoFaToken] = useState('');
  const [twoFaMsg, setTwoFaMsg] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaDisableToken, setTwoFaDisableToken] = useState('');

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
    if (tab === 'api-keys') {
      apiKeysApi.list(currentWorkspace.id).then(({ data }) => setApiKeys(data)).catch(console.error);
    }
    if (tab === 'audit-log') {
      setAuditLoading(true);
      auditLogApi.list(currentWorkspace.id).then(({ data }) => setAuditLogs(data.logs || [])).catch(console.error).finally(() => setAuditLoading(false));
    }
    if (tab === 'auto-assign') {
      autoAssignApi.list(currentWorkspace.id).then(({ data }) => setAutoRules(data)).catch(console.error);
      workspacesApi.get(currentWorkspace.id).then(({ data }) => {
        // Get members via workspace
        setSlaHours(data.slaHours || 24);
      }).catch(console.error);
      // Load members
      import('../api/client').then(({ workspacesApi: wApi }) => {
        // members via workspaces API
      });
    }
    if (tab === 'business-hours') {
      workspacesApi.get(currentWorkspace.id).then(({ data }) => setSlaHours(data.slaHours || 24)).catch(console.error);
      brandingApi.get(currentWorkspace.id).then(({ data }) => {
        if (data?.oooEnabled !== undefined) setOooEnabled(data.oooEnabled);
        if (data?.oooMessage) setOooMessage(data.oooMessage);
        if (data?.businessHours) {
          try { const parsed = JSON.parse(data.businessHours); if (parsed.length) setBusinessHours(parsed); } catch {}
        }
      }).catch(console.error);
    }
    if (tab === 'branding') {
      brandingApi.get(currentWorkspace.id).then(({ data }) => {
        if (data) setBranding({ brandingName: data.brandingName || '', brandingLogo: data.brandingLogo || '', brandingColor: data.brandingColor || '#6366f1' });
      }).catch(console.error);
    }
    if (tab === 'usage') {
      brandingApi.getUsage(currentWorkspace.id).then(({ data }) => setUsage(data)).catch(console.error);
    }
    if (tab === 'members') {
      setMembersLoading(true);
      import('../api/client').then(({ default: api }) =>
        api.get(`/workspaces/${currentWorkspace.id}/members`)
          .then(({ data }) => setMembersData(data))
          .catch(console.error)
          .finally(() => setMembersLoading(false))
      );
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

  const createApiKey = async () => {
    if (!currentWorkspace || !newKeyName.trim()) return;
    setSavingKey(true);
    try {
      const { data } = await apiKeysApi.create(currentWorkspace.id, newKeyName.trim());
      setApiKeys(prev => [data, ...prev]);
      setCreatedKey(data.key);
      setNewKeyName('');
    } finally {
      setSavingKey(false);
    }
  };

  const deleteApiKey = async (id: string) => {
    if (!currentWorkspace || !confirm('Revoke this API key?')) return;
    await apiKeysApi.delete(currentWorkspace.id, id);
    setApiKeys(prev => prev.filter(k => k.id !== id));
  };

  const createAutoRule = async () => {
    if (!currentWorkspace || !ruleForm.name || !ruleForm.assigneeIds) return;
    setSavingRule(true);
    try {
      const assigneeIds = ruleForm.assigneeIds.split(',').map(s => s.trim()).filter(Boolean);
      const { data } = await autoAssignApi.create(currentWorkspace.id, { ...ruleForm, assigneeIds });
      setAutoRules(prev => [...prev, data]);
      setRuleForm({ name: '', strategy: 'round_robin', assigneeIds: '' });
      setShowRuleForm(false);
    } finally {
      setSavingRule(false);
    }
  };

  const saveSlaHours = async () => {
    if (!currentWorkspace) return;
    setSavingSla(true);
    try {
      await workspacesApi.update(currentWorkspace.id, { slaHours });
    } finally {
      setSavingSla(false);
    }
  };

  const saveBusinessHours = async () => {
    if (!currentWorkspace) return;
    setSavingBh(true);
    try {
      await brandingApi.updateBusinessHours(currentWorkspace.id, { businessHours, oooEnabled, oooMessage });
      await workspacesApi.update(currentWorkspace.id, { slaHours });
    } finally { setSavingBh(false); }
  };

  const saveBranding = async () => {
    if (!currentWorkspace) return;
    setSavingBranding(true);
    setBrandingMsg('');
    try {
      await brandingApi.updateBranding(currentWorkspace.id, branding);
      setBrandingMsg('✅ Branding saved');
    } catch (e: any) {
      setBrandingMsg('❌ ' + (e.response?.data?.error || 'Failed'));
    } finally { setSavingBranding(false); }
  };

  // Load 2FA status when tab is opened
  useEffect(() => {
    if (tab === '2fa') {
      twoFactorApi.status().then(({ data }) => setTwoFaEnabled(data.enabled)).catch(console.error);
    }
  }, [tab]);

  const setup2FA = async () => {
    setTwoFaLoading(true);
    setTwoFaMsg('');
    try {
      const { data } = await twoFactorApi.setup();
      setTwoFaQr(data.qrCode);
    } catch (e: any) {
      setTwoFaMsg('❌ ' + (e.response?.data?.error || 'Failed to set up 2FA'));
    } finally {
      setTwoFaLoading(false);
    }
  };

  const verify2FA = async () => {
    setTwoFaLoading(true);
    setTwoFaMsg('');
    try {
      await twoFactorApi.verify(twoFaToken);
      setTwoFaEnabled(true);
      setTwoFaQr(null);
      setTwoFaToken('');
      setTwoFaMsg('✅ Two-factor authentication enabled');
    } catch (e: any) {
      setTwoFaMsg('❌ ' + (e.response?.data?.error || 'Invalid code'));
    } finally {
      setTwoFaLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!twoFaDisableToken) return;
    setTwoFaLoading(true);
    setTwoFaMsg('');
    try {
      await twoFactorApi.disable(twoFaDisableToken);
      setTwoFaEnabled(false);
      setTwoFaDisableToken('');
      setTwoFaMsg('✅ Two-factor authentication disabled');
    } catch (e: any) {
      setTwoFaMsg('❌ ' + (e.response?.data?.error || 'Invalid code'));
    } finally {
      setTwoFaLoading(false);
    }
  };

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'password', label: 'Password' },
    { key: '2fa', label: '2FA Security' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'saved-responses', label: 'Saved Responses' },
    { key: 'custom-fields', label: 'Custom Fields' },
    { key: 'templates', label: 'WA Templates' },
    { key: 'webhooks', label: 'Webhooks' },
    { key: 'auto-assign', label: 'Auto-assign' },
    { key: 'business-hours', label: 'SLA & Hours' },
    { key: 'branding', label: 'White Label' },
    { key: 'usage', label: 'Usage' },
    { key: 'api-keys', label: 'API Keys' },
    { key: 'audit-log', label: 'Audit Log' },
    { key: 'members', label: 'Members & Roles' },
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
          <div className="w-56 border-r border-gray-100 bg-white p-4 flex-shrink-0 overflow-y-auto">
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

            {tab === '2fa' && (
              <div className="max-w-md">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Two-Factor Authentication</h2>
                <p className="text-sm text-gray-500 mb-6">Add an extra layer of security to your account using an authenticator app like Google Authenticator or Authy.</p>

                {twoFaEnabled ? (
                  <div>
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl mb-6">
                      <span className="text-2xl">🔒</span>
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">2FA is enabled</p>
                        <p className="text-xs text-emerald-600">Your account is protected with two-factor authentication.</p>
                      </div>
                    </div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Enter your current 6-digit code to disable</label>
                    <div className="flex gap-3">
                      <input
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                        placeholder="123456"
                        maxLength={6}
                        value={twoFaDisableToken}
                        onChange={e => setTwoFaDisableToken(e.target.value.replace(/\D/g, ''))}
                      />
                      <button onClick={disable2FA} disabled={twoFaLoading || twoFaDisableToken.length !== 6}
                        className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                        {twoFaLoading ? 'Disabling…' : 'Disable 2FA'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {!twoFaQr ? (
                      <div>
                        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-6">
                          <span className="text-2xl">⚠️</span>
                          <div>
                            <p className="text-sm font-semibold text-amber-800">2FA is not enabled</p>
                            <p className="text-xs text-amber-600">We recommend enabling 2FA to secure your account.</p>
                          </div>
                        </div>
                        <button onClick={setup2FA} disabled={twoFaLoading}
                          className="bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                          {twoFaLoading ? 'Setting up…' : 'Set up 2FA'}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-700 mb-4">Scan this QR code with your authenticator app, then enter the 6-digit code below to confirm.</p>
                        <div className="flex justify-center mb-4">
                          <img src={twoFaQr} alt="2FA QR Code" className="w-48 h-48 border border-gray-200 rounded-xl p-2" />
                        </div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Verification code</label>
                        <div className="flex gap-3">
                          <input
                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 tracking-widest text-center text-lg"
                            placeholder="000000"
                            maxLength={6}
                            value={twoFaToken}
                            onChange={e => setTwoFaToken(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={e => e.key === 'Enter' && twoFaToken.length === 6 && verify2FA()}
                          />
                          <button onClick={verify2FA} disabled={twoFaLoading || twoFaToken.length !== 6}
                            className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                            {twoFaLoading ? 'Verifying…' : 'Verify'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {twoFaMsg && (
                  <p className={`mt-4 text-sm ${twoFaMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{twoFaMsg}</p>
                )}
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

            {/* Auto-assign Rules */}
            {tab === 'auto-assign' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Auto-assignment Rules</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Automatically assign new conversations to agents</p>
                  </div>
                  <Button size="sm" icon={<PlusIcon className="w-4 h-4" />} onClick={() => setShowRuleForm(true)}>Add Rule</Button>
                </div>
                {showRuleForm && (
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                    <Input label="Rule name" placeholder="e.g. Sales team" value={ruleForm.name}
                      onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))} />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Strategy</label>
                      <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                        value={ruleForm.strategy} onChange={e => setRuleForm(f => ({ ...f, strategy: e.target.value }))}>
                        <option value="round_robin">Round Robin</option>
                        <option value="least_loaded">Least Loaded</option>
                      </select>
                    </div>
                    <Input label="Agent user IDs (comma-separated)" placeholder="user1id, user2id"
                      value={ruleForm.assigneeIds} onChange={e => setRuleForm(f => ({ ...f, assigneeIds: e.target.value }))} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={createAutoRule} loading={savingRule}>Save Rule</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowRuleForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
                {autoRules.length === 0 && !showRuleForm ? (
                  <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">No rules yet</div>
                ) : (
                  <div className="space-y-3">
                    {autoRules.map(rule => (
                      <div key={rule.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{rule.name}</p>
                          <p className="text-xs text-gray-500">{rule.strategy} · {rule.assigneeIds?.length || 0} agents</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={async () => {
                            if (!currentWorkspace) return;
                            await autoAssignApi.update(currentWorkspace.id, rule.id, { active: !rule.active });
                            setAutoRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r));
                          }} className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${rule.active ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}>
                            {rule.active ? 'Pause' : 'Enable'}
                          </button>
                          <button onClick={async () => {
                            if (!currentWorkspace) return;
                            await autoAssignApi.delete(currentWorkspace.id, rule.id);
                            setAutoRules(prev => prev.filter(r => r.id !== rule.id));
                          }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Business Hours / SLA */}
            {tab === 'business-hours' && (
              <div className="max-w-xl space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">SLA Configuration</h3>
                  <p className="text-xs text-gray-500 mb-3">Default hours before a conversation is overdue</p>
                  <div className="flex items-center gap-3">
                    <input type="number" min="1" max="720"
                      className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      value={slaHours} onChange={e => setSlaHours(parseInt(e.target.value) || 24)} />
                    <span className="text-sm text-gray-500">hours</span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Business Hours</h3>
                  <p className="text-xs text-gray-500 mb-4">When your team is available. OOO messages are sent outside these hours.</p>
                  <div className="space-y-2">
                    {businessHours.map((bh, i) => (
                      <div key={bh.day} className="flex items-center gap-3">
                        <div className="w-16">
                          <button onClick={() => setBusinessHours(prev => prev.map((b, idx) => idx === i ? { ...b, enabled: !b.enabled } : b))}
                            className={`w-full text-xs py-1 rounded-lg font-medium ${bh.enabled ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'}`}>
                            {bh.label}
                          </button>
                        </div>
                        <input type="time" value={bh.start} disabled={!bh.enabled}
                          onChange={e => setBusinessHours(prev => prev.map((b, idx) => idx === i ? { ...b, start: e.target.value } : b))}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none disabled:opacity-40" />
                        <span className="text-xs text-gray-400">to</span>
                        <input type="time" value={bh.end} disabled={!bh.enabled}
                          onChange={e => setBusinessHours(prev => prev.map((b, idx) => idx === i ? { ...b, end: e.target.value } : b))}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none disabled:opacity-40" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Out-of-Office Message</h3>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${oooEnabled ? 'bg-primary-500' : 'bg-gray-200'}`}
                      onClick={() => setOooEnabled(v => !v)}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${oooEnabled ? 'translate-x-5 ml-0.5' : 'ml-0.5'}`} />
                    </div>
                    <span className="text-sm text-gray-700">Send OOO message outside business hours</span>
                  </div>
                  {oooEnabled && (
                    <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none" rows={3}
                      value={oooMessage} onChange={e => setOooMessage(e.target.value)} />
                  )}
                </div>

                <button onClick={saveBusinessHours} disabled={savingBh}
                  className="bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                  {savingBh ? 'Saving…' : 'Save All Settings'}
                </button>
              </div>
            )}

            {/* White Label Branding */}
            {tab === 'branding' && (
              <div className="max-w-lg">
                <h2 className="text-base font-semibold text-gray-900 mb-1">White-Label Branding</h2>
                <p className="text-sm text-gray-500 mb-6">Customize the app's appearance for your brand.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
                    <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Your Company Name" value={branding.brandingName}
                      onChange={e => setBranding(b => ({ ...b, brandingName: e.target.value }))} />
                    <p className="text-xs text-gray-400 mt-1">Replaces "Connectly" in the sidebar and emails</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                    <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="https://your-company.com/logo.png" value={branding.brandingLogo}
                      onChange={e => setBranding(b => ({ ...b, brandingLogo: e.target.value }))} />
                    {branding.brandingLogo && <img src={branding.brandingLogo} alt="logo preview" className="mt-2 h-10 rounded-lg border border-gray-200 object-contain" />}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={branding.brandingColor}
                        onChange={e => setBranding(b => ({ ...b, brandingColor: e.target.value }))}
                        className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer p-1" />
                      <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                        value={branding.brandingColor} onChange={e => setBranding(b => ({ ...b, brandingColor: e.target.value }))} />
                    </div>
                  </div>
                  <button onClick={saveBranding} disabled={savingBranding}
                    className="bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                    {savingBranding ? 'Saving…' : 'Save Branding'}
                  </button>
                  {brandingMsg && <p className={`text-sm ${brandingMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{brandingMsg}</p>}
                </div>
              </div>
            )}

            {/* Usage */}
            {tab === 'usage' && (
              <div className="max-w-2xl">
                <h2 className="text-base font-semibold text-gray-900 mb-6">Workspace Usage</h2>
                {!usage ? (
                  <div className="flex justify-center py-10"><div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-primary-900 capitalize">{usage.plan} Plan</p>
                        <p className="text-xs text-primary-600">Current workspace plan</p>
                      </div>
                      <span className="text-2xl">🚀</span>
                    </div>
                    {[
                      { label: 'Contacts', value: usage.contacts, limit: usage.limits.contacts, icon: '👥' },
                      { label: 'Messages', value: usage.messages, limit: usage.limits.messages, icon: '💬' },
                      { label: 'Channels', value: usage.channels, limit: usage.limits.channels, icon: '📡' },
                      { label: 'Conversations', value: usage.conversations, limit: -1, icon: '🗂' },
                    ].map(item => {
                      const pct = item.limit > 0 ? Math.min(100, Math.round((item.value / item.limit) * 100)) : 0;
                      const unlimited = item.limit === -1;
                      return (
                        <div key={item.label} className="bg-white border border-gray-100 rounded-2xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{item.icon}</span>
                              <span className="text-sm font-medium text-gray-900">{item.label}</span>
                            </div>
                            <span className="text-sm font-bold text-gray-700">
                              {item.value.toLocaleString()}{!unlimited && <span className="text-gray-400 font-normal"> / {item.limit.toLocaleString()}</span>}
                              {unlimited && <span className="text-xs bg-green-100 text-green-700 ml-2 px-2 py-0.5 rounded-full">Unlimited</span>}
                            </span>
                          </div>
                          {!unlimited && (
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div className={`h-2 rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-primary-500'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* API Keys */}
            {tab === 'api-keys' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">API Keys</h3>
                  <p className="text-xs text-gray-500">Create API keys to access the Connectly API programmatically</p>
                </div>
                {createdKey && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-green-800 mb-2">✅ API key created — copy it now, it won't be shown again</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white border border-green-200 rounded-lg px-3 py-2 font-mono break-all">{createdKey}</code>
                      <button onClick={() => { navigator.clipboard.writeText(createdKey); }} className="p-2 hover:bg-green-100 rounded-lg text-green-700 flex-shrink-0">
                        <ClipboardDocumentIcon className="w-4 h-4" />
                      </button>
                    </div>
                    <button onClick={() => setCreatedKey(null)} className="text-xs text-green-600 mt-2 hover:underline">Dismiss</button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Key name (e.g. Production, Zapier)"
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createApiKey()}
                  />
                  <Button size="sm" onClick={createApiKey} loading={savingKey} disabled={!newKeyName.trim()} icon={<KeyIcon className="w-4 h-4" />}>
                    Create
                  </Button>
                </div>
                {apiKeys.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">No API keys yet</div>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.map(k => (
                      <div key={k.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{k.name}</p>
                          <code className="text-xs text-gray-500 font-mono">{k.keyPrefix}••••••••••••••••••••</code>
                          {k.lastUsedAt && (
                            <p className="text-xs text-gray-400 mt-0.5">Last used {format(new Date(k.lastUsedAt), 'MMM d, yyyy')}</p>
                          )}
                        </div>
                        <button onClick={() => deleteApiKey(k.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Audit Log */}
            {tab === 'audit-log' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Audit Log</h3>
                  <p className="text-xs text-gray-500">Track actions performed in this workspace</p>
                </div>
                {auditLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">No activity recorded yet</div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Action', 'User', 'Entity', 'Date'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {auditLogs.map(log => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="text-xs font-medium text-gray-800 bg-gray-100 px-2 py-0.5 rounded-full">{log.action}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">{log.userName}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 font-mono truncate max-w-[120px]">{log.entityId.slice(0, 12)}…</td>
                            <td className="px-4 py-3 text-xs text-gray-400">{format(new Date(log.createdAt), 'MMM d, h:mm a')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {/* Members & Roles */}
            {tab === 'members' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Members & Roles</h3>
                  <p className="text-xs text-gray-500">Manage team members and their permissions in this workspace</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                  <strong>Role permissions:</strong> Admin — full access · Supervisor — manage agents & view reports · Agent — handle conversations · Viewer — read-only
                </div>
                {membersLoading ? (
                  <div className="flex justify-center py-12"><div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
                ) : membersData.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">No members found</div>
                ) : (
                  <div className="space-y-2">
                    {membersData.map(m => (
                      <div key={m.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {m.user.name?.[0] || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{m.user.name}</p>
                            <p className="text-xs text-gray-400 truncate">{m.user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <select
                            value={m.role}
                            disabled={updatingMember === m.id}
                            onChange={async (e) => {
                              if (!currentWorkspace) return;
                              const newRole = e.target.value;
                              setUpdatingMember(m.id);
                              try {
                                const { default: api } = await import('../api/client');
                                const { data } = await api.patch(`/workspaces/${currentWorkspace.id}/members/${m.id}`, { role: newRole });
                                setMembersData(prev => prev.map(x => x.id === m.id ? { ...x, role: data.role } : x));
                              } catch (err: any) {
                                alert(err.response?.data?.error || 'Failed to update role');
                              } finally {
                                setUpdatingMember(null);
                              }
                            }}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="admin">Admin</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="agent">Agent</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <TrashIcon
                            className="w-4 h-4 text-gray-400 hover:text-red-500 cursor-pointer transition-colors"
                            onClick={async () => {
                              if (!currentWorkspace || !confirm(`Remove ${m.user.name} from workspace?`)) return;
                              try {
                                const { default: api } = await import('../api/client');
                                await api.delete(`/workspaces/${currentWorkspace.id}/members/${m.id}`);
                                setMembersData(prev => prev.filter(x => x.id !== m.id));
                              } catch (err: any) {
                                alert(err.response?.data?.error || 'Failed to remove member');
                              }
                            }}
                          />
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
