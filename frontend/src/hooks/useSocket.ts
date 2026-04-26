import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth';
import { useWorkspaceStore } from '../store/workspace';
import { Message } from '../types';

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

    // On Vercel VITE_API_URL points to Railway; on localhost '/' proxies to :3001
    const socketUrl = import.meta.env.VITE_API_URL || '/';
    socketInstance = io(socketUrl, {
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

    const handleNewMessage = (data: any) => {
      const state = useWorkspaceStore.getState();

      // Bridge sends message fields flat at top level ({ id, conversationId, content, … }).
      // Regular backend wraps them under data.message. Normalise to one Message object.
      const msg: Message = data.message ?? {
        id: data.id,
        conversationId: data.conversationId,
        content: data.content ?? '',
        direction: data.direction ?? 'inbound',
        type: data.type ?? 'text',
        status: data.status ?? 'delivered',
        isNote: data.isNote ?? false,
        isAiReply: data.isAiReply ?? false,
        senderName: data.senderName ?? null,
        mediaUrl: data.mediaUrl ?? null,
        mediaType: data.mediaType ?? null,
        createdAt: data.createdAt
          ? (typeof data.createdAt === 'string' ? data.createdAt : new Date(data.createdAt).toISOString())
          : new Date().toISOString(),
        reactions: [],
      };

      if (!msg?.conversationId) return;

      state.updateConversation({
        id: msg.conversationId,
        lastMessageAt: msg.createdAt,
        ...(data.conversation || {}),
      });

      if (state.activeConversation?.id === msg.conversationId) {
        window.dispatchEvent(new CustomEvent('new_message', { detail: msg }));
      }

      // Browser notification + sound for inbound messages
      if (msg.direction === 'inbound' && !msg.isNote) {
        const conv = state.conversations.find(c => c.id === msg.conversationId);
        const contactName = conv?.contact?.name || 'New message';
        showBrowserNotification(contactName, msg.content);
        if (state.activeConversation?.id !== msg.conversationId) {
          playNotificationSound();
        }
      }
    };

    const handleConversationUpdated = (data: any) => {
      // Bridge emits convPayload with { id, … }; regular backend emits { conversationId }
      const conversationId = data?.conversationId ?? data?.id;
      if (!conversationId) return;
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
