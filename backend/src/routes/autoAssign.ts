import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

router.get('/', async (req: AuthRequest, res: Response) => {
  const rules = await prisma.autoAssignRule.findMany({
    where: { workspaceId: req.params.workspaceId },
    orderBy: { createdAt: 'asc' },
  });
  res.json(rules.map(r => ({ ...r, assigneeIds: JSON.parse(r.assigneeIds) })));
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, strategy, channelId, tagId, assigneeIds } = req.body;
  if (!name || !assigneeIds?.length) return res.status(400).json({ error: 'name and assigneeIds required' });
  const rule = await prisma.autoAssignRule.create({
    data: {
      name,
      strategy: strategy || 'round_robin',
      channelId: channelId || null,
      tagId: tagId || null,
      assigneeIds: JSON.stringify(assigneeIds),
      workspaceId: req.params.workspaceId,
    },
  });
  res.json({ ...rule, assigneeIds });
});

router.patch('/:ruleId', async (req: AuthRequest, res: Response) => {
  const { name, strategy, channelId, tagId, assigneeIds, active } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (strategy !== undefined) data.strategy = strategy;
  if (channelId !== undefined) data.channelId = channelId;
  if (tagId !== undefined) data.tagId = tagId;
  if (assigneeIds !== undefined) data.assigneeIds = JSON.stringify(assigneeIds);
  if (active !== undefined) data.active = active;
  const rule = await prisma.autoAssignRule.update({
    where: { id: req.params.ruleId },
    data,
  });
  res.json({ ...rule, assigneeIds: JSON.parse(rule.assigneeIds) });
});

router.delete('/:ruleId', async (req: AuthRequest, res: Response) => {
  await prisma.autoAssignRule.delete({ where: { id: req.params.ruleId } });
  res.json({ success: true });
});

export default router;
