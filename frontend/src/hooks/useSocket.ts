import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth';
import { useWorkspaceStore } from '../store/workspace';
import { Message, Conversation } from '../types';

let socketInstance: Socket | null = null;

// Request browser notification permission on first use
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// Sound alert using Web Audio API (no external files needed)
let audioCtx: AudioContext | null = null;
function playNotificationSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.setValueAtTime(660, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    // Audio not available
  }
}

function showBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    const n = new Notification(title, {
      body,
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: 'connectly-message', // replaces previous notification instead of stacking
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  }
}

export function useSocket() {
  const { token } = useAuthStore();
  const { currentWorkspace, updateConversation, activeConversation } = useWorkspaceStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (!token || initialized.current) return;
    initialized.current = true;

    requestNotificationPermission();

    socketInstance = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected');
    });

    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        initialized.current = false;
      }
    };
  }, [token]);

  useEffect(() => {
    if (!socketInstance || !currentWorkspace) return;
    socketInstance.emit('join_workspace', currentWorkspace.id);

    const handleNewMessage = (data: { conversationId: string; message: Message; conversation?: Partial<Conversation> }) => {
      const state = useWorkspaceStore.getState();

      state.updateConversation({
        id: data.conversationId,
        lastMessageAt: data.message.createdAt,
        messages: [data.message],
        ...(data.conversation || {}),
      });

      if (state.activeConversation?.id === data.conversationId) {
        window.dispatchEvent(new CustomEvent('new_message', { detail: data.message }));
      }

      // Browser notification + sound for inbound messages
      if (data.message.direction === 'inbound' && !data.message.isNote) {
        const conv = state.conversations.find(c => c.id === data.conversationId);
        const contactName = conv?.contact?.name || 'New message';
        showBrowserNotification(contactName, data.message.content);
        // Sound alert (only if not in the active conversation)
        if (state.activeConversation?.id !== data.conversationId) {
          playNotificationSound();
        }
      }
    };

    const handleConversationUpdated = ({ conversationId }: { conversationId: string }) => {
      window.dispatchEvent(new CustomEvent('conversation_updated', { detail: { conversationId } }));
    };

    const handleTyping = (data: { userId: string; userName: string; isTyping: boolean }) => {
      window.dispatchEvent(new CustomEvent('typing_indicator', { detail: data }));
    };

    const handleReactionUpdated = (data: { messageId: string; conversationId: string; reactions: any[] }) => {
      window.dispatchEvent(new CustomEvent('reaction_updated', { detail: data }));
    };

    socketInstance.on('new_message', handleNewMessage);
    socketInstance.on('conversation_updated', handleConversationUpdated);
    socketInstance.on('typing', handleTyping);
    socketInstance.on('reaction_updated', handleReactionUpdated);

    return () => {
      socketInstance?.off('new_message', handleNewMessage);
      socketInstance?.off('conversation_updated', handleConversationUpdated);
      socketInstance?.off('typing', handleTyping);
      socketInstance?.off('reaction_updated', handleReactionUpdated);
    };
  }, [currentWorkspace, activeConversation]);

  return socketInstance;
}

export function getSocket() {
  return socketInstance;
}
