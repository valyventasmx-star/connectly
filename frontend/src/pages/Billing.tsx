import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import api from '../api/client';
import { CheckIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface Plan {
  name: string;
  price: number;
  channels: number;
  contacts: number;
  members: number;
  aiEnabled: boolean;
  stripePriceId?: string;
}

interface Plans {
  [key: string]: Plan;
}

function feature(val: number | boolean, label: string) {
  if (typeof val === 'boolean') return val ? label : null;
  if (val === -1) return `Unlimited ${label}`;
  return `${val} ${label}`;
}

export default function Billing() {
  const { currentWorkspace } = useWorkspaceStore();
  const [plans, setPlans] = useState<Plans>({});
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    api.get('/workspaces/plans').then(({ data }) => setPlans(data)).catch(console.error);
  }, []);

  const currentPlan = currentWorkspace?.plan || 'free';

  const handleUpgrade = async (planKey: string) => {
    if (!currentWorkspace) return;
    setCheckoutLoading(planKey);
    try {
      const { data } = await api.post(`/workspaces/${currentWorkspace.id}/billing/checkout`, { planName: planKey });
      window.location.href = data.url;
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    if (!currentWorkspace) return;
    setPortalLoading(true);
    try {
      const { data } = await api.post(`/workspaces/${currentWorkspace.id}/billing/portal`);
      window.location.href = data.url;
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const planOrder = ['free', 'pro', 'agency'];
  const colors: Record<string, string> = {
    free: 'border-gray-200',
    pro: 'border-primary-500 ring-2 ring-primary-500',
    agency: 'border-purple-500 ring-2 ring-purple-500',
  };
  const badges: Record<string, string> = {
    pro: 'Most Popular',
    agency: 'Best Value',
  };

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">Billing & Plans</h1>
          <p className="text-sm text-gray-500">Choose the right plan for your team</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {currentWorkspace?.stripeSubscriptionId && (
            <div className="mb-6 flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-4">
              <div>
                <p className="text-sm font-semibold text-green-800">Active subscription</p>
                <p className="text-xs text-green-600 mt-0.5">You are on the <span className="capitalize">{currentPlan}</span> plan</p>
              </div>
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="text-sm font-medium text-green-700 border border-green-300 rounded-lg px-4 py-2 hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                {portalLoading ? 'Loading…' : 'Manage subscription'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {planOrder.map((key) => {
              const plan = plans[key];
              if (!plan) return null;
              const isCurrent = currentPlan === key;
              const isPaid = key !== 'free';

              return (
                <div key={key} className={`relative bg-white rounded-2xl border p-6 flex flex-col ${colors[key] || 'border-gray-200'}`}>
                  {badges[key] && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      {badges[key]}
                    </span>
                  )}

                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{plan.name}</p>
                    <div className="flex items-end gap-1 mt-1">
                      <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                      {plan.price > 0 && <span className="text-sm text-gray-400 mb-1">/mo</span>}
                    </div>
                  </div>

                  <ul className="space-y-2.5 flex-1 mb-6">
                    {[
                      feature(plan.channels, 'channels'),
                      feature(plan.contacts, 'contacts'),
                      feature(plan.members, 'team members'),
                      plan.aiEnabled ? 'AI auto-reply (Claude)' : null,
                      'Real-time messaging',
                      'WhatsApp integration',
                      key !== 'free' ? 'Priority support' : null,
                    ].filter(Boolean).map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="w-full text-center text-sm font-semibold text-gray-400 border border-gray-200 rounded-xl py-2.5">
                      Current plan
                    </div>
                  ) : isPaid ? (
                    <button
                      onClick={() => handleUpgrade(key)}
                      disabled={!!checkoutLoading}
                      className="w-full btn-primary py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                    >
                      {checkoutLoading === key ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                    </button>
                  ) : (
                    <div className="w-full text-center text-sm font-medium text-gray-400 border border-gray-200 rounded-xl py-2.5">
                      Free forever
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-gray-400 mt-8">
            All paid plans include a 14-day free trial. Cancel anytime. Prices in USD.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
