import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import { shopifyApi } from '../api/client';
import api from '../api/client';
import { CheckCircleIcon, TrashIcon, ArrowPathIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';

export default function Integrations() {
  const { currentWorkspace } = useWorkspaceStore();

  // Shopify
  const [shopify, setShopify] = useState<any>(null);
  const [shopifyForm, setShopifyForm] = useState({ shopDomain: '', accessToken: '' });
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyMsg, setShopifyMsg] = useState('');

  // HubSpot
  const [hubspot, setHubspot] = useState<{ connected: boolean; portalId?: string; lastSync?: string } | null>(null);
  const [hubspotKey, setHubspotKey] = useState('');
  const [hubspotLoading, setHubspotLoading] = useState(false);
  const [hubspotMsg, setHubspotMsg] = useState('');
  const [hubspotSyncing, setHubspotSyncing] = useState(false);
  const [hubspotSyncResult, setHubspotSyncResult] = useState<{ created: number; updated: number; total: number } | null>(null);

  // Zapier / Webhooks
  const [zapierCopied, setZapierCopied] = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    shopifyApi.get(currentWorkspace.id).then(r => {
      setShopify(r.data);
      if (r.data) setShopifyForm(f => ({ ...f, shopDomain: r.data.shopDomain }));
    }).catch(console.error);
    api.get(`/workspaces/${currentWorkspace.id}/hubspot`).then(r => setHubspot(r.data)).catch(console.error);
  }, [currentWorkspace]);

  // Shopify handlers
  const saveShopify = async () => {
    if (!currentWorkspace) return;
    setShopifyLoading(true); setShopifyMsg('');
    try {
      const { data } = await shopifyApi.save(currentWorkspace.id, shopifyForm);
      setShopify(data); setShopifyMsg('✅ Shopify connected successfully');
      setShopifyForm(f => ({ ...f, accessToken: '' }));
    } catch (e: any) { setShopifyMsg('❌ ' + (e.response?.data?.error || 'Failed to connect')); }
    finally { setShopifyLoading(false); }
  };
  const deleteShopify = async () => {
    if (!currentWorkspace || !confirm('Disconnect Shopify?')) return;
    await shopifyApi.delete(currentWorkspace.id);
    setShopify(null); setShopifyMsg(''); setShopifyForm({ shopDomain: '', accessToken: '' });
  };
  const toggleShopify = async () => {
    if (!currentWorkspace || !shopify) return;
    const { data } = await shopifyApi.toggle(currentWorkspace.id, !shopify.enabled);
    setShopify(data);
  };

  // HubSpot handlers
  const connectHubspot = async () => {
    if (!currentWorkspace || !hubspotKey) return;
    setHubspotLoading(true); setHubspotMsg('');
    try {
      const { data } = await api.put(`/workspaces/${currentWorkspace.id}/hubspot`, { apiKey: hubspotKey });
      setHubspot(data); setHubspotMsg('✅ HubSpot connected'); setHubspotKey('');
    } catch (e: any) { setHubspotMsg('❌ ' + (e.response?.data?.error || 'Failed to connect')); }
    finally { setHubspotLoading(false); }
  };
  const disconnectHubspot = async () => {
    if (!currentWorkspace || !confirm('Disconnect HubSpot?')) return;
    await api.delete(`/workspaces/${currentWorkspace.id}/hubspot`);
    setHubspot({ connected: false }); setHubspotMsg(''); setHubspotSyncResult(null);
  };
  const syncHubspot = async () => {
    if (!currentWorkspace) return;
    setHubspotSyncing(true); setHubspotSyncResult(null);
    try {
      const { data } = await api.post(`/workspaces/${currentWorkspace.id}/hubspot/sync`);
      setHubspotSyncResult(data);
      // Refresh last sync time
      const { data: hs } = await api.get(`/workspaces/${currentWorkspace.id}/hubspot`);
      setHubspot(hs);
    } catch (e: any) { alert(e.response?.data?.error || 'Sync failed'); }
    finally { setHubspotSyncing(false); }
  };

  const backendUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://your-backend.railway.app';

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">Integrations</h1>
          <p className="text-sm text-gray-500">Connect Connectly with your favourite tools</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl space-y-4">

            {/* ── Shopify ── */}
            <IntegrationCard
              icon="🛒" name="Shopify" color="bg-green-50 border-green-200"
              description="Show customer orders inside the contact panel. Agents see purchases without leaving Connectly."
              connected={!!shopify}
            >
              <div className="mt-4 pt-4 border-t border-gray-100">
                {shopify ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700 font-medium">{shopify.shopDomain}</p>
                      <p className="text-xs text-gray-500">Connected · Orders shown in contact panels</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={toggleShopify}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${shopify.enabled ? 'border-gray-200 text-gray-600 hover:bg-gray-50' : 'border-primary-200 text-primary-600 hover:bg-primary-50'}`}>
                        <ArrowPathIcon className="w-3 h-3 inline mr-1" />{shopify.enabled ? 'Pause' : 'Resume'}
                      </button>
                      <button onClick={deleteShopify} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50">
                        <TrashIcon className="w-3 h-3 inline mr-1" />Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Shop Domain</label>
                        <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="your-store.myshopify.com" value={shopifyForm.shopDomain}
                          onChange={e => setShopifyForm(f => ({ ...f, shopDomain: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Admin API Access Token</label>
                        <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" type="password"
                          placeholder="shpat_..." value={shopifyForm.accessToken}
                          onChange={e => setShopifyForm(f => ({ ...f, accessToken: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={saveShopify} disabled={shopifyLoading || !shopifyForm.shopDomain || !shopifyForm.accessToken}
                        className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                        {shopifyLoading ? 'Connecting…' : 'Connect Shopify'}
                      </button>
                      {shopifyMsg && <p className={`text-xs ${shopifyMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{shopifyMsg}</p>}
                    </div>
                    <p className="text-xs text-gray-400">Create a private app in Shopify Admin → Apps → Develop apps with read_orders scope.</p>
                  </div>
                )}
              </div>
            </IntegrationCard>

            {/* ── HubSpot ── */}
            <IntegrationCard
              icon="🔶" name="HubSpot CRM" color="bg-orange-50 border-orange-200"
              description="Bidirectional contact sync — import contacts from HubSpot and push updated contacts back."
              connected={!!hubspot?.connected}
            >
              <div className="mt-4 pt-4 border-t border-gray-100">
                {hubspot?.connected ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">Connected to portal {hubspot.portalId}</p>
                        {hubspot.lastSync && <p className="text-xs text-gray-500">Last synced: {new Date(hubspot.lastSync).toLocaleString()}</p>}
                        {hubspotSyncResult && (
                          <p className="text-xs text-emerald-600 mt-0.5">
                            ✅ Sync complete: {hubspotSyncResult.created} created, {hubspotSyncResult.updated} updated ({hubspotSyncResult.total} total)
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={syncHubspot} disabled={hubspotSyncing}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-orange-200 text-orange-700 hover:bg-orange-50 disabled:opacity-50">
                          <ArrowPathIcon className={`w-3 h-3 ${hubspotSyncing ? 'animate-spin' : ''}`} />
                          {hubspotSyncing ? 'Syncing…' : 'Sync Contacts'}
                        </button>
                        <button onClick={disconnectHubspot} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50">
                          <TrashIcon className="w-3 h-3 inline mr-1" />Disconnect
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Sync imports up to 100 contacts at a time. To push a single contact to HubSpot, open the contact panel and click "Push to HubSpot".</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-xs text-orange-700 space-y-1">
                      <p><strong>1.</strong> In HubSpot, go to Settings → Integrations → Private Apps → Create a private app</p>
                      <p><strong>2.</strong> Under Scopes, enable: <code className="bg-orange-100 px-1 rounded">crm.objects.contacts.read</code> and <code className="bg-orange-100 px-1 rounded">crm.objects.contacts.write</code></p>
                      <p><strong>3.</strong> Copy the generated access token and paste below</p>
                    </div>
                    <div className="flex gap-2">
                      <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" type="password"
                        placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={hubspotKey}
                        onChange={e => setHubspotKey(e.target.value)} />
                      <button onClick={connectHubspot} disabled={hubspotLoading || !hubspotKey}
                        className="bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap">
                        {hubspotLoading ? 'Connecting…' : 'Connect'}
                      </button>
                    </div>
                    {hubspotMsg && <p className={`text-xs ${hubspotMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{hubspotMsg}</p>}
                  </div>
                )}
              </div>
            </IntegrationCard>

            {/* ── Zapier / Make / Webhooks ── */}
            <IntegrationCard
              icon="⚡" name="Zapier / Make / Any Webhook" color="bg-yellow-50 border-yellow-200"
              description="Trigger automations in Zapier, Make (Integromat), n8n or any HTTP service when Connectly events happen."
              connected={false}
            >
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                <p className="text-xs text-gray-600">
                  Connectly fires HTTP POST webhooks on the events you choose. Set this up in <strong>Settings → Webhooks</strong>.
                </p>

                {/* Event list */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Available Events</p>
                  {[
                    { event: 'conversation.created', desc: 'New conversation started' },
                    { event: 'conversation.resolved', desc: 'Conversation marked resolved' },
                    { event: 'conversation.assigned', desc: 'Agent assigned to conversation' },
                    { event: 'message.received', desc: 'Customer message received' },
                    { event: 'message.sent', desc: 'Agent/AI message sent' },
                    { event: 'contact.created', desc: 'New contact created' },
                  ].map(({ event, desc }) => (
                    <div key={event} className="flex items-center gap-2 text-xs">
                      <code className="bg-white border border-gray-200 px-2 py-0.5 rounded font-mono text-primary-700">{event}</code>
                      <span className="text-gray-500">{desc}</span>
                    </div>
                  ))}
                </div>

                {/* Webhook payload example */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Example Payload</p>
                  <pre className="bg-gray-900 text-green-400 rounded-xl p-3 text-[11px] overflow-x-auto">
{`{
  "event": "message.received",
  "workspaceId": "wks_abc123",
  "timestamp": "2025-04-25T10:30:00Z",
  "data": {
    "conversationId": "conv_xyz",
    "contactName": "John Doe",
    "contactPhone": "+1234567890",
    "message": "Hi, I need help with my order",
    "channel": "whatsapp"
  }
}`}
                  </pre>
                </div>

                {/* Zapier instructions */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800 space-y-1.5">
                  <p className="font-semibold">Zapier Setup</p>
                  <p>1. Create a new Zap → Trigger: <strong>Webhooks by Zapier</strong> → Catch Hook</p>
                  <p>2. Copy the Zapier webhook URL</p>
                  <p>3. In Connectly → Settings → Webhooks → Add Webhook, paste the URL and select events</p>
                  <p>4. Send a test message to trigger a sample payload, then map fields in Zapier</p>
                </div>

                <a href="/settings" className="inline-block bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700">
                  Configure Webhooks →
                </a>
              </div>
            </IntegrationCard>

            {/* ── Coming soon ── */}
            {[
              { id: 'google', name: 'Google Contacts', icon: '📇', color: 'bg-blue-50 border-blue-200', description: 'Import and sync contacts from Google Contacts.' },
              { id: 'slack', name: 'Slack', icon: '💬', color: 'bg-purple-50 border-purple-200', description: 'Get new conversation notifications in your Slack workspace.' },
            ].map(int => (
              <IntegrationCard key={int.id} {...int} connected={false} comingSoon>
                <div />
              </IntegrationCard>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function IntegrationCard({
  icon, name, color, description, connected, comingSoon, children,
}: {
  icon: string; name: string; color: string; description: string;
  connected: boolean; comingSoon?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`bg-white border rounded-2xl overflow-hidden ${connected ? 'border-green-200' : 'border-gray-100'}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl ${color}`}>
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{name}</h3>
                {connected && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircleIcon className="w-3 h-3" />Connected
                  </span>
                )}
                {comingSoon && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Coming Soon</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </div>
          </div>
        </div>
        {!comingSoon && children}
      </div>
    </div>
  );
}
