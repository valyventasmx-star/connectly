import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

router.get('/', async (req: AuthRequest, res: Response) => {
  const rules = await prisma.automationRule.findMany({
    where: { workspaceId: req.params.workspaceId },
    orderBy: { createdAt: 'asc' },
  });
  res.json(rules.map(r => ({
    ...r,
    trigger: JSON.parse(r.trigger),
    actions: JSON.parse(r.actions),
  })));
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, description, trigger, actions } = req.body;
  if (!name || !trigger || !actions) return res.status(400).json({ error: 'name, trigger, actions required' });
  const rule = await prisma.automationRule.create({
    data: {
      name, description,
      trigger: JSON.stringify(trigger),
      actions: JSON.stringify(actions),
      workspaceId: req.params.workspaceId,
    },
  });
  res.json({ ...rule, trigger, actions });
});

router.patch('/:ruleId', async (req: AuthRequest, res: Response) => {
  const { name, description, trigger, actions, active } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (trigger !== undefined) data.trigger = JSON.stringify(trigger);
  if (actions !== undefined) data.actions = JSON.stringify(actions);
  if (active !== undefined) data.active = active;
  const rule = await prisma.automationRule.update({
    where: { id: req.params.ruleId },
    data,
  });
  res.json({ ...rule, trigger: JSON.parse(rule.trigger), actions: JSON.parse(rule.actions) });
});

router.delete('/:ruleId', async (req: AuthRequest, res: Response) => {
  await prisma.automationRule.delete({ where: { id: req.params.ruleId } });
  res.json({ success: true });
});

export default router;
