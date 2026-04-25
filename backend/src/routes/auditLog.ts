import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

router.get('/', async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '50', action } = req.query as any;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: any = { workspaceId: req.params.workspaceId };
  if (action) where.action = { contains: action };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
});

export default router;
