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
  MegaphoneIcon,
  DocumentChartBarIcon,
  MagnifyingGlassIcon,
  HomeIcon,
  MoonIcon,
  SunIcon,
  BoltIcon,
  BookOpenIcon,
  PuzzlePieceIcon,
  ShieldCheckIcon,
  CreditCardIcon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store/auth';
import { useWorkspaceStore } from '../../store/workspace';
import { useThemeStore } from '../../store/theme';
import Avatar from '../ui/Avatar';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import NotificationBell from '../ui/NotificationBell';

// ── Primary nav — these always fit on screen without scrolling ───────────────
const primaryNav = [
  { to: '/dashboard',      icon: HomeIcon,             label: 'Dashboard' },
  { to: '/inbox',          icon: InboxIcon,             label: 'Inbox' },
  { to: '/contacts',       icon: UserGroupIcon,         label: 'Contacts' },
  { to: '/channels',       icon: PhoneIcon,             label: 'Channels' },
  { to: '/broadcasts',     icon: MegaphoneIcon,         label: 'Broadcasts' },
  { to: '/automation',     icon: BoltIcon,              label: 'Automation' },
  { to: '/reports',        icon: DocumentChartBarIcon,  label: 'Reports' },
  { to: '/analytics',      icon: ChartBarIcon,          label: 'Analytics' },
  { to: '/knowledge-base', icon: BookOpenIcon,          label: 'Knowledge Base' },
  { to: '/templates',      icon: RectangleStackIcon,    label: 'Templates' },
  { to: '/integrations',   icon: PuzzlePieceIcon,       label: 'Integrations' },
  { to: '/workspaces',     icon: BuildingOfficeIcon,    label: 'Workspaces' },
  { to: '/billing',        icon: CreditCardIcon,        label: 'Billing' },
];

function SidebarIcon({
  to,
  label,
  children,
  onClick,
}: {
  to?: string;
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  if (to) {
    return (
      <NavLink
        to={to}
        title={label}
        className={({ isActive }) =>
          `sidebar-icon flex-shrink-0 ${isActive ? 'active' : ''}`
        }
      >
        {children}
      </NavLink>
    );
  }
  return (
    <button title={label} onClick={onClick} className="sidebar-icon flex-shrink-0">
      {children}
    </button>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };
  const openSearch  = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  };

  return (
    <div className="flex h-full">
      {/* ── Icon rail ── */}
      <div
        className="w-16 bg-sidebar-bg flex flex-col items-center border-r border-sidebar-border flex-shrink-0"
        style={{ minHeight: 0, height: '100%' }}
      >
        {/* Logo */}
        <div className="flex-shrink-0 pt-3 pb-1">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Search */}
        <div className="flex-shrink-0 pb-1">
          <SidebarIcon label="Search (⌘K)" onClick={openSearch}>
            <MagnifyingGlassIcon className="w-5 h-5" />
          </SidebarIcon>
        </div>

        {/* thin divider */}
        <div className="w-8 border-t border-sidebar-border mb-1 flex-shrink-0" />

        {/* Scrollable primary nav */}
        <nav
          className="flex flex-col items-center gap-0.5 w-full flex-1 overflow-y-auto py-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {primaryNav.map(({ to, icon: Icon, label }) => (
            <SidebarIcon key={to} to={to} label={label}>
              <Icon className="w-5 h-5" />
            </SidebarIcon>
          ))}

          {user?.isAdmin && (
            <NavLink
              to="/admin"
              title="Admin Panel"
              className={({ isActive }) =>
                `sidebar-icon flex-shrink-0 relative ${isActive ? 'active' : ''}`
              }
            >
              <ShieldCheckIcon className="w-5 h-5 text-purple-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-500 rounded-full" />
            </NavLink>
          )}
        </nav>

        {/* thin divider */}
        <div className="w-8 border-t border-sidebar-border mt-1 flex-shrink-0" />

        {/* Fixed bottom utilities */}
        <div className="flex flex-col items-center gap-0.5 py-2 flex-shrink-0">
          <NotificationBell />

          <SidebarIcon label={isDark ? 'Light mode' : 'Dark mode'} onClick={toggleTheme}>
            {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </SidebarIcon>

          <SidebarIcon to="/settings" label="Settings">
            <Cog6ToothIcon className="w-5 h-5" />
          </SidebarIcon>

          <SidebarIcon label="Logout" onClick={handleLogout}>
            <ArrowRightOnRectangleIcon className="w-5 h-5 text-gray-400 group-hover:text-red-400" />
          </SidebarIcon>

          {user && (
            <div className="mt-1 mb-1">
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
