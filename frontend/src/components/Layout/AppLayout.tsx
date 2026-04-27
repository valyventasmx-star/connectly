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

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated, setAuth, user } = useAuthStore();
  const { setWorkspaces, setCurrentWorkspace, currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
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
      <div className="flex h-full flex-shrink-0">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
      <SearchModal />
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}
