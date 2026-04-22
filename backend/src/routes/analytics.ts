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

export default router;
