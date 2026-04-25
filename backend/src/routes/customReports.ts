import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// Build a custom report
router.post('/build', async (req: AuthRequest, res: Response) => {
  const { metric, groupBy, dateFrom, dateTo, channelId, assigneeId } = req.body;
  const wid = req.params.workspaceId;
  const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = dateTo ? new Date(dateTo) : new Date();

  const baseWhere: any = {
    workspaceId: wid,
    createdAt: { gte: from, lte: to },
  };
  if (channelId) baseWhere.channelId = channelId;
  if (assigneeId) baseWhere.assigneeId = assigneeId;

  try {
    let rows: any[] = [];

    if (metric === 'conversations') {
      if (groupBy === 'day') {
        const convs = await prisma.conversation.findMany({
          where: baseWhere,
          select: { createdAt: true, status: true, assigneeId: true, channelId: true },
          orderBy: { createdAt: 'asc' },
        });
        const map: Record<string, number> = {};
        for (const c of convs) {
          const day = c.createdAt.toISOString().slice(0, 10);
          map[day] = (map[day] || 0) + 1;
        }
        rows = Object.entries(map).map(([date, count]) => ({ date, count }));
      } else if (groupBy === 'channel') {
        const channels = await prisma.channel.findMany({ where: { workspaceId: wid }, select: { id: true, name: true } });
        for (const ch of channels) {
          const count = await prisma.conversation.count({ where: { ...baseWhere, channelId: ch.id } });
          rows.push({ label: ch.name, count });
        }
      } else if (groupBy === 'agent') {
        const members = await prisma.workspaceMember.findMany({
          where: { workspaceId: wid },
          include: { user: { select: { id: true, name: true } } },
        });
        for (const m of members) {
          const count = await prisma.conversation.count({ where: { ...baseWhere, assigneeId: m.userId } });
          rows.push({ label: m.user.name, count });
        }
      } else if (groupBy === 'status') {
        for (const status of ['open', 'resolved', 'snoozed']) {
          const count = await prisma.conversation.count({ where: { ...baseWhere, status } });
          rows.push({ label: status, count });
        }
      }
    } else if (metric === 'messages') {
      const msgs = await prisma.message.findMany({
        where: { conversation: { workspaceId: wid }, createdAt: { gte: from, lte: to } },
        select: { createdAt: true, direction: true },
      });
      if (groupBy === 'day') {
        const map: Record<string, { inbound: number; outbound: number }> = {};
        for (const m of msgs) {
          const day = m.createdAt.toISOString().slice(0, 10);
          if (!map[day]) map[day] = { inbound: 0, outbound: 0 };
          map[day][m.direction as 'inbound' | 'outbound']++;
        }
        rows = Object.entries(map).map(([date, counts]) => ({ date, ...counts }));
      } else {
        const inbound = msgs.filter(m => m.direction === 'inbound').length;
        const outbound = msgs.filter(m => m.direction === 'outbound').length;
        rows = [{ label: 'Inbound', count: inbound }, { label: 'Outbound', count: outbound }];
      }
    } else if (metric === 'csat') {
      const responses = await prisma.csatResponse.findMany({
        where: { workspaceId: wid, createdAt: { gte: from, lte: to } },
        select: { score: true, createdAt: true },
      });
      if (groupBy === 'score') {
        for (let s = 1; s <= 5; s++) {
          rows.push({ label: `${s} star${s > 1 ? 's' : ''}`, count: responses.filter(r => r.score === s).length });
        }
      } else {
        const avg = responses.length > 0 ? (responses.reduce((a, r) => a + r.score, 0) / responses.length).toFixed(2) : '0';
        rows = [{ label: 'Responses', count: responses.length }, { label: 'Avg Score', count: Number(avg) }];
      }
    } else if (metric === 'response_time') {
      const convs = await prisma.conversation.findMany({
        where: { ...baseWhere, firstResponseAt: { not: null } },
        select: { createdAt: true, firstResponseAt: true, assigneeId: true },
      });
      if (groupBy === 'day') {
        const map: Record<string, number[]> = {};
        for (const c of convs) {
          const day = c.createdAt.toISOString().slice(0, 10);
          if (!map[day]) map[day] = [];
          const minutes = Math.floor((c.firstResponseAt!.getTime() - c.createdAt.getTime()) / 60000);
          map[day].push(minutes);
        }
        rows = Object.entries(map).map(([date, times]) => ({
          date,
          avgMinutes: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        }));
      } else {
        const times = convs.map(c => (c.firstResponseAt!.getTime() - c.createdAt.getTime()) / 60000);
        const avg = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        rows = [{ label: 'Avg Response (min)', count: avg }];
      }
    }

    res.json({ metric, groupBy, from, to, rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
