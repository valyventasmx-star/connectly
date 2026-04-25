import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

router.get('/', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  const userId = req.user!.id;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.setHours(0, 0, 0, 0));

  const [
    totalOpen,
    totalPending,
    totalResolved,
    myOpen,
    unassigned,
    newToday,
    resolvedToday,
    avgResponseMs,
    recentConversations,
  ] = await Promise.all([
    prisma.conversation.count({ where: { workspaceId, status: 'open' } }),
    prisma.conversation.count({ where: { workspaceId, status: 'pending' } }),
    prisma.conversation.count({ where: { workspaceId, status: 'resolved' } }),
    prisma.conversation.count({ where: { workspaceId, status: 'open', assigneeId: userId } }),
    prisma.conversation.count({ where: { workspaceId, status: 'open', assigneeId: null } }),
    prisma.conversation.count({ where: { workspaceId, createdAt: { gte: todayStart } } }),
    prisma.conversation.count({ where: { workspaceId, status: 'resolved', updatedAt: { gte: todayStart } } }),
    prisma.conversation.findMany({
      where: { workspaceId, firstResponseAt: { not: null }, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, firstResponseAt: true },
      take: 500,
    }),
    prisma.conversation.findMany({
      where: { workspaceId },
      include: {
        contact: { select: { name: true, avatar: true } },
        channel: { select: { name: true, type: true } },
        assignee: { select: { name: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 10,
    }),
  ]);

  const avgResponseTime = avgResponseMs.length
    ? Math.round(
        avgResponseMs.reduce(
          (sum, c) =>
            sum +
            (new Date(c.firstResponseAt!).getTime() - new Date(c.createdAt).getTime()),
          0
        ) /
          avgResponseMs.length /
          60000
      )
    : null;

  // Daily trend for last 7 days
  const daily: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const start = new Date(d.setHours(0, 0, 0, 0));
    const end = new Date(new Date(start).setHours(23, 59, 59, 999));
    const count = await prisma.conversation.count({
      where: { workspaceId, createdAt: { gte: start, lte: end } },
    });
    daily.push({ date: start.toISOString().split('T')[0], count });
  }

  res.json({
    stats: {
      totalOpen,
      totalPending,
      totalResolved,
      myOpen,
      unassigned,
      newToday,
      resolvedToday,
      avgResponseTime,
    },
    daily,
    recentConversations,
  });
});

export default router;
