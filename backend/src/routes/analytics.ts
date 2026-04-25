import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

router.get('/analytics', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalConversations,
    openConversations,
    resolvedConversations,
    totalContacts,
    totalMessages,
    newContactsThisMonth,
    conversationsThisWeek,
    messagesThisMonth,
    inboundMessages,
    outboundMessages,
    aiMessages,
  ] = await Promise.all([
    prisma.conversation.count({ where: { workspaceId } }),
    prisma.conversation.count({ where: { workspaceId, status: 'open' } }),
    prisma.conversation.count({ where: { workspaceId, status: 'resolved' } }),
    prisma.contact.count({ where: { workspaceId } }),
    prisma.message.count({ where: { conversation: { workspaceId } } }),
    prisma.contact.count({ where: { workspaceId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.conversation.count({ where: { workspaceId, createdAt: { gte: sevenDaysAgo } } }),
    prisma.message.count({ where: { conversation: { workspaceId }, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.message.count({ where: { conversation: { workspaceId }, direction: 'inbound' } }),
    prisma.message.count({ where: { conversation: { workspaceId }, direction: 'outbound' } }),
    prisma.message.count({ where: { conversation: { workspaceId }, isAiReply: true } }),
  ]);

  // Daily message counts for the last 7 days
  const dailyMessages = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const count = await prisma.message.count({
      where: {
        conversation: { workspaceId },
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    dailyMessages.push({
      date: startOfDay.toISOString().split('T')[0],
      count,
    });
  }

  res.json({
    overview: {
      totalConversations,
      openConversations,
      resolvedConversations,
      totalContacts,
      totalMessages,
      newContactsThisMonth,
      conversationsThisWeek,
      messagesThisMonth,
    },
    messages: {
      inbound: inboundMessages,
      outbound: outboundMessages,
      aiReplies: aiMessages,
    },
    dailyMessages,
    resolutionRate: totalConversations > 0
      ? Math.round((resolvedConversations / totalConversations) * 100)
      : 0,
  });
});

// GET /analytics/heatmap — message volume by hour (0-23) × weekday (0-6, Sun=0)
router.get('/analytics/heatmap', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  const days = parseInt(req.query.days as string || '30');
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const messages = await prisma.message.findMany({
    where: {
      conversation: { workspaceId },
      createdAt: { gte: since },
      direction: 'inbound',
      isNote: false,
    },
    select: { createdAt: true },
  });

  // Build hour × weekday matrix (7 days × 24 hours)
  const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const msg of messages) {
    const d = new Date(msg.createdAt);
    const hour = d.getHours();
    const day = d.getDay(); // 0 = Sunday
    matrix[day][hour]++;
  }

  // Flatten to array for frontend
  const cells: { day: number; hour: number; count: number }[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ day, hour, count: matrix[day][hour] });
    }
  }

  res.json({ cells, total: messages.length, days });
});

// GET /analytics/by-channel — message counts per channel
router.get('/analytics/by-channel', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  const channels = await prisma.channel.findMany({ where: { workspaceId } });

  const result = await Promise.all(channels.map(async ch => {
    const [total, inbound, outbound] = await Promise.all([
      prisma.message.count({ where: { conversation: { channelId: ch.id } } }),
      prisma.message.count({ where: { conversation: { channelId: ch.id }, direction: 'inbound' } }),
      prisma.message.count({ where: { conversation: { channelId: ch.id }, direction: 'outbound' } }),
    ]);
    return { channelId: ch.id, name: ch.name, type: ch.type, total, inbound, outbound };
  }));

  res.json(result);
});

// GET /analytics/by-language — contacts grouped by detected language
router.get('/analytics/by-language', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  const contacts = await prisma.contact.groupBy({
    by: ['language'],
    where: { workspaceId },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  res.json(contacts.map(c => ({ language: c.language || 'unknown', count: c._count.id })));
});

export default router;
