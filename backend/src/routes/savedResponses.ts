import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// List saved responses
router.get('/', async (req: AuthRequest, res: Response) => {
  const { search, category } = req.query as any;
  const where: any = { workspaceId: req.params.workspaceId };
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category) where.category = category;

  const responses = await prisma.savedResponse.findMany({
    where,
    orderBy: { title: 'asc' },
  });
  res.json(responses);
});

// Create saved response
router.post('/', async (req: AuthRequest, res: Response) => {
  const { title, content, category } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content are required' });

  const saved = await prisma.savedResponse.create({
    data: { title, content, category, workspaceId: req.params.workspaceId },
  });
  res.status(201).json(saved);
});

// Update saved response
router.patch('/:responseId', async (req: AuthRequest, res: Response) => {
  const { title, content, category } = req.body;
  const saved = await prisma.savedResponse.update({
    where: { id: req.params.responseId },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(category !== undefined && { category }),
    },
  });
  res.json(saved);
});

// Delete saved response
router.delete('/:responseId', async (req: AuthRequest, res: Response) => {
  await prisma.savedResponse.delete({ where: { id: req.params.responseId } });
  res.json({ message: 'Deleted' });
});

export default router;
