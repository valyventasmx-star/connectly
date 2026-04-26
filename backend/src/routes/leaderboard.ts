import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// GET /api/workspaces/:workspaceId/leaderboard?days=30
router.get('/', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  const days = parseInt(req.query.days as string) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Get all workspace members with their user info
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, avatar: true, email: true } } },
    });

    const stats = await Promise.all(
      members.map(async (member) => {
        const userId = member.userId;

        // Conversations resolved by this agent in period
        const resolved = await prisma.conversation.count({
          where: {
            workspaceId,
            assigneeId: userId,
            status: 'resolved',
            updatedAt: { gte: since },
          },
        });

        // Currently open
        const open = await prisma.conversation.count({
          where: { workspaceId, assigneeId: userId, status: 'open' },
        });

        // Total assigned in period
        const totalAssigned = await prisma.conversation.count({
          where: {
            workspaceId,
            assigneeId: userId,
            createdAt: { gte: since },
          },
        });

        // Avg first response time (minutes)
        const convWithFirstResponse = await prisma.conversation.findMany({
          where: {
            workspaceId,
            assigneeId: userId,
            firstResponseAt: { not: null },
            createdAt: { gte: since },
          },
          select: { createdAt: true, firstResponseAt: true },
          take: 200,
        });

        const avgResponseTime =
          convWithFirstResponse.length > 0
            ? Math.round(
                convWithFirstResponse.reduce(
                  (sum, c) =>
                    sum +
                    (new Date(c.firstResponseAt!).getTime() -
                      new Date(c.createdAt).getTime()),
                  0
                ) /
                  convWithFirstResponse.length /
                  60000
              )
            : null;

        // Messages sent by this agent in period
        const messagesSent = await prisma.message.count({
          where: {
            direction: 'outbound',
            createdAt: { gte: since },
            conversation: { workspaceId, assigneeId: userId },
          },
        });

        const resolutionRate =
          totalAssigned > 0 ? Math.round((resolved / totalAssigned) * 100) : 0;

        return {
          userId,
          name: member.user.name,
          email: member.user.email,
          avatar: member.user.avatar,
          role: member.role,
          resolved,
          open,
          totalAssigned,
          messagesSent,
          avgResponseTime,
          resolutionRate,
        };
      })
    );

    // Sort by resolved (descending)
    stats.sort((a, b) => b.resolved - a.resolved);

    res.json(stats);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
