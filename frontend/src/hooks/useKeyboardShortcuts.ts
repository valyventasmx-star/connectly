import { useEffect } from 'react';
import { useWorkspaceStore } from '../store/workspace';
import { conversationsApi } from '../api/client';

export function useKeyboardShortcuts() {
  const { conversations, activeConversation, setActiveConversation, updateConversation, currentWorkspace } = useWorkspaceStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire if typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return;
      // Don't fire if modifier keys are held (except for shortcuts that use them)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const idx = activeConversation
        ? conversations.findIndex(c => c.id === activeConversation.id)
        : -1;

      switch (e.key) {
        case 'j': // Next conversation
          e.preventDefault();
          if (conversations.length === 0) return;
          const next = conversations[Math.min(idx + 1, conversations.length - 1)];
          if (next) setActiveConversation(next);
          break;

        case 'k': // Previous conversation
          e.preventDefault();
          if (conversations.length === 0) return;
          const prev = conversations[Math.max(idx - 1, 0)];
          if (prev) setActiveConversation(prev);
          break;

        case 'r': // Resolve / Reopen
          e.preventDefault();
          if (!activeConversation || !currentWorkspace) return;
          const newStatus = activeConversation.status === 'open' ? 'resolved' : 'open';
          conversationsApi.update(currentWorkspace.id, activeConversation.id, { status: newStatus })
            .then(({ data }) => updateConversation(data))
            .catch(console.error);
          break;

        case 'u': // Mark unread / pending
          e.preventDefault();
          if (!activeConversation || !currentWorkspace) return;
          conversationsApi.update(currentWorkspace.id, activeConversation.id, { status: 'pending' })
            .then(({ data }) => updateConversation(data))
            .catch(console.error);
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [conversations, activeConversation, currentWorkspace]);
}
