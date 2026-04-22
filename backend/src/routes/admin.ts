import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const requireAdmin = (req: AuthRequest, res: Response, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  prisma.user.findUnique({ where: { id: req.user.id } }).then((user) => {
    if (!user?.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
  });
};

router.use(requireAdmin);

router.get('/stats', async (_req, res: Response) => {
  const [totalUsers, totalWorkspaces, totalConversations, totalMessages, planCounts] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.workspace.groupBy({ by: ['plan'], _count: true }),
  ]);
  res.json({ totalUsers, totalWorkspaces, totalConversations, totalMessages, planCounts });
});

router.get('/users', async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '50', search } = req.query as any;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (search) where.OR = [{ name: { contains: search } }, { email: { contains: search } }];

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, isAdmin: true, createdAt: true, workspaceMembers: { include: { workspace: { select: { name: true, plan: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.user.count({ where }),
  ]);
  res.json({ users, total });
});

router.get('/workspaces', async (_req, res: Response) => {
  const workspaces = await prisma.workspace.findMany({
    include: {
      _count: { select: { members: true, channels: true, contacts: true, conversations: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(workspaces);
});

router.patch('/workspaces/:id/plan', async (req: AuthRequest, res: Response) => {
  const { plan } = req.body;
  const workspace = await prisma.workspace.update({
    where: { id: req.params.id },
    data: { plan, aiEnabled: plan !== 'free' },
  });
  res.json(workspace);
});

router.patch('/users/:id/admin', async (req: AuthRequest, res: Response) => {
  const { isAdmin } = req.body;
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isAdmin } });
  res.json({ id: user.id, isAdmin: user.isAdmin });
});

export default router;
