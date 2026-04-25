import { NavLink, useNavigate } from 'react-router-dom';
import {
  InboxIcon,
  UserGroupIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  CreditCardIcon,
  SparklesIcon,
  ShieldCheckIcon,
  MegaphoneIcon,
  DocumentChartBarIcon,
  MagnifyingGlassIcon,
  HomeIcon,
  MoonIcon,
  SunIcon,
  BoltIcon,
  FunnelIcon,
  BookOpenIcon,
  ViewColumnsIcon,
  PuzzlePieceIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store/auth';
import { useWorkspaceStore } from '../../store/workspace';
import { useThemeStore } from '../../store/theme';
import Avatar from '../ui/Avatar';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import NotificationBell from '../ui/NotificationBell';

const navItems = [
  { to: '/dashboard', icon: HomeIcon, label: 'Dashboard' },
  { to: '/inbox', icon: InboxIcon, label: 'Inbox' },
  { to: '/contacts', icon: UserGroupIcon, label: 'Contacts' },
  { to: '/pipeline', icon: ViewColumnsIcon, label: 'Pipeline' },
  { to: '/segments', icon: FunnelIcon, label: 'Segments' },
  { to: '/channels', icon: PhoneIcon, label: 'Channels' },
  { to: '/broadcasts', icon: MegaphoneIcon, label: 'Broadcasts' },
  { to: '/automation', icon: BoltIcon, label: 'Automation' },
  { to: '/knowledge-base', icon: BookOpenIcon, label: 'Knowledge Base' },
  { to: '/reports', icon: DocumentChartBarIcon, label: 'Reports' },
  { to: '/analytics', icon: ChartBarIcon, label: 'Analytics' },
  { to: '/integrations', icon: PuzzlePieceIcon, label: 'Integrations' },
  { to: '/flow-builder', icon: BoltIcon, label: 'Flow Builder' },
  { to: '/live-chat', icon: ChatBubbleLeftRightIcon, label: 'Live Chat Widget' },
  { to: '/workspaces', icon: BuildingOfficeIcon, label: 'Workspaces' },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { isDark, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const openSearch = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  };

  return (
    <div className="flex h-full">
      {/* Icon rail */}
      <div className="w-16 bg-sidebar-bg flex flex-col items-center py-4 gap-1 border-r border-sidebar-border flex-shrink-0">
        {/* Logo */}
        <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center mb-2 flex-shrink-0">
          <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
        </div>

        {/* Search button */}
        <button
          onClick={openSearch}
          title="Search (⌘K)"
          className="sidebar-icon mb-2"
        >
          <MagnifyingGlassIcon className="w-5 h-5" />
        </button>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) =>
                `sidebar-icon ${isActive ? 'active' : ''}`
              }
            >
              <Icon className="w-5 h-5" />
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="flex flex-col gap-1">
          <NotificationBell />
          <NavLink to="/ai-training" title="AI Training" className={({ isActive }) => `sidebar-icon ${isActive ? 'active' : ''}`}>
            <SparklesIcon className="w-5 h-5" />
          </NavLink>
          <NavLink to="/ai-settings" title="AI Settings" className={({ isActive }) => `sidebar-icon ${isActive ? 'active' : ''}`}>
            <SparklesIcon className="w-5 h-5" />
          </NavLink>
          <NavLink to="/api-docs" title="API Docs" className={({ isActive }) => `sidebar-icon ${isActive ? 'active' : ''}`}>
            <CodeBracketIcon className="w-5 h-5" />
          </NavLink>
          <NavLink to="/billing" title="Billing" className={({ isActive }) => `sidebar-icon ${isActive ? 'active' : ''}`}>
            <CreditCardIcon className="w-5 h-5" />
          </NavLink>
          {user?.isAdmin && (
            <NavLink to="/admin" title="Admin" className={({ isActive }) => `sidebar-icon ${isActive ? 'active' : ''}`}>
              <ShieldCheckIcon className="w-5 h-5" />
            </NavLink>
          )}
          <button onClick={toggleTheme} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'} className="sidebar-icon">
            {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
          <NavLink to="/settings" title="Settings" className={({ isActive }) => `sidebar-icon ${isActive ? 'active' : ''}`}>
            <Cog6ToothIcon className="w-5 h-5" />
          </NavLink>
          <button onClick={handleLogout} title="Logout" className="sidebar-icon text-gray-400 hover:text-red-400">
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
          </button>
          {user && (
            <div className="mt-2">
              <Avatar name={user.name} src={user.avatar} size="sm" className="cursor-pointer" />
            </div>
          )}
        </div>
      </div>

      {/* Workspace switcher panel */}
      <WorkspaceSwitcher />
    </div>
  );
}
