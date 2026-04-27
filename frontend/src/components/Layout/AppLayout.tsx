import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore } from '../../store/auth';
import { useWorkspaceStore } from '../../store/workspace';
import { authApi, workspacesApi, onboardingApi } from '../../api/client';
import { useSocket } from '../../hooks/useSocket';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import SearchModal from '../Search/SearchModal';
import OnboardingWizard from '../Onboarding/OnboardingWizard';
import { Bars3Icon, ChatBubbleLeftRightIcon, XMarkIcon as DismissIcon } from '@heroicons/react/24/outline';

interface AppLayoutProps {
  children: ReactNode;
}

// Detect iOS Safari NOT running in standalone (PWA) mode
function useIosPwaBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    const dismissed = localStorage.getItem('ios-pwa-banner-dismissed');
    if (isIos && !isStandalone && !dismissed) setShow(true);
  }, []);
  const dismiss = () => {
    localStorage.setItem('ios-pwa-banner-dismissed', '1');
    setShow(false);
  };
  return { show, dismiss };
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated, setAuth, user } = useAuthStore();
  const { setWorkspaces, setCurrentWorkspace, currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { show: showIosBanner, dismiss: dismissIosBanner } = useIosPwaBanner();
  useSocket();
  usePushNotifications(currentWorkspace?.id);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!user) {
      authApi.me().then(({ data }) => {
        const token = localStorage.getItem('token')!;
        setAuth(data, token);
      }).catch(() => navigate('/login'));
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    workspacesApi.list().then(({ data }) => {
      setWorkspaces(data);
      if (!currentWorkspace && data.length > 0) setCurrentWorkspace(data[0]);
    }).catch(console.error);
  }, [isAuthenticated]);

  // Check onboarding status when workspace is set
  useEffect(() => {
    if (!currentWorkspace || onboardingChecked) return;
    setOnboardingChecked(true);
    onboardingApi.get(currentWorkspace.id).then(({ data }) => {
      if (!data.onboardingCompleted) setShowOnboarding(true);
    }).catch(console.error);
  }, [currentWorkspace]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed overlay on mobile, static flex item on desktop */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Open menu"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <ChatBubbleLeftRightIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm">Connectly</span>
          </div>
        </div>

        {/* iOS PWA install banner */}
        {showIosBanner && (
          <div className="flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white text-sm flex-shrink-0">
            <span className="flex-1">
              📲 Install the app: tap the <strong>Share</strong> button then <strong>"Add to Home Screen"</strong>
            </span>
            <button onClick={dismissIosBanner} className="p-1 rounded hover:bg-indigo-500 flex-shrink-0" aria-label="Dismiss">
              <DismissIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {children}
      </main>

      <SearchModal />
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}
