/**
 * pushNotifications.ts
 *
 * In-memory Web Push notification service.
 * Subscriptions are stored per workspace in memory — they persist for the
 * lifetime of the Railway instance and are re-created when agents reopen the
 * PWA. This is intentionally lightweight: no DB changes required.
 *
 * Required env vars (set in Railway):
 *   VAPID_PUBLIC_KEY   – generated with web-push generate-vapid-keys
 *   VAPID_PRIVATE_KEY  – generated with web-push generate-vapid-keys
 *   VAPID_SUBJECT      – mailto:you@yourdomain.com  (required by spec)
 */

import webpush, { PushSubscription } from 'web-push';

// ── VAPID setup ───────────────────────────────────────────────────────────────
const PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  ?? '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const SUBJECT     = process.env.VAPID_SUBJECT     ?? 'mailto:admin@connectly.app';

if (PUBLIC_KEY && PRIVATE_KEY) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  console.log('[PUSH] VAPID configured — push notifications enabled');
} else {
  console.warn('[PUSH] VAPID keys not set — push notifications disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Railway env vars.');
}

// ── In-memory subscription store ─────────────────────────────────────────────
// Map<workspaceId, Map<endpoint, PushSubscription>>
// Using endpoint as key so the same browser tab doesn't duplicate entries.
const _store = new Map<string, Map<string, PushSubscription>>();

export function addSubscription(workspaceId: string, sub: PushSubscription): void {
  if (!_store.has(workspaceId)) _store.set(workspaceId, new Map());
  _store.get(workspaceId)!.set(sub.endpoint, sub);
  console.log(`[PUSH] Subscription added — workspace=${workspaceId} total=${_store.get(workspaceId)!.size}`);
}

export function removeSubscription(workspaceId: string, endpoint: string): void {
  _store.get(workspaceId)?.delete(endpoint);
}

export function getVapidPublicKey(): string {
  return PUBLIC_KEY;
}

// ── Send a notification to all subscribers of a workspace ────────────────────
export async function notifyWorkspace(
  workspaceId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  if (!PUBLIC_KEY || !PRIVATE_KEY) return; // silently skip if not configured

  const subs = _store.get(workspaceId);
  if (!subs || subs.size === 0) return;

  const data = JSON.stringify({ ...payload, url: payload.url ?? '/inbox' });
  const expired: string[] = [];

  await Promise.allSettled(
    Array.from(subs.values()).map(async (sub) => {
      try {
        await webpush.sendNotification(sub, data);
      } catch (err: any) {
        // 410 Gone = subscription expired / unsubscribed
        if (err.statusCode === 410 || err.statusCode === 404) {
          expired.push(sub.endpoint);
        } else {
          console.warn('[PUSH] Send failed:', err.message);
        }
      }
    })
  );

  // Clean up expired subscriptions
  for (const endpoint of expired) {
    subs.delete(endpoint);
    console.log('[PUSH] Removed expired subscription');
  }
}
