import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore } from '../../store/auth';
import { useWorkspaceStore } from '../../store/workspace';
import { authApi, workspacesApi } from '../../api/client';
import { useSocket } from '../../hooks/useSocket';
import SearchModal from '../Search/SearchModal';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated, setAuth, user } = useAuthStore();
  const { setWorkspaces, setCurrentWorkspace, currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  useSocket();

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
    </div>
  );
}
