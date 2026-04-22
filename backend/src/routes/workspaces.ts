import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// List all workspaces for current user
router.get('/', async (req: AuthRequest, res: Response) => {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: req.user!.id },
    include: {
      workspace: {
        include: {
          _count: { select: { members: true, channels: true, contacts: true, conversations: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(memberships.map((m) => ({ ...m.workspace, role: m.role })));
});

// Create workspace
router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 50) + '-' + Date.now().toString(36);
  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      description,
      members: { create: { userId: req.user!.id, role: 'owner' } },
    },
  });
  res.status(201).json(workspace);
});

// Get workspace details
router.get('/:workspaceId', requireWorkspace(), async (req: AuthRequest, res: Response) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: req.params.workspaceId },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
      _count: { select: { channels: true, contacts: true, conversations: true } },
    },
  });
  res.json(workspace);
});

// Update workspace
router.patch('/:workspaceId', requireWorkspace(), async (req: AuthRequest, res: Response) => {
  if (req.workspaceMember.role !== 'owner' && req.workspaceMember.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  const { name, description, avatar, timezone } = req.body;
  const workspace = await prisma.workspace.update({
    where: { id: req.params.workspaceId },
    data: { name, description, avatar, timezone },
  });
  res.json(workspace);
});

// Delete workspace
router.delete('/:workspaceId', requireWorkspace(), async (req: AuthRequest, res: Response) => {
  if (req.workspaceMember.role !== 'owner') {
    return res.status(403).json({ error: 'Only owner can delete workspace' });
  }
  await prisma.workspace.delete({ where: { id: req.params.workspaceId } });
  res.json({ message: 'Workspace deleted' });
});

// Invite member
router.post('/:workspaceId/members', requireWorkspace(), async (req: AuthRequest, res: Response) => {
  const { email, role } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: 'User not found with that email' });

  const existing = await prisma.workspaceMember.findFirst({
    where: { workspaceId: req.params.workspaceId, userId: user.id },
  });
  if (existing) return res.status(400).json({ error: 'User is already a member' });

  const member = await prisma.workspaceMember.create({
    data: { workspaceId: req.params.workspaceId, userId: user.id, role: role || 'agent' },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  });
  res.status(201).json(member);
});

// Remove member
router.delete('/:workspaceId/members/:userId', requireWorkspace(), async (req: AuthRequest, res: Response) => {
  await prisma.workspaceMember.deleteMany({
    where: { workspaceId: req.params.workspaceId, userId: req.params.userId },
  });
  res.json({ message: 'Member removed' });
});

export default router;
