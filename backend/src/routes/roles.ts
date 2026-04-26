import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

const VALID_ROLES = ['admin', 'supervisor', 'agent', 'viewer'];

// GET /api/workspaces/:workspaceId/members — list members + roles
router.get('/', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  try {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// PATCH /api/workspaces/:workspaceId/members/:memberId — update role
router.patch('/:memberId', async (req: AuthRequest, res: Response) => {
  const { workspaceId, memberId } = req.params;
  const { role, permissions } = req.body as { role?: string; permissions?: string[] };

  if (role && !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    return;
  }

  try {
    const member = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: {
        ...(role ? { role } : {}),
        ...(permissions !== undefined ? { permissions: JSON.stringify(permissions) } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// DELETE /api/workspaces/:workspaceId/members/:memberId — remove member
router.delete('/:memberId', async (req: AuthRequest, res: Response) => {
  const { workspaceId, memberId } = req.params;
  try {
    await prisma.workspaceMember.deleteMany({
      where: { id: memberId, workspaceId },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
