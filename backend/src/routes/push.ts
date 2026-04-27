/**
 * push.ts — Web Push subscription management
 *
 * GET  /api/workspaces/:workspaceId/push/vapid-key  → returns the VAPID public key
 * POST /api/workspaces/:workspaceId/push/subscribe  → registers a push subscription
 * POST /api/workspaces/:workspaceId/push/unsubscribe → removes a subscription
 */

import { Router, Response } from 'express';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';
import { addSubscription, removeSubscription, getVapidPublicKey } from '../services/pushNotifications';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// Return the VAPID public key so the frontend can subscribe
router.get('/vapid-key', (_req: AuthRequest, res: Response) => {
  const key = getVapidPublicKey();
  if (!key) return res.status(503).json({ error: 'Push notifications not configured' });
  res.json({ publicKey: key });
});

// Save a new push subscription for this workspace member
router.post('/subscribe', async (req: AuthRequest, res: Response) => {
  const { subscription } = req.body as { subscription?: PushSubscriptionJSON };
  if (!subscription?.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'Invalid push subscription object' });
  }

  addSubscription(req.params.workspaceId, {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: (subscription.keys as any).p256dh,
      auth:   (subscription.keys as any).auth,
    },
  });

  res.json({ ok: true });
});

// Remove a subscription (e.g., on logout or when permission is revoked)
router.post('/unsubscribe', async (req: AuthRequest, res: Response) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  removeSubscription(req.params.workspaceId, endpoint);
  res.json({ ok: true });
});

export default router;
