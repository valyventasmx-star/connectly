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
  TrophyIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store/auth';
import { useWorkspaceStore } from '../../store/workspace';
import { useThemeStore } from '../../store/theme';
import Avatar from '../ui/Avatar';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import NotificationBell from '../ui/NotificationBell';

/** Items that scroll in the middle of the rail */
const navItems = [
  { to: '/dashboard',      icon: HomeIcon,             label: 'Dashboard' },
  { to: '/inbox',          icon: InboxIcon,             label: 'Inbox' },
  { to: '/contacts',       icon: UserGroupIcon,         label: 'Contacts' },
  { to: '/pipeline',       icon: ViewColumnsIcon,       label: 'Pipeline' },
  { to: '/segments',       icon: FunnelIcon,            label: 'Segments' },
  { to: '/channels',       icon: PhoneIcon,             label: 'Channels' },
  { to: '/broadcasts',     icon: MegaphoneIcon,         label: 'Broadcasts' },
  { to: '/automation',     icon: BoltIcon,              label: 'Automation' },
  { to: '/flow-builder',   icon: ArrowPathIcon,         label: 'Flow Builder' },
  { to: '/knowledge-base', icon: BookOpenIcon,          label: 'Knowledge Base' },
  { to: '/reports',        icon: DocumentChartBarIcon,  label: 'Reports' },
  { to: '/analytics',      icon: ChartBarIcon,          label: 'Analytics' },
  { to: '/leaderboard',    icon: TrophyIcon,            label: 'Leaderboard' },
  { to: '/integrations',   icon: PuzzlePieceIcon,       label: 'Integrations' },
  { to: '/live-chat',      icon: ChatBubbleLeftRightIcon, label: 'Live Chat Widget' },
  { to: '/workspaces',     icon: BuildingOfficeIcon,    label: 'Workspaces' },
  { to: '/ai-training',    icon: SparklesIcon,          label: 'AI Training' },
  { to: '/api-docs',       icon: CodeBracketIcon,       label: 'API Docs' },
  { to: '/billing',        icon: CreditCardIcon,        label: 'Billing' },
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
      <div className="w-16 bg-sidebar-bg flex flex-col items-center py-3 border-r border-sidebar-border flex-shrink-0 overflow-hidden">

        {/* ── Fixed top: logo + search ── */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 mb-1">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
          </div>
          <button onClick={openSearch} title="Search (⌘K)" className="sidebar-icon">
            <MagnifyingGlassIcon className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable nav ── */}
        <nav className="flex-1 flex flex-col items-center gap-0.5 overflow-y-auto min-h-0 w-full py-1"
             style={{ scrollbarWidth: 'none' }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) => `sidebar-icon ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-5 h-5" />
            </NavLink>
          ))}

          {/* Admin — only for admins */}
          {user?.isAdmin && (
            <NavLink to="/admin" title="Admin" className={({ isActive }) => `sidebar-icon ${isActive ? 'active' : ''}`}>
              <ShieldCheckIcon className="w-5 h-5" />
            </NavLink>
          )}
        </nav>

        {/* ── Fixed bottom: utilities only ── */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-1 border-t border-sidebar-border w-full">
          <NotificationBell />
          <button onClick={toggleTheme} title={isDark ? 'Light mode' : 'Dark mode'} className="sidebar-icon">
            {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
          <NavLink to="/settings" title="Settings" className={({ isActive }) => `sidebar-icon ${isActive ? 'active' : ''}`}>
            <Cog6ToothIcon className="w-5 h-5" />
          </NavLink>
          <button onClick={handleLogout} title="Logout" className="sidebar-icon text-gray-400 hover:text-red-400">
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
          </button>
          {user && (
            <div className="mt-1">
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
