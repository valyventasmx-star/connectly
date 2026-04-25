import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

router.get('/', async (req: AuthRequest, res: Response) => {
  const segments = await prisma.contactSegment.findMany({
    where: { workspaceId: req.params.workspaceId },
    orderBy: { createdAt: 'asc' },
  });
  res.json(segments.map(s => ({ ...s, filters: JSON.parse(s.filters) })));
});

// Preview segment count
router.post('/preview', async (req: AuthRequest, res: Response) => {
  const { filters } = req.body;
  const where = buildContactWhere(req.params.workspaceId, filters || []);
  const count = await prisma.contact.count({ where });
  res.json({ count });
});

// Get contacts in a segment
router.get('/:segmentId/contacts', async (req: AuthRequest, res: Response) => {
  const segment = await prisma.contactSegment.findFirst({
    where: { id: req.params.segmentId, workspaceId: req.params.workspaceId },
  });
  if (!segment) return res.status(404).json({ error: 'Segment not found' });

  const filters = JSON.parse(segment.filters);
  const where = buildContactWhere(req.params.workspaceId, filters);
  const contacts = await prisma.contact.findMany({ where, take: 500, orderBy: { createdAt: 'desc' } });
  res.json({ contacts, total: contacts.length });
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, description, filters, color } = req.body;
  if (!name || !filters) return res.status(400).json({ error: 'name and filters required' });
  const segment = await prisma.contactSegment.create({
    data: {
      name, description, color: color || '#6366f1',
      filters: JSON.stringify(filters),
      workspaceId: req.params.workspaceId,
    },
  });
  res.json({ ...segment, filters });
});

router.patch('/:segmentId', async (req: AuthRequest, res: Response) => {
  const { name, description, filters, color } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (color !== undefined) data.color = color;
  if (filters !== undefined) data.filters = JSON.stringify(filters);
  const segment = await prisma.contactSegment.update({ where: { id: req.params.segmentId }, data });
  res.json({ ...segment, filters: JSON.parse(segment.filters) });
});

router.delete('/:segmentId', async (req: AuthRequest, res: Response) => {
  await prisma.contactSegment.delete({ where: { id: req.params.segmentId } });
  res.json({ success: true });
});

function buildContactWhere(workspaceId: string, filters: any[]): any {
  const where: any = { workspaceId };
  for (const f of filters) {
    switch (f.field) {
      case 'lifecycleStage':
        if (f.operator === 'equals') where.lifecycleStage = f.value;
        if (f.operator === 'not_equals') where.lifecycleStage = { not: f.value };
        break;
      case 'name':
        if (f.operator === 'contains') where.name = { contains: f.value, mode: 'insensitive' };
        break;
      case 'email':
        if (f.operator === 'is_set') where.email = { not: null };
        if (f.operator === 'is_not_set') where.email = null;
        if (f.operator === 'contains') where.email = { contains: f.value, mode: 'insensitive' };
        break;
      case 'company':
        if (f.operator === 'contains') where.company = { contains: f.value, mode: 'insensitive' };
        if (f.operator === 'equals') where.company = f.value;
        break;
      case 'phone':
        if (f.operator === 'is_set') where.phone = { not: null };
        if (f.operator === 'is_not_set') where.phone = null;
        break;
    }
  }
  return where;
}

export default router;
