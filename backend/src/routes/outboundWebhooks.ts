import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

export const WEBHOOK_EVENTS = [
  'conversation.created',
  'conversation.resolved',
  'conversation.assigned',
  'message.received',
  'message.sent',
  'contact.created',
];

router.get('/', async (req: AuthRequest, res: Response) => {
  const hooks = await prisma.outboundWebhook.findMany({
    where: { workspaceId: req.params.workspaceId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(hooks);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, url, events, secret } = req.body;
  if (!name || !url || !events?.length) {
    return res.status(400).json({ error: 'name, url, and events are required' });
  }
  const hook = await prisma.outboundWebhook.create({
    data: {
      name,
      url,
      events: JSON.stringify(events),
      secret,
      workspaceId: req.params.workspaceId,
    },
  });
  res.status(201).json(hook);
});

router.patch('/:hookId', async (req: AuthRequest, res: Response) => {
  const { name, url, events, active, secret } = req.body;
  const hook = await prisma.outboundWebhook.update({
    where: { id: req.params.hookId },
    data: {
      ...(name !== undefined && { name }),
      ...(url !== undefined && { url }),
      ...(events !== undefined && { events: JSON.stringify(events) }),
      ...(active !== undefined && { active }),
      ...(secret !== undefined && { secret }),
    },
  });
  res.json(hook);
});

router.delete('/:hookId', async (req: AuthRequest, res: Response) => {
  await prisma.outboundWebhook.delete({ where: { id: req.params.hookId } });
  res.json({ message: 'Deleted' });
});

export default router;
