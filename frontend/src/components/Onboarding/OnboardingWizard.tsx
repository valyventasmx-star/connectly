import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspace';
import { onboardingApi, channelsApi, workspacesApi } from '../../api/client';
import {
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  UserGroupIcon,
  SparklesIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

const STEPS = [
  { id: 0, title: 'Welcome to Connectly', icon: ChatBubbleLeftRightIcon, color: 'bg-primary-600' },
  { id: 1, title: 'Name your workspace', icon: ChatBubbleLeftRightIcon, color: 'bg-primary-600' },
  { id: 2, title: 'Connect a channel', icon: PhoneIcon, color: 'bg-green-600' },
  { id: 3, title: 'Enable AI assistant', icon: SparklesIcon, color: 'bg-purple-600' },
  { id: 4, title: "You're all set!", icon: CheckCircleIcon, color: 'bg-emerald-600' },
];

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { currentWorkspace, setCurrentWorkspace } = useWorkspaceStore();
  const [step, setStep] = useState(0);
  const [wsName, setWsName] = useState(currentWorkspace?.name || '');
  const [channelType, setChannelType] = useState<'whatsapp' | 'email'>('whatsapp');
  const [channelName, setChannelName] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('You are a helpful customer support assistant. Be friendly, concise, and professional.');
  const [saving, setSaving] = useState(false);

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  const saveStep1 = async () => {
    if (!currentWorkspace || !wsName.trim()) return;
    setSaving(true);
    try {
      const { data } = await workspacesApi.update(currentWorkspace.id, { name: wsName });
      setCurrentWorkspace({ ...currentWorkspace, name: wsName });
      await onboardingApi.update(currentWorkspace.id, { onboardingStep: 2 });
      next();
    } finally { setSaving(false); }
  };

  const saveStep2 = async () => {
    if (!currentWorkspace) return;
    setSaving(true);
    try {
      if (channelName.trim()) {
        await channelsApi.create(currentWorkspace.id, {
          name: channelName,
          type: channelType,
          status: 'pending',
        });
      }
      await onboardingApi.update(currentWorkspace.id, { onboardingStep: 3 });
      next();
    } finally { setSaving(false); }
  };

  const saveStep3 = async () => {
    if (!currentWorkspace) return;
    setSaving(true);
    try {
      await workspacesApi.update(currentWorkspace.id, { aiEnabled, aiPrompt });
      setCurrentWorkspace({ ...currentWorkspace, aiEnabled });
      await onboardingApi.update(currentWorkspace.id, { onboardingStep: 4 });
      next();
    } finally { setSaving(false); }
  };

  const complete = async () => {
    if (!currentWorkspace) return;
    await onboardingApi.update(currentWorkspace.id, { onboardingCompleted: true, onboardingStep: 5 });
    onComplete();
  };

  const currentStepInfo = STEPS[step];
  const StepIcon = currentStepInfo.icon;
  const progress = (step / (STEPS.length - 1)) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-fade-in">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div className="h-1 bg-primary-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div key={s.id} className={`flex-1 h-1 rounded-full transition-colors ${i <= step ? 'bg-primary-500' : 'bg-gray-100'}`} />
            ))}
          </div>

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <ChatBubbleLeftRightIcon className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Welcome to Connectly 🎉</h2>
              <p className="text-gray-500 mb-2">Your all-in-one customer messaging platform.</p>
              <p className="text-sm text-gray-400 mb-8">Let's set up your workspace in just 3 quick steps. It takes less than 2 minutes.</p>
              <div className="grid grid-cols-3 gap-3 mb-8 text-center">
                {[
                  { icon: '💬', label: 'WhatsApp & Email', desc: 'All channels in one inbox' },
                  { icon: '🤖', label: 'AI Assistant', desc: 'Auto-reply with Claude AI' },
                  { icon: '📊', label: 'Reports & Analytics', desc: 'Track team performance' },
                ].map(f => (
                  <div key={f.label} className="bg-gray-50 rounded-2xl p-4">
                    <div className="text-2xl mb-1">{f.icon}</div>
                    <p className="text-xs font-semibold text-gray-800">{f.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{f.desc}</p>
                  </div>
                ))}
              </div>
              <button onClick={next} className="w-full bg-primary-600 text-white py-3.5 rounded-2xl font-semibold text-base hover:bg-primary-700 transition-colors flex items-center justify-center gap-2">
                Let's get started <ArrowRightIcon className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step 1: Workspace name */}
          {step === 1 && (
            <div>
              <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mb-5">
                <ChatBubbleLeftRightIcon className="w-7 h-7 text-primary-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Name your workspace</h2>
              <p className="text-sm text-gray-500 mb-6">This is how your team will identify this workspace. You can change it anytime.</p>
              <label className="block text-sm font-medium text-gray-700 mb-2">Workspace name</label>
              <input
                autoFocus
                className="w-full border-2 border-gray-200 focus:border-primary-500 rounded-2xl px-4 py-3 text-base focus:outline-none transition-colors"
                placeholder="e.g. Acme Support, My Company"
                value={wsName}
                onChange={e => setWsName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && wsName.trim() && saveStep1()}
              />
              <div className="flex gap-3 mt-6">
                <button onClick={back} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50">Back</button>
                <button onClick={saveStep1} disabled={!wsName.trim() || saving}
                  className="flex-1 bg-primary-600 text-white py-3 rounded-2xl font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? 'Saving…' : <><span>Continue</span><ArrowRightIcon className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Connect channel */}
          {step === 2 && (
            <div>
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-5">
                <PhoneIcon className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Connect a channel</h2>
              <p className="text-sm text-gray-500 mb-6">Add your first messaging channel. You can configure credentials later in Settings → Channels.</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { type: 'whatsapp', icon: '💬', label: 'WhatsApp Business', desc: 'Meta Cloud API' },
                  { type: 'email', icon: '📧', label: 'Email (SMTP)', desc: 'Any email provider' },
                ].map(c => (
                  <button key={c.type} onClick={() => setChannelType(c.type as any)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${channelType === c.type ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="text-2xl mb-2">{c.icon}</div>
                    <p className="text-sm font-semibold text-gray-900">{c.label}</p>
                    <p className="text-xs text-gray-500">{c.desc}</p>
                  </button>
                ))}
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Channel name</label>
              <input
                className="w-full border-2 border-gray-200 focus:border-primary-500 rounded-2xl px-4 py-3 text-base focus:outline-none"
                placeholder={channelType === 'whatsapp' ? 'e.g. WhatsApp Support' : 'e.g. Support Email'}
                value={channelName}
                onChange={e => setChannelName(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-2">💡 You can skip this and add channels later from the Channels page</p>
              <div className="flex gap-3 mt-6">
                <button onClick={back} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50">Back</button>
                <button onClick={saveStep2} disabled={saving}
                  className="flex-1 bg-primary-600 text-white py-3 rounded-2xl font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? 'Saving…' : <><span>Continue</span><ArrowRightIcon className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: AI assistant */}
          {step === 3 && (
            <div>
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-5">
                <SparklesIcon className="w-7 h-7 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Enable AI assistant</h2>
              <p className="text-sm text-gray-500 mb-6">Claude AI can automatically reply to inbound messages based on your custom prompt. You can fine-tune this anytime.</p>
              <div className={`p-4 rounded-2xl border-2 cursor-pointer transition-all mb-4 ${aiEnabled ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}
                onClick={() => setAiEnabled(v => !v)}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">🤖 Enable AI auto-reply</span>
                  <div className={`w-10 h-5 rounded-full transition-colors ${aiEnabled ? 'bg-purple-500' : 'bg-gray-200'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${aiEnabled ? 'translate-x-5 ml-0.5' : 'ml-0.5'}`} />
                  </div>
                </div>
                <p className="text-xs text-gray-500">Powered by Claude Haiku — responds instantly to customer messages</p>
              </div>
              {aiEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">AI prompt (persona & instructions)</label>
                  <textarea
                    className="w-full border-2 border-gray-200 focus:border-purple-500 rounded-2xl px-4 py-3 text-sm focus:outline-none resize-none"
                    rows={4}
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                  />
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button onClick={back} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50">Back</button>
                <button onClick={saveStep3} disabled={saving}
                  className="flex-1 bg-primary-600 text-white py-3 rounded-2xl font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? 'Saving…' : <><span>Continue</span><ArrowRightIcon className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircleIcon className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">You're all set! 🚀</h2>
              <p className="text-gray-500 mb-6">Your workspace is ready. Here's what you can do next:</p>
              <div className="text-left space-y-3 mb-8">
                {[
                  { icon: '📱', text: 'Connect your WhatsApp Business number in Channels' },
                  { icon: '👥', text: 'Invite your team members from Settings' },
                  { icon: '⚡', text: 'Create automation rules to save time' },
                  { icon: '📊', text: 'Check Reports to track performance' },
                ].map(item => (
                  <div key={item.text} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-sm text-gray-700">{item.text}</span>
                  </div>
                ))}
              </div>
              <button onClick={complete}
                className="w-full bg-emerald-600 text-white py-3.5 rounded-2xl font-semibold text-base hover:bg-emerald-700 transition-colors">
                Go to Dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
