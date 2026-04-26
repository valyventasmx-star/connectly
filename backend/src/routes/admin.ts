import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
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

// ── Stats ────────────────────────────────────────────────────────────────────
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

// ── Users ────────────────────────────────────────────────────────────────────
router.get('/users', async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '50', search } = req.query as any;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (search) where.OR = [{ name: { contains: search } }, { email: { contains: search } }];

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, isAdmin: true, createdAt: true,
        workspaceMembers: { include: { workspace: { select: { name: true, plan: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.user.count({ where }),
  ]);
  res.json({ users, total });
});

router.patch('/users/:id/admin', async (req: AuthRequest, res: Response) => {
  const { isAdmin } = req.body;
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isAdmin } });
  res.json({ id: user.id, isAdmin: user.isAdmin });
});

// Delete user — also removes workspace memberships (cascade)
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  // Prevent self-deletion
  if (req.params.id === req.user!.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Impersonate — generate a short-lived token for any user
router.post('/users/:id/impersonate', async (req: AuthRequest, res: Response) => {
  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, email: true, name: true, isAdmin: true, avatar: true },
  });
  if (!target) return res.status(404).json({ error: 'User not found' });

  const token = jwt.sign(
    { id: target.id, email: target.email, _impersonatedBy: req.user!.id },
    process.env.JWT_SECRET!,
    { expiresIn: '2h' }
  );
  res.json({ token, user: target });
});

// ── Workspaces ───────────────────────────────────────────────────────────────
router.get('/workspaces', async (_req, res: Response) => {
  const workspaces = await prisma.workspace.findMany({
    include: {
      _count: { select: { members: true, channels: true, contacts: true, conversations: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(workspaces);
});

// Update plan + optional expiry date
router.patch('/workspaces/:id/plan', async (req: AuthRequest, res: Response) => {
  const { plan, planExpiresAt } = req.body;
  const workspace = await prisma.workspace.update({
    where: { id: req.params.id },
    data: {
      plan,
      aiEnabled: plan !== 'free',
      planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : null,
    },
  });
  res.json(workspace);
});

// Delete workspace (cascades all data)
router.delete('/workspaces/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.workspace.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Conversation logs ────────────────────────────────────────────────────────
router.get('/workspaces/:id/conversations', async (req: AuthRequest, res: Response) => {
  const { limit = '30', page = '1' } = req.query as any;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where: { workspaceId: req.params.id },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true } },
        channel: { select: { id: true, name: true, type: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.conversation.count({ where: { workspaceId: req.params.id } }),
  ]);
  res.json({ conversations, total });
});

router.get('/conversations/:id/messages', async (req: AuthRequest, res: Response) => {
  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  res.json({ messages });
});

export default router;
