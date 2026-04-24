import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';
import { sendWhatsAppMessage } from '../services/whatsapp';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// List broadcasts
router.get('/', async (req: AuthRequest, res: Response) => {
  const broadcasts = await prisma.broadcast.findMany({
    where: { workspaceId: req.params.workspaceId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { recipients: true } } },
  });
  res.json(broadcasts);
});

// Create broadcast
router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, message, channelId, scheduledAt } = req.body;
  if (!name || !message) return res.status(400).json({ error: 'Name and message required' });

  const broadcast = await prisma.broadcast.create({
    data: {
      name,
      message,
      channelId: channelId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      workspaceId: req.params.workspaceId,
    },
  });
  res.json(broadcast);
});

// Send broadcast
router.post('/:broadcastId/send', async (req: AuthRequest, res: Response) => {
  const { broadcastId } = req.params;
  const { lifecycleStage } = req.body;

  const broadcast = await prisma.broadcast.findFirst({
    where: { id: broadcastId, workspaceId: req.params.workspaceId },
  });
  if (!broadcast) return res.status(404).json({ error: 'Broadcast not found' });
  if (broadcast.status === 'completed') return res.status(400).json({ error: 'Already sent' });

  // Get contacts to send to
  const where: any = { workspaceId: req.params.workspaceId, phone: { not: null } };
  if (lifecycleStage) where.lifecycleStage = lifecycleStage;

  const contacts = await prisma.contact.findMany({ where });

  // Get channel
  const channel = broadcast.channelId
    ? await prisma.channel.findUnique({ where: { id: broadcast.channelId } })
    : await prisma.channel.findFirst({ where: { workspaceId: req.params.workspaceId, status: 'connected' } });

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: 'in_progress', totalContacts: contacts.length },
  });

  // Create recipients
  await prisma.broadcastRecipient.createMany({
    data: contacts.map(c => ({ broadcastId, contactId: c.id })),
    skipDuplicates: true,
  });

  let sentCount = 0;
  let failedCount = 0;

  // Send messages
  for (const contact of contacts) {
    try {
      if (channel?.accessToken && channel?.phoneNumberId && contact.phone) {
        await sendWhatsAppMessage(channel.accessToken, channel.phoneNumberId, contact.phone, broadcast.message);
      }
      await prisma.broadcastRecipient.updateMany({
        where: { broadcastId, contactId: contact.id },
        data: { status: 'sent', sentAt: new Date() },
      });
      sentCount++;
    } catch {
      await prisma.broadcastRecipient.updateMany({
        where: { broadcastId, contactId: contact.id },
        data: { status: 'failed' },
      });
      failedCount++;
    }
  }

  const updated = await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: 'completed', sentAt: new Date(), sentCount, failedCount },
  });

  res.json(updated);
});

// Delete broadcast
router.delete('/:broadcastId', async (req: AuthRequest, res: Response) => {
  await prisma.broadcast.deleteMany({
    where: { id: req.params.broadcastId, workspaceId: req.params.workspaceId },
  });
  res.json({ success: true });
});

export default router;
