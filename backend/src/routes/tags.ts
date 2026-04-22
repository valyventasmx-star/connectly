import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

router.get('/', async (req: AuthRequest, res: Response) => {
  const tags = await prisma.tag.findMany({
    where: { workspaceId: req.params.workspaceId },
    orderBy: { name: 'asc' },
  });
  res.json(tags);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const tag = await prisma.tag.create({
    data: { name, color: color || '#6366f1', workspaceId: req.params.workspaceId },
  });
  res.status(201).json(tag);
});

router.patch('/:tagId', async (req: AuthRequest, res: Response) => {
  const { name, color } = req.body;
  const tag = await prisma.tag.update({ where: { id: req.params.tagId }, data: { name, color } });
  res.json(tag);
});

router.delete('/:tagId', async (req: AuthRequest, res: Response) => {
  await prisma.tag.delete({ where: { id: req.params.tagId } });
  res.json({ message: 'Tag deleted' });
});

export default router;
