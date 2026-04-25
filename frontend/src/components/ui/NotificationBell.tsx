import { useState, useEffect, useRef } from 'react';
import { BellIcon, CheckIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { BellAlertIcon } from '@heroicons/react/24/solid';
import { notificationsApi } from '../../api/client';
import { useWorkspaceStore } from '../../store/workspace';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  read: boolean;
  createdAt: string;
  entityType?: string;
  entityId?: string;
}

const TYPE_COLORS: Record<string, string> = {
  new_message: 'bg-blue-500',
  mention: 'bg-purple-500',
  assignment: 'bg-green-500',
  sla_breach: 'bg-red-500',
  csat: 'bg-yellow-500',
  flow: 'bg-indigo-500',
};

export default function NotificationBell() {
  const { currentWorkspace } = useWorkspaceStore();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!currentWorkspace) return;
    try {
      const r = await notificationsApi.list(currentWorkspace.id);
      setNotifications(r.data.notifications);
      setUnread(r.data.unread);
    } catch { /* silent */ }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [currentWorkspace]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = async (id: string) => {
    if (!currentWorkspace) return;
    await notificationsApi.markRead(currentWorkspace.id, id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    if (!currentWorkspace) return;
    await notificationsApi.markAllRead(currentWorkspace.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
  };

  const deleteOne = async (id: string) => {
    if (!currentWorkspace) return;
    const n = notifications.find(n => n.id === id);
    await notificationsApi.delete(currentWorkspace.id, id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (n && !n.read) setUnread(prev => Math.max(0, prev - 1));
  };

  const clearAll = async () => {
    if (!currentWorkspace) return;
    await notificationsApi.clearAll(currentWorkspace.id);
    setNotifications([]);
    setUnread(0);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="sidebar-icon relative"
        title="Notifications"
      >
        {unread > 0 ? (
          <BellAlertIcon className="w-5 h-5 text-primary-400" />
        ) : (
          <BellIcon className="w-5 h-5" />
        )}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-14 bottom-0 w-80 bg-content-bg border border-sidebar-border rounded-xl shadow-2xl z-50 flex flex-col max-h-96">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
            <h3 className="font-semibold text-sm">Notifications {unread > 0 && <span className="text-primary-500">({unread})</span>}</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} title="Mark all read" className="text-text-secondary hover:text-text-primary">
                  <CheckIcon className="w-4 h-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} title="Clear all" className="text-text-secondary hover:text-red-400">
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-text-secondary hover:text-text-primary">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-text-secondary">
                <BellIcon className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-sidebar-border last:border-0 hover:bg-hover-bg transition-colors ${!n.read ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${TYPE_COLORS[n.type] || 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium leading-snug ${!n.read ? 'text-text-primary' : 'text-text-secondary'}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-text-secondary mt-0.5 truncate">{n.body}</p>}
                    <p className="text-[10px] text-text-secondary mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {!n.read && (
                      <button onClick={() => markRead(n.id)} title="Mark read" className="text-text-secondary hover:text-primary-500">
                        <CheckIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => deleteOne(n.id)} title="Delete" className="text-text-secondary hover:text-red-400">
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
