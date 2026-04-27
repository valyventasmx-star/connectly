import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import api from '../api/client';
import { SparklesIcon } from '@heroicons/react/24/outline';

export default function AISettings() {
  const { currentWorkspace } = useWorkspaceStore();
  const [enabled, setEnabled] = useState(false);
  const [autoPilot, setAutoPilot] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    api.get(`/workspaces/${currentWorkspace.id}/ai`)
      .then(({ data }) => {
        setEnabled(data.aiEnabled);
        setAutoPilot(data.aiAutoPilot || false);
        setPrompt(data.aiPrompt || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentWorkspace]);

  const handleSave = async () => {
    if (!currentWorkspace) return;
    setSaving(true);
    try {
      await api.patch(`/workspaces/${currentWorkspace.id}/ai`, { aiEnabled: enabled, aiAutoPilot: autoPilot, aiPrompt: prompt });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const isPlanLocked = currentWorkspace && !currentWorkspace.aiEnabled && !enabled;

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">AI Settings</h1>
          <p className="text-sm text-gray-500">Configure Claude AI auto-reply for this workspace</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
          {loading ? (
            <div className="flex justify-center py-16"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
          ) : (
            <div className="space-y-6">
              {/* AI Toggle */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <SparklesIcon className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">AI Auto-Reply</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Claude will automatically respond to incoming messages when enabled. Requires Pro or Agency plan.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEnabled(!enabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      enabled ? 'bg-primary-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {currentWorkspace && !currentWorkspace.aiEnabled && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs text-amber-700">
                      AI auto-reply requires a Pro or Agency plan.{' '}
                      <a href="/billing" className="font-semibold underline">Upgrade now</a>
                    </p>
                  </div>
                )}
              </div>

              {/* AI Autopilot */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
                      <SparklesIcon className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">AI Autopilot 🤖</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Claude autonomously handles ALL inbound messages end-to-end — no human needed unless it can't resolve the issue. Works on Instagram &amp; Messenger channels.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAutoPilot(!autoPilot)}
                    disabled={!enabled}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 ${
                      autoPilot ? 'bg-purple-500' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${autoPilot ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                {autoPilot && (
                  <div className="mt-3 p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-700">
                    ⚠️ Autopilot is <strong>ON</strong> — Claude will reply to every inbound message automatically. Make sure your System Prompt is well configured.
                  </div>
                )}
                {!enabled && (
                  <p className="text-xs text-gray-400 mt-3">Enable AI Auto-Reply above first to use Autopilot.</p>
                )}
              </div>

              {/* System Prompt */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <p className="text-sm font-semibold text-gray-900 mb-1">System Prompt</p>
                <p className="text-xs text-gray-500 mb-4">
                  Tell Claude how to behave. Include your company name, tone, what topics to answer, and when to escalate to a human agent.
                </p>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={10}
                  placeholder={`Example:\nYou are a helpful customer support agent for Acme Inc. Be friendly and professional. Answer questions about our products and services. If you don't know the answer or the customer wants a refund, tell them a human agent will follow up shortly.`}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-gray-300"
                />
                <p className="text-xs text-gray-400 mt-2">{prompt.length} characters</p>
              </div>

              {/* Tips */}
              <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
                <p className="text-xs font-semibold text-blue-700 mb-2">Tips for a good system prompt</p>
                <ul className="text-xs text-blue-600 space-y-1 list-disc list-inside">
                  <li>Include your company name and what you sell</li>
                  <li>Specify the tone (formal, casual, friendly)</li>
                  <li>List topics the AI should NOT answer</li>
                  <li>Tell it when to hand off to a human</li>
                  <li>Include your business hours if relevant</li>
                </ul>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving…' : saved ? 'Saved!' : 'Save settings'}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
