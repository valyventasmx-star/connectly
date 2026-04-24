import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

const LIFECYCLE_STAGES = ['new_lead', 'hot_lead', 'payment', 'customer', 'cold_lead'];

router.get('/lifecycle', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;

  const stageCounts = await Promise.all(
    LIFECYCLE_STAGES.map(async (stage) => ({
      stage,
      count: await prisma.contact.count({ where: { workspaceId, lifecycleStage: stage } }),
    }))
  );

  const total = await prisma.contact.count({ where: { workspaceId } });

  // Conversion rates between stages
  const funnel = stageCounts.map((s, i) => {
    const prev = i > 0 ? stageCounts[i - 1].count : total;
    return {
      ...s,
      conversionRate: prev > 0 ? Math.round((s.count / prev) * 100 * 100) / 100 : 0,
    };
  });

  res.json({ funnel, total });
});

router.get('/conversations', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [open, resolved, assigned, unassigned, thisMonth] = await Promise.all([
    prisma.conversation.count({ where: { workspaceId, status: 'open' } }),
    prisma.conversation.count({ where: { workspaceId, status: 'resolved' } }),
    prisma.conversation.count({ where: { workspaceId, assigneeId: { not: null } } }),
    prisma.conversation.count({ where: { workspaceId, assigneeId: null } }),
    prisma.conversation.count({ where: { workspaceId, createdAt: { gte: thirtyDaysAgo } } }),
  ]);

  // Daily for last 30 days
  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const start = new Date(date.setHours(0, 0, 0, 0));
    const end = new Date(date.setHours(23, 59, 59, 999));
    const count = await prisma.conversation.count({
      where: { workspaceId, createdAt: { gte: start, lte: end } },
    });
    daily.push({ date: start.toISOString().split('T')[0], count });
  }

  res.json({ open, resolved, assigned, unassigned, thisMonth, daily });
});

export default router;
