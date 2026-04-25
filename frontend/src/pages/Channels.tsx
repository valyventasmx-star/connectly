import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import { channelsApi, emailChannelApi } from '../api/client';
import { Channel } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import {
  PlusIcon,
  PhoneIcon,
  TrashIcon,
  PencilIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ClipboardDocumentIcon,
  BoltIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';

const EMPTY_FORM = {
  name: '', type: 'whatsapp', phoneNumber: '', phoneNumberId: '', wabaId: '', accessToken: '',
  // Email fields
  emailAddress: '', smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '', smtpSecure: 'false',
};

const STATUS_ICON: Record<string, any> = {
  connected: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
  error: <ExclamationCircleIcon className="w-5 h-5 text-red-500" />,
  pending: <ClockIcon className="w-5 h-5 text-gray-400" />,
};

export default function Channels() {
  const { currentWorkspace, channels, setChannels, addChannel, updateChannel, removeChannel } = useWorkspaceStore();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestMsg, setEmailTestMsg] = useState('');
  const [selected, setSelected] = useState<Channel | null>(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (currentWorkspace) load();
  }, [currentWorkspace]);

  const load = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const { data } = await channelsApi.list(currentWorkspace.id);
      setChannels(data);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (ch: Channel) => {
    setEditing(ch);
    let emailConfig: any = {};
    try { emailConfig = ch.emailConfig ? JSON.parse(ch.emailConfig) : {}; } catch {}
    setForm({
      name: ch.name, type: ch.type,
      phoneNumber: ch.phoneNumber || '', phoneNumberId: ch.phoneNumberId || '',
      wabaId: ch.wabaId || '', accessToken: ch.accessToken || '',
      emailAddress: ch.emailAddress || '',
      smtpHost: emailConfig.host || '', smtpPort: String(emailConfig.port || '587'),
      smtpUser: emailConfig.user || '', smtpPass: emailConfig.pass || '',
      smtpSecure: String(emailConfig.secure || 'false'),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!currentWorkspace || !form.name) return;
    setSaving(true);
    try {
      const payload: any = { name: form.name, type: form.type };
      if (form.type === 'email') {
        payload.emailAddress = form.emailAddress;
        payload.emailConfig = JSON.stringify({
          host: form.smtpHost, port: parseInt(form.smtpPort),
          user: form.smtpUser, pass: form.smtpPass,
          secure: form.smtpSecure === 'true',
        });
      } else {
        Object.assign(payload, {
          phoneNumber: form.phoneNumber, phoneNumberId: form.phoneNumberId,
          wabaId: form.wabaId, accessToken: form.accessToken,
        });
      }
      if (editing) {
        const { data } = await channelsApi.update(currentWorkspace.id, editing.id, payload);
        updateChannel(data);
        if (selected?.id === editing.id) setSelected(data);
      } else {
        const { data } = await channelsApi.create(currentWorkspace.id, payload);
        addChannel(data);
        setSelected(data);
      }
      setShowForm(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save channel');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!currentWorkspace || !selected) return;
    setTestingEmail(true);
    setEmailTestMsg('');
    try {
      let emailConfig: any = {};
      try { emailConfig = selected.emailConfig ? JSON.parse(selected.emailConfig) : {}; } catch {}
      await emailChannelApi.test(currentWorkspace.id, selected.id, emailConfig);
      setEmailTestMsg('✅ SMTP connection successful');
    } catch (err: any) {
      setEmailTestMsg('❌ ' + (err.response?.data?.error || 'SMTP test failed'));
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTest = async (ch: Channel) => {
    if (!currentWorkspace) return;
    setTesting(ch.id);
    try {
      await channelsApi.test(currentWorkspace.id, ch.id);
      const updated = { ...ch, status: 'connected' as const };
      updateChannel(updated);
      if (selected?.id === ch.id) setSelected(updated);
      alert('✅ Connection successful! Your WhatsApp channel is connected.');
    } catch (err: any) {
      const updated = { ...ch, status: 'error' as const };
      updateChannel(updated);
      if (selected?.id === ch.id) setSelected(updated);
      alert(`❌ Connection failed: ${err.response?.data?.details || err.response?.data?.error || 'Unknown error'}`);
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (ch: Channel) => {
    if (!currentWorkspace || !confirm(`Delete channel "${ch.name}"?`)) return;
    await channelsApi.delete(currentWorkspace.id, ch.id);
    removeChannel(ch.id);
    if (selected?.id === ch.id) setSelected(null);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const webhookUrl = (ch: Channel) =>
    `${window.location.origin}/api/webhooks/whatsapp/${ch.id}`;

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <AppLayout>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Channels</h1>
              <p className="text-sm text-gray-500">Connect your messaging channels</p>
            </div>
            <Button icon={<PlusIcon className="w-4 h-4" />} onClick={openCreate}>Add Channel</Button>
          </div>

          {/* Channel list */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex justify-center py-16"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
            ) : channels.length === 0 ? (
              <EmptyState
                icon={<PhoneIcon className="w-8 h-8" />}
                title="No channels yet"
                description="Connect your first WhatsApp Business number to start receiving messages"
                action={<Button icon={<PlusIcon className="w-4 h-4" />} onClick={openCreate}>Add WhatsApp Channel</Button>}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {channels.map((ch) => (
                  <div
                    key={ch.id}
                    onClick={() => setSelected(ch)}
                    className={`bg-white rounded-2xl border p-5 cursor-pointer hover:shadow-md transition-all ${selected?.id === ch.id ? 'border-primary-300 ring-1 ring-primary-300' : 'border-gray-100'}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${ch.type === 'email' ? 'bg-blue-100' : 'bg-green-100'} rounded-xl flex items-center justify-center text-xl`}>
                          {ch.type === 'email' ? '📧' : '💬'}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">{ch.name}</h3>
                          <span className="text-xs text-gray-500 capitalize">{ch.type === 'email' ? 'Email (SMTP)' : ch.type}</span>
                        </div>
                      </div>
                      {STATUS_ICON[ch.status]}
                    </div>
                    {ch.phoneNumber && <p className="text-sm text-gray-600 mb-2">{ch.phoneNumber}</p>}
                    {ch.emailAddress && <p className="text-sm text-gray-600 mb-2">{ch.emailAddress}</p>}
                    <div className="flex items-center justify-between">
                      <Badge label={ch.status} variant="status" />
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); openEdit(ch); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><PencilIcon className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(ch); }} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
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
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-10 h-10 ${selected.type === 'email' ? 'bg-blue-100' : 'bg-green-100'} rounded-xl flex items-center justify-center text-xl`}>
                  {selected.type === 'email' ? '📧' : '💬'}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selected.name}</h3>
                  <span className="text-sm text-gray-500 capitalize">{selected.type === 'email' ? 'Email (SMTP)' : selected.type}</span>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Connection Status</p>
                <div className="flex items-center gap-2">
                  {STATUS_ICON[selected.status]}
                  <span className="text-sm font-medium capitalize">{selected.status}</span>
                </div>
              </div>

              {selected.type === 'email' ? (
                <>
                  {selected.emailAddress && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email Address</p>
                      <p className="text-sm text-gray-700">{selected.emailAddress}</p>
                    </div>
                  )}
                  {/* Inbound webhook URL for email */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Inbound Webhook URL</p>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <code className="text-xs text-gray-700 flex-1 truncate break-all">
                        {`${window.location.origin}/api/email/inbound/${currentWorkspace?.id}/${selected.id}`}
                      </code>
                      <button
                        onClick={() => copyToClipboard(`${window.location.origin}/api/email/inbound/${currentWorkspace?.id}/${selected.id}`, 'email-webhook')}
                        className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                        {copied === 'email-webhook' ? <CheckCircleIcon className="w-4 h-4 text-green-500" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {emailTestMsg && (
                    <p className={`text-xs ${emailTestMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{emailTestMsg}</p>
                  )}
                  <div className="pt-2 space-y-2">
                    <Button className="w-full justify-center" variant="secondary"
                      icon={<BoltIcon className="w-4 h-4" />}
                      onClick={handleTestEmail} loading={testingEmail}>
                      Test SMTP Connection
                    </Button>
                    <Button className="w-full justify-center" variant="outline"
                      icon={<PencilIcon className="w-4 h-4" />} onClick={() => openEdit(selected)}>
                      Edit Channel
                    </Button>
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-700 space-y-1.5">
                    <p className="font-semibold">Email Setup Guide:</p>
                    <ol className="space-y-1 list-decimal list-inside">
                      <li>Configure SMTP credentials for sending</li>
                      <li>Copy the Inbound Webhook URL above</li>
                      <li>Paste it in Mailgun, SendGrid, or Postmark as your inbound parse URL</li>
                      <li>Click "Test SMTP Connection" to verify sending works</li>
                    </ol>
                  </div>
                </>
              ) : (
                <>
                  {/* Webhook URL */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Webhook URL</p>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <code className="text-xs text-gray-700 flex-1 truncate">{webhookUrl(selected)}</code>
                      <button onClick={() => copyToClipboard(webhookUrl(selected), 'webhook')} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                        {copied === 'webhook' ? <CheckCircleIcon className="w-4 h-4 text-green-500" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Verify token */}
                  {selected.webhookVerifyToken && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Verify Token</p>
                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                        <code className="text-xs text-gray-700 flex-1 truncate">{selected.webhookVerifyToken}</code>
                        <button onClick={() => copyToClipboard(selected.webhookVerifyToken!, 'token')} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                          {copied === 'token' ? <CheckCircleIcon className="w-4 h-4 text-green-500" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 space-y-2">
                    <Button className="w-full justify-center" variant="secondary"
                      icon={<BoltIcon className="w-4 h-4" />}
                      onClick={() => handleTest(selected)} loading={testing === selected.id}>
                      Test Connection
                    </Button>
                    <Button className="w-full justify-center" variant="outline"
                      icon={<PencilIcon className="w-4 h-4" />} onClick={() => openEdit(selected)}>
                      Edit Channel
                    </Button>
                  </div>

                  {/* Setup guide */}
                  <div className="mt-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-700 space-y-1.5">
                    <p className="font-semibold">WhatsApp Setup Guide:</p>
                    <ol className="space-y-1 list-decimal list-inside">
                      <li>Go to Meta Business Manager</li>
                      <li>Create a WhatsApp Business App</li>
                      <li>Add the Webhook URL above in your app config</li>
                      <li>Use the Verify Token above for verification</li>
                      <li>Subscribe to the <code>messages</code> webhook field</li>
                      <li>Enter your Phone Number ID and Access Token here</li>
                      <li>Click "Test Connection" to verify</li>
                    </ol>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Channel' : 'Add Channel'}
        size="lg"
        footer={<><Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Add Channel'}</Button></>}
      >
        <div className="space-y-4">
          <Input label="Channel name *" placeholder="e.g. WhatsApp Support" value={form.name} onChange={f('name')} autoFocus />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel type</label>
            <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" value={form.type} onChange={f('type')}>
              <option value="whatsapp">💬 WhatsApp Business</option>
              <option value="email">📧 Email (SMTP)</option>
              <option value="messenger">Facebook Messenger</option>
              <option value="instagram">Instagram DM</option>
            </select>
          </div>

          {form.type === 'email' ? (
            <>
              <Input label="From email address" placeholder="support@yourcompany.com" value={form.emailAddress} onChange={f('emailAddress')} />
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">SMTP Configuration</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Input label="SMTP Host" placeholder="smtp.gmail.com" value={form.smtpHost} onChange={f('smtpHost')} />
                    </div>
                    <div>
                      <Input label="Port" placeholder="587" value={form.smtpPort} onChange={f('smtpPort')} />
                    </div>
                  </div>
                  <Input label="SMTP Username" placeholder="you@gmail.com" value={form.smtpUser} onChange={f('smtpUser')} />
                  <Input label="SMTP Password / App Password" placeholder="••••••••" value={form.smtpPass} onChange={f('smtpPass')} type="password" />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Encryption</label>
                    <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" value={form.smtpSecure} onChange={f('smtpSecure')}>
                      <option value="false">STARTTLS (port 587)</option>
                      <option value="true">SSL/TLS (port 465)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                For Gmail: use an App Password (not your account password). Enable 2FA then create an App Password in Google Account → Security.
              </div>
            </>
          ) : (
            <>
              <Input label="Phone number" placeholder="+1 555 000 0000" value={form.phoneNumber} onChange={f('phoneNumber')} />
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Meta API Configuration</p>
                <div className="space-y-3">
                  <Input label="Phone Number ID" placeholder="From Meta Developer Console" value={form.phoneNumberId} onChange={f('phoneNumberId')} />
                  <Input label="WhatsApp Business Account ID (WABA ID)" placeholder="Optional" value={form.wabaId} onChange={f('wabaId')} />
                  <Input label="Permanent Access Token" placeholder="EAAxxxxx..." value={form.accessToken} onChange={f('accessToken')} type="password" />
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                You can add the channel now and configure the API credentials later. Use "Test Connection" after adding credentials to verify the setup.
              </div>
            </>
          )}
        </div>
      </Modal>
    </AppLayout>
  );
}
