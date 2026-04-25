import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// List scheduled messages for a conversation
router.get('/:conversationId/scheduled', async (req: AuthRequest, res: Response) => {
  const messages = await prisma.scheduledMessage.findMany({
    where: {
      conversationId: req.params.conversationId,
      workspaceId: req.params.workspaceId,
      sent: false,
    },
    orderBy: { scheduledAt: 'asc' },
  });
  res.json(messages);
});

// Create a scheduled message
router.post('/:conversationId/scheduled', async (req: AuthRequest, res: Response) => {
  const { content, scheduledAt, type } = req.body;
  if (!content || !scheduledAt) return res.status(400).json({ error: 'Content and scheduledAt required' });
  const msg = await prisma.scheduledMessage.create({
    data: {
      content,
      type: type || 'text',
      conversationId: req.params.conversationId,
      workspaceId: req.params.workspaceId,
      scheduledAt: new Date(scheduledAt),
      createdBy: req.user!.id,
      senderName: req.user!.name,
    },
  });
  res.json(msg);
});

// Delete a scheduled message
router.delete('/:conversationId/scheduled/:id', async (req: AuthRequest, res: Response) => {
  await prisma.scheduledMessage.deleteMany({
    where: { id: req.params.id, workspaceId: req.params.workspaceId },
  });
  res.json({ ok: true });
});

export default router;
