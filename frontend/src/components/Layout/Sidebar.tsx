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
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store/auth';
import { useWorkspaceStore } from '../../store/workspace';
import Avatar from '../ui/Avatar';
import WorkspaceSwitcher from './WorkspaceSwitcher';

const navItems = [
  { to: '/inbox', icon: InboxIcon, label: 'Inbox' },
  { to: '/contacts', icon: UserGroupIcon, label: 'Contacts' },
  { to: '/channels', icon: PhoneIcon, label: 'Channels' },
  { to: '/analytics', icon: ChartBarIcon, label: 'Analytics' },
  { to: '/workspaces', icon: BuildingOfficeIcon, label: 'Workspaces' },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-full">
      {/* Icon rail */}
      <div className="w-16 bg-sidebar-bg flex flex-col items-center py-4 gap-1 border-r border-sidebar-border flex-shrink-0">
        {/* Logo */}
        <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center mb-4 flex-shrink-0">
          <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
        </div>

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
          <NavLink to="/ai-settings" title="AI Settings" className={({ isActive }) => `sidebar-icon ${isActive ? 'active' : ''}`}>
            <SparklesIcon className="w-5 h-5" />
          </NavLink>
          <NavLink to="/billing" title="Billing" className={({ isActive }) => `sidebar-icon ${isActive ? 'active' : ''}`}>
            <CreditCardIcon className="w-5 h-5" />
          </NavLink>
          {user?.isAdmin && (
            <NavLink to="/admin" title="Admin" className={({ isActive }) => `sidebar-icon ${isActive ? 'active' : ''}`}>
              <ShieldCheckIcon className="w-5 h-5" />
            </NavLink>
          )}
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
