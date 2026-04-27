/**
 * usePushNotifications
 *
 * Requests push permission, subscribes via the service worker, and registers
 * the subscription with the backend. Call this hook once when the user is
 * logged in and has a workspace selected.
 *
 * The browser will only prompt for permission once — subsequent calls are
 * no-ops if already subscribed.
 */

import { useEffect, useRef } from 'react';
import api from '../api/client';

export function usePushNotifications(workspaceId: string | undefined) {
  const attempted = useRef(false);

  useEffect(() => {
    if (!workspaceId || attempted.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!import.meta.env.PROD) return; // only in production (service worker not registered in dev)

    attempted.current = true;

    (async () => {
      try {
        // 1. Get VAPID public key from backend
        const { data } = await api.get(`/workspaces/${workspaceId}/push/vapid-key`);
        const vapidKey: string = data.publicKey;
        if (!vapidKey) return;

        // 2. Wait for the service worker to be ready
        const registration = await navigator.serviceWorker.ready;

        // 3. Check existing subscription
        let sub = await registration.pushManager.getSubscription();

        if (!sub) {
          // 4. Request permission (browser shows the prompt)
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;

          // 5. Subscribe
          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
          });
        }

        // 6. Send subscription to backend
        await api.post(`/workspaces/${workspaceId}/push/subscribe`, {
          subscription: sub.toJSON(),
        });

        console.log('[PUSH] Subscribed to push notifications');
      } catch (err) {
        // Non-fatal — push is an enhancement, never breaks the app
        console.warn('[PUSH] Could not subscribe:', (err as Error).message);
      }
    })();
  }, [workspaceId]);
}

// Helper: convert base64url VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
