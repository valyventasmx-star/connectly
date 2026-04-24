import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// Get activity for a contact
router.get('/:contactId/activity', async (req: AuthRequest, res: Response) => {
  const activities = await prisma.contactActivity.findMany({
    where: {
      contactId: req.params.contactId,
      workspaceId: req.params.workspaceId,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(activities);
});

// Add activity note
router.post('/:contactId/activity', async (req: AuthRequest, res: Response) => {
  const { description, type = 'note_added', metadata } = req.body;
  if (!description) return res.status(400).json({ error: 'description is required' });

  const activity = await prisma.contactActivity.create({
    data: {
      type,
      description,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      contactId: req.params.contactId,
      workspaceId: req.params.workspaceId,
    },
  });
  res.status(201).json(activity);
});

export default router;
