import { useState, useEffect } from 'react';
import {
  ChatBubbleOvalLeftEllipsisIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { liveChatApi, channelsApi } from '../api/client';
import { useWorkspaceStore } from '../store/workspace';
import AppLayout from '../components/Layout/AppLayout';
const Layout = AppLayout;

export default function LiveChat() {
  const { currentWorkspace } = useWorkspaceStore();
  const [config, setConfig] = useState({
    primaryColor: '#6366f1',
    greeting: 'Hi! How can we help you today?',
    botName: 'Support',
    position: 'bottom-right',
    enabled: true,
    allowedOrigins: '',
    channelId: '',
  });
  const [channels, setChannels] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace) return;
    Promise.all([
      liveChatApi.get(currentWorkspace.id),
      channelsApi.list(currentWorkspace.id),
    ]).then(([wRes, cRes]) => {
      const w = wRes.data;
      if (w && w.id) {
        setConfig({
          primaryColor: w.primaryColor || '#6366f1',
          greeting: w.greeting || 'Hi! How can we help you today?',
          botName: w.botName || 'Support',
          position: w.position || 'bottom-right',
          enabled: w.enabled ?? true,
          allowedOrigins: w.allowedOrigins || '',
          channelId: w.channelId || '',
        });
      }
      setChannels(cRes.data || []);
    }).finally(() => setLoading(false));
  }, [currentWorkspace]);

  const save = async () => {
    if (!currentWorkspace) return;
    setSaving(true);
    try {
      await liveChatApi.save(currentWorkspace.id, config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const embedCode = `<!-- Connectly Live Chat Widget -->
<script>
  window.ConnectlyWidget = {
    workspaceId: "${currentWorkspace?.id || 'YOUR_WORKSPACE_ID'}",
    baseUrl: "${(import.meta.env.VITE_API_URL || window.location.origin)}"
  };
  (function(){
    var s = document.createElement('script');
    s.src = window.ConnectlyWidget.baseUrl + '/widget.js';
    s.async = true;
    document.body.appendChild(s);
  })();
</script>`;

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-full text-text-secondary">Loading…</div></Layout>;

  return (
    <Layout>
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="px-6 py-5 border-b border-sidebar-border">
          <h1 className="text-xl font-bold">Live Chat Widget</h1>
          <p className="text-sm text-text-secondary">Embed a chat widget on your website that creates conversations in Connectly</p>
        </div>

        <div className="flex flex-1 gap-6 p-6 overflow-y-auto">
          {/* Config panel */}
          <div className="flex-1 space-y-6 max-w-xl">
            {/* Enable toggle */}
            <div className="bg-content-bg border border-sidebar-border rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Enable Widget</h3>
                  <p className="text-sm text-text-secondary mt-0.5">Show the chat widget on your website</p>
                </div>
                <button
                  onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* General settings */}
            <div className="bg-content-bg border border-sidebar-border rounded-xl p-5 space-y-4">
              <h3 className="font-semibold">Appearance</h3>
              <div>
                <label className="label">Bot Name</label>
                <input className="input w-full" value={config.botName} onChange={e => setConfig(c => ({ ...c, botName: e.target.value }))} placeholder="Support" />
              </div>
              <div>
                <label className="label">Greeting Message</label>
                <textarea className="input w-full" rows={2} value={config.greeting} onChange={e => setConfig(c => ({ ...c, greeting: e.target.value }))} />
              </div>
              <div>
                <label className="label">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" className="w-10 h-10 rounded border border-sidebar-border cursor-pointer" value={config.primaryColor} onChange={e => setConfig(c => ({ ...c, primaryColor: e.target.value }))} />
                  <input className="input flex-1" value={config.primaryColor} onChange={e => setConfig(c => ({ ...c, primaryColor: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Widget Position</label>
                <select className="input w-full" value={config.position} onChange={e => setConfig(c => ({ ...c, position: e.target.value }))}>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                </select>
              </div>
            </div>

            {/* Channel config */}
            <div className="bg-content-bg border border-sidebar-border rounded-xl p-5 space-y-4">
              <h3 className="font-semibold">Channel</h3>
              <div>
                <label className="label">Route conversations to</label>
                <select className="input w-full" value={config.channelId} onChange={e => setConfig(c => ({ ...c, channelId: e.target.value }))}>
                  <option value="">Select channel…</option>
                  {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                </select>
                <p className="text-xs text-text-secondary mt-1">Conversations from the widget will appear under this channel</p>
              </div>
            </div>

            {/* Allowed origins */}
            <div className="bg-content-bg border border-sidebar-border rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <GlobeAltIcon className="w-5 h-5 text-text-secondary" />
                <h3 className="font-semibold">Allowed Origins</h3>
              </div>
              <div>
                <label className="label">Allowed domains (comma-separated)</label>
                <input className="input w-full" placeholder="https://mysite.com, https://app.mysite.com" value={config.allowedOrigins} onChange={e => setConfig(c => ({ ...c, allowedOrigins: e.target.value }))} />
                <p className="text-xs text-text-secondary mt-1">Leave blank to allow all origins</p>
              </div>
            </div>

            <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
              {saved ? <><CheckIcon className="w-4 h-4" />Saved!</> : saving ? 'Saving…' : 'Save Configuration'}
            </button>
          </div>

          {/* Preview + embed code */}
          <div className="w-80 flex-shrink-0 space-y-4">
            {/* Preview */}
            <div className="bg-content-bg border border-sidebar-border rounded-xl p-5">
              <h3 className="font-semibold mb-3">Preview</h3>
              <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg h-64 overflow-hidden">
                {/* Simulated website */}
                <div className="absolute inset-0 p-3">
                  <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2" />
                  <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-1" />
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                </div>
                {/* Widget button */}
                <div className={`absolute ${config.position === 'bottom-right' ? 'bottom-3 right-3' : 'bottom-3 left-3'}`}>
                  <div
                    className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center cursor-pointer"
                    style={{ backgroundColor: config.primaryColor }}
                  >
                    <ChatBubbleOvalLeftEllipsisIcon className="w-6 h-6 text-white" />
                  </div>
                </div>
                {/* Chat bubble */}
                <div className={`absolute bottom-16 ${config.position === 'bottom-right' ? 'right-3' : 'left-3'} bg-white dark:bg-gray-700 rounded-xl shadow-lg p-2 w-36`}>
                  <p className="text-xs font-semibold text-gray-800 dark:text-white mb-0.5">{config.botName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-300 leading-tight">{config.greeting}</p>
                </div>
              </div>
            </div>

            {/* Embed code */}
            <div className="bg-content-bg border border-sidebar-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Embed Code</h3>
                <button onClick={copyEmbed} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700">
                  {copied ? <><CheckIcon className="w-3.5 h-3.5" />Copied!</> : <><ClipboardDocumentIcon className="w-3.5 h-3.5" />Copy</>}
                </button>
              </div>
              <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-xs text-text-secondary overflow-x-auto whitespace-pre-wrap break-all">
                {embedCode}
              </pre>
              <p className="text-xs text-text-secondary mt-2">Add this code just before the closing <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">&lt;/body&gt;</code> tag on your website.</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
