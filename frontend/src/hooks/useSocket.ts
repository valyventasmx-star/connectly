import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth';
import { useWorkspaceStore } from '../store/workspace';
import { Message, Conversation } from '../types';

let socketInstance: Socket | null = null;

export function useSocket() {
  const { token } = useAuthStore();
  const { currentWorkspace, updateConversation, activeConversation } = useWorkspaceStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (!token || initialized.current) return;
    initialized.current = true;

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
      useWorkspaceStore.getState().updateConversation({
        id: data.conversationId,
        lastMessageAt: data.message.createdAt,
        messages: [data.message],
        ...(data.conversation || {}),
      });

      if (activeConversation?.id === data.conversationId) {
        window.dispatchEvent(new CustomEvent('new_message', { detail: data.message }));
      }
    };

    const handleConversationUpdated = ({ conversationId }: { conversationId: string }) => {
      window.dispatchEvent(new CustomEvent('conversation_updated', { detail: { conversationId } }));
    };

    socketInstance.on('new_message', handleNewMessage);
    socketInstance.on('conversation_updated', handleConversationUpdated);

    return () => {
      socketInstance?.off('new_message', handleNewMessage);
      socketInstance?.off('conversation_updated', handleConversationUpdated);
    };
  }, [currentWorkspace, activeConversation]);

  return socketInstance;
}

export function getSocket() {
  return socketInstance;
}
