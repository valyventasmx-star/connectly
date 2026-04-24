import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

router.get('/', async (req: AuthRequest, res: Response) => {
  const templates = await prisma.whatsAppTemplate.findMany({
    where: { workspaceId: req.params.workspaceId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(templates);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, content, language = 'en', category = 'MARKETING', channelId } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'name and content required' });
  const template = await prisma.whatsAppTemplate.create({
    data: { name, content, language, category, channelId, workspaceId: req.params.workspaceId },
  });
  res.status(201).json(template);
});

router.patch('/:templateId', async (req: AuthRequest, res: Response) => {
  const { name, content, language, category, status, channelId } = req.body;
  const template = await prisma.whatsAppTemplate.update({
    where: { id: req.params.templateId },
    data: {
      ...(name !== undefined && { name }),
      ...(content !== undefined && { content }),
      ...(language !== undefined && { language }),
      ...(category !== undefined && { category }),
      ...(status !== undefined && { status }),
      ...(channelId !== undefined && { channelId }),
    },
  });
  res.json(template);
});

router.delete('/:templateId', async (req: AuthRequest, res: Response) => {
  await prisma.whatsAppTemplate.delete({ where: { id: req.params.templateId } });
  res.json({ message: 'Deleted' });
});

export default router;
