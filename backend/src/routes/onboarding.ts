import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

router.get('/', async (req: AuthRequest, res: Response) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: req.params.workspaceId },
    select: { onboardingStep: true, onboardingCompleted: true },
  });
  res.json(workspace || { onboardingStep: 0, onboardingCompleted: false });
});

router.patch('/', async (req: AuthRequest, res: Response) => {
  const { onboardingStep, onboardingCompleted } = req.body;
  const data: any = {};
  if (onboardingStep !== undefined) data.onboardingStep = onboardingStep;
  if (onboardingCompleted !== undefined) data.onboardingCompleted = onboardingCompleted;
  const workspace = await prisma.workspace.update({
    where: { id: req.params.workspaceId },
    data,
    select: { onboardingStep: true, onboardingCompleted: true },
  });
  res.json(workspace);
});

export default router;
