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
  const funnel = stageCounts.map((s, i) => {
    const prev = i > 0 ? stageCounts[i - 1].count : total;
    return { ...s, conversionRate: prev > 0 ? Math.round((s.count / prev) * 10000) / 100 : 0 };
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

  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const start = new Date(date.setHours(0, 0, 0, 0));
    const end = new Date(new Date(start).setHours(23, 59, 59, 999));
    const count = await prisma.conversation.count({
      where: { workspaceId, createdAt: { gte: start, lte: end } },
    });
    daily.push({ date: start.toISOString().split('T')[0], count });
  }

  res.json({ open, resolved, assigned, unassigned, thisMonth, daily });
});

// Agent leaderboard
router.get('/leaderboard', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get all workspace members
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  });

  const leaderboard = await Promise.all(
    members.map(async (m) => {
      const [resolved, assigned, avgResponseMs] = await Promise.all([
        prisma.conversation.count({
          where: { workspaceId, assigneeId: m.userId, status: 'resolved', updatedAt: { gte: thirtyDaysAgo } },
        }),
        prisma.conversation.count({
          where: { workspaceId, assigneeId: m.userId },
        }),
        // Average first response time in ms
        prisma.conversation.aggregate({
          where: { workspaceId, assigneeId: m.userId, firstResponseAt: { not: null } },
          _avg: {},
        }),
      ]);

      // Calc avg response time manually
      const convs = await prisma.conversation.findMany({
        where: { workspaceId, assigneeId: m.userId, firstResponseAt: { not: null } },
        select: { createdAt: true, firstResponseAt: true },
        take: 100,
      });
      const avgMs = convs.length
        ? convs.reduce((sum, c) => sum + (new Date(c.firstResponseAt!).getTime() - new Date(c.createdAt).getTime()), 0) / convs.length
        : null;

      return {
        user: m.user,
        resolved,
        assigned,
        avgResponseTime: avgMs ? Math.round(avgMs / 60000) : null, // in minutes
      };
    })
  );

  leaderboard.sort((a, b) => b.resolved - a.resolved);
  res.json(leaderboard);
});

// Tag report
router.get('/tags', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;

  const tags = await prisma.tag.findMany({
    where: { workspaceId },
    include: {
      conversationTags: {
        include: { conversation: { select: { status: true } } },
      },
    },
  });

  const report = tags.map((tag) => {
    const total = tag.conversationTags.length;
    const resolved = tag.conversationTags.filter(ct => ct.conversation.status === 'resolved').length;
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      total,
      resolved,
      resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    };
  }).sort((a, b) => b.total - a.total);

  res.json(report);
});

// CSV export: conversations (also accepts ?token= for direct download)
router.get('/export/conversations', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  const convs = await prisma.conversation.findMany({
    where: { workspaceId },
    include: {
      contact: { select: { name: true, phone: true, email: true } },
      channel: { select: { name: true } },
      assignee: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const header = 'id,status,contact,phone,email,channel,assignee,created_at,last_message_at';
  const rows = convs.map(c =>
    [
      c.id, c.status,
      `"${c.contact.name}"`,
      c.contact.phone || '',
      c.contact.email || '',
      c.channel.name,
      c.assignee?.name || '',
      c.createdAt.toISOString(),
      c.lastMessageAt?.toISOString() || '',
    ].join(',')
  );

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="conversations.csv"');
  res.send([header, ...rows].join('\n'));
});

// CSV export: contacts
router.get('/export/contacts', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  const contacts = await prisma.contact.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  const header = 'id,name,phone,email,company,lifecycle_stage,created_at';
  const rows = contacts.map(c =>
    [
      c.id,
      `"${c.name}"`,
      c.phone || '',
      c.email || '',
      `"${c.company || ''}"`,
      c.lifecycleStage || '',
      c.createdAt.toISOString(),
    ].join(',')
  );

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
  res.send([header, ...rows].join('\n'));
});

export default router;
