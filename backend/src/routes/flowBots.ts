import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// GET /flow-bots
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const bots = await prisma.flowBot.findMany({
      where: { workspaceId: req.params.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(bots);
  } catch {
    res.status(500).json({ error: 'Failed to fetch flow bots' });
  }
});

// GET /flow-bots/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const bot = await prisma.flowBot.findFirst({
      where: { id: req.params.id, workspaceId: req.params.workspaceId },
    });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    res.json(bot);
  } catch {
    res.status(500).json({ error: 'Failed to fetch bot' });
  }
});

// POST /flow-bots
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, trigger, nodes, edges, channelId } = req.body;
    const bot = await prisma.flowBot.create({
      data: {
        name,
        description,
        trigger: JSON.stringify(trigger ?? { type: 'any_message', keywords: [] }),
        nodes: JSON.stringify(nodes ?? []),
        edges: JSON.stringify(edges ?? []),
        channelId,
        workspaceId: req.params.workspaceId,
      },
    });
    res.status(201).json(bot);
  } catch {
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

// PATCH /flow-bots/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, trigger, nodes, edges, channelId, active } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (trigger !== undefined) data.trigger = JSON.stringify(trigger);
    if (nodes !== undefined) data.nodes = JSON.stringify(nodes);
    if (edges !== undefined) data.edges = JSON.stringify(edges);
    if (channelId !== undefined) data.channelId = channelId;
    if (active !== undefined) data.active = active;
    const bot = await prisma.flowBot.update({ where: { id: req.params.id }, data });
    res.json(bot);
  } catch {
    res.status(500).json({ error: 'Failed to update bot' });
  }
});

// DELETE /flow-bots/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.flowBot.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

// POST /flow-bots/:id/toggle — enable/disable
router.post('/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const bot = await prisma.flowBot.findFirst({
      where: { id: req.params.id, workspaceId: req.params.workspaceId },
    });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    const updated = await prisma.flowBot.update({
      where: { id: req.params.id },
      data: { active: !bot.active },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to toggle bot' });
  }
});

export default router;
