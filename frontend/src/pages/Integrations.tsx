import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import { shopifyApi } from '../api/client';
import { CheckCircleIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function Integrations() {
  const { currentWorkspace } = useWorkspaceStore();
  const [shopify, setShopify] = useState<any>(null);
  const [shopifyForm, setShopifyForm] = useState({ shopDomain: '', accessToken: '' });
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyMsg, setShopifyMsg] = useState('');

  useEffect(() => {
    if (!currentWorkspace) return;
    shopifyApi.get(currentWorkspace.id).then(r => {
      setShopify(r.data);
      if (r.data) setShopifyForm(f => ({ ...f, shopDomain: r.data.shopDomain }));
    }).catch(console.error);
  }, [currentWorkspace]);

  const saveShopify = async () => {
    if (!currentWorkspace) return;
    setShopifyLoading(true);
    setShopifyMsg('');
    try {
      const { data } = await shopifyApi.save(currentWorkspace.id, shopifyForm);
      setShopify(data);
      setShopifyMsg('✅ Shopify connected successfully');
      setShopifyForm(f => ({ ...f, accessToken: '' }));
    } catch (e: any) {
      setShopifyMsg('❌ ' + (e.response?.data?.error || 'Failed to connect'));
    } finally { setShopifyLoading(false); }
  };

  const deleteShopify = async () => {
    if (!currentWorkspace || !confirm('Disconnect Shopify?')) return;
    await shopifyApi.delete(currentWorkspace.id);
    setShopify(null);
    setShopifyMsg('');
    setShopifyForm({ shopDomain: '', accessToken: '' });
  };

  const toggleShopify = async () => {
    if (!currentWorkspace || !shopify) return;
    const { data } = await shopifyApi.toggle(currentWorkspace.id, !shopify.enabled);
    setShopify(data);
  };

  const integrations = [
    {
      id: 'shopify',
      name: 'Shopify',
      description: 'Show customer orders inside the contact panel. Agents can see recent purchases without leaving Connectly.',
      icon: '🛒',
      color: 'bg-green-50 border-green-200',
      connected: !!shopify,
    },
    { id: 'hubspot', name: 'HubSpot', description: 'Sync contacts and deal stages with HubSpot CRM.', icon: '🔶', color: 'bg-orange-50 border-orange-200', connected: false, comingSoon: true },
    { id: 'zapier', name: 'Zapier', description: 'Connect Connectly to 5,000+ apps via Zapier automation.', icon: '⚡', color: 'bg-yellow-50 border-yellow-200', connected: false, comingSoon: true },
    { id: 'google', name: 'Google Contacts', description: 'Import and sync contacts from Google Contacts.', icon: '📇', color: 'bg-blue-50 border-blue-200', connected: false, comingSoon: true },
    { id: 'slack', name: 'Slack', description: 'Get new conversation notifications in your Slack workspace.', icon: '💬', color: 'bg-purple-50 border-purple-200', connected: false, comingSoon: true },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">Integrations</h1>
          <p className="text-sm text-gray-500">Connect Connectly with your favourite tools</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl space-y-4">
            {integrations.map(integration => (
              <div key={integration.id} className={`bg-white border rounded-2xl overflow-hidden ${integration.connected ? 'border-green-200' : 'border-gray-100'}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl ${integration.color}`}>
                        {integration.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900">{integration.name}</h3>
                          {integration.connected && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" />Connected</span>}
                          {(integration as any).comingSoon && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Coming Soon</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{integration.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Shopify config */}
                  {integration.id === 'shopify' && (
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
                                placeholder="your-store.myshopify.com"
                                value={shopifyForm.shopDomain}
                                onChange={e => setShopifyForm(f => ({ ...f, shopDomain: e.target.value }))} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Admin API Access Token</label>
                              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" type="password"
                                placeholder="shpat_..."
                                value={shopifyForm.accessToken}
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
                          <p className="text-xs text-gray-400">Create a private app in Shopify Admin → Apps → Develop apps → create app with read_orders scope.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
