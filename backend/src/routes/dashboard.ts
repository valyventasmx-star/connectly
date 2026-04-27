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
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Build 7 day-window pairs upfront (no mutation)
  const dayWindows = Array.from({ length: 7 }, (_, i) => {
    const base = new Date();
    base.setDate(base.getDate() - (6 - i));
    const start = new Date(base);
    start.setHours(0, 0, 0, 0);
    const end = new Date(base);
    end.setHours(23, 59, 59, 999);
    return { date: start.toISOString().split('T')[0], start, end };
  });

  // Fire ALL queries in parallel — one Promise.all, zero sequential awaits
  const [
    totalOpen,
    totalPending,
    totalResolved,
    myOpen,
    unassigned,
    newToday,
    resolvedToday,
    avgResponseRows,
    recentConversations,
    ...dailyCounts
  ] = await Promise.all([
    prisma.conversation.count({ where: { workspaceId, status: 'open' } }),
    prisma.conversation.count({ where: { workspaceId, status: 'pending' } }),
    prisma.conversation.count({ where: { workspaceId, status: 'resolved' } }),
    prisma.conversation.count({ where: { workspaceId, status: 'open', assigneeId: userId } }),
    prisma.conversation.count({ where: { workspaceId, status: 'open', assigneeId: null } }),
    prisma.conversation.count({ where: { workspaceId, createdAt: { gte: todayStart } } }),
    prisma.conversation.count({ where: { workspaceId, status: 'resolved', updatedAt: { gte: todayStart } } }),
    // avg first response — lightweight select only
    prisma.conversation.findMany({
      where: { workspaceId, firstResponseAt: { not: null }, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, firstResponseAt: true },
      take: 200,
    }),
    // recent conversations — minimal fields
    prisma.conversation.findMany({
      where: { workspaceId },
      select: {
        id: true,
        status: true,
        lastMessageAt: true,
        slaDueAt: true,
        contact: { select: { name: true } },
        channel:  { select: { name: true, type: true } },
        assignee: { select: { name: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, direction: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 10,
    }),
    // 7 daily counts — all parallel
    ...dayWindows.map(w =>
      prisma.conversation.count({ where: { workspaceId, createdAt: { gte: w.start, lte: w.end } } })
    ),
  ]);

  const avgResponseTime = avgResponseRows.length
    ? Math.round(
        avgResponseRows.reduce(
          (sum, c) => sum + (new Date(c.firstResponseAt!).getTime() - new Date(c.createdAt).getTime()),
          0
        ) / avgResponseRows.length / 60000
      )
    : null;

  const daily = dayWindows.map((w, i) => ({ date: w.date, count: dailyCounts[i] as number }));

  res.json({
    stats: { totalOpen, totalPending, totalResolved, myOpen, unassigned, newToday, resolvedToday, avgResponseTime },
    daily,
    recentConversations,
  });
});

export default router;
