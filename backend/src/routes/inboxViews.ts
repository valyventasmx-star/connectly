import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

router.get('/', async (req: AuthRequest, res: Response) => {
  const views = await prisma.inboxView.findMany({
    where: { workspaceId: req.params.workspaceId, userId: req.user!.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json(views);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, filters } = req.body;
  if (!name || !filters) return res.status(400).json({ error: 'name and filters required' });
  const view = await prisma.inboxView.create({
    data: {
      name,
      filters: JSON.stringify(filters),
      workspaceId: req.params.workspaceId,
      userId: req.user!.id,
    },
  });
  res.json(view);
});

router.delete('/:viewId', async (req: AuthRequest, res: Response) => {
  await prisma.inboxView.deleteMany({
    where: { id: req.params.viewId, workspaceId: req.params.workspaceId, userId: req.user!.id },
  });
  res.json({ success: true });
});

export default router;
