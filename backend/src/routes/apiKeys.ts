import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import crypto from 'crypto';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

router.get('/', async (req: AuthRequest, res: Response) => {
  const keys = await prisma.apiKey.findMany({
    where: { workspaceId: req.params.workspaceId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, expiresAt: true, createdAt: true, userId: true },
  });
  res.json(keys);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, expiresAt } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const rawKey = 'cnx_' + crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 12);

  const apiKey = await prisma.apiKey.create({
    data: {
      name,
      keyHash,
      keyPrefix,
      workspaceId: req.params.workspaceId,
      userId: req.user!.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  res.json({ ...apiKey, key: rawKey }); // Only returned once
});

router.delete('/:keyId', async (req: AuthRequest, res: Response) => {
  await prisma.apiKey.deleteMany({
    where: { id: req.params.keyId, workspaceId: req.params.workspaceId },
  });
  res.json({ success: true });
});

export default router;
