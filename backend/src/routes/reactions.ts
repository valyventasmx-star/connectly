import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';
import { getIO } from '../services/socket';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// Toggle reaction on a message
router.post('/:conversationId/messages/:messageId/reactions', async (req: AuthRequest, res: Response) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'emoji required' });

  const existing = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId: req.params.messageId,
        userId: req.user!.id,
        emoji,
      },
    },
  });

  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.messageReaction.create({
      data: {
        emoji,
        messageId: req.params.messageId,
        userId: req.user!.id,
        userName: req.user!.name,
      },
    });
  }

  const reactions = await prisma.messageReaction.findMany({
    where: { messageId: req.params.messageId },
  });

  const io = getIO();
  io.to(`workspace:${req.params.workspaceId}`).emit('reaction_updated', {
    messageId: req.params.messageId,
    conversationId: req.params.conversationId,
    reactions,
  });

  res.json(reactions);
});

// Get reactions for a message
router.get('/:conversationId/messages/:messageId/reactions', async (req: AuthRequest, res: Response) => {
  const reactions = await prisma.messageReaction.findMany({
    where: { messageId: req.params.messageId },
  });
  res.json(reactions);
});

export default router;
