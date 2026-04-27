import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// List events in a date range
router.get('/', async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const where: any = { workspaceId: req.params.workspaceId };
  if (from || to) {
    where.startAt = {};
    if (from) where.startAt.gte = new Date(from);
    if (to)   where.startAt.lte = new Date(to);
  }
  const events = await prisma.calendarEvent.findMany({ where, orderBy: { startAt: 'asc' } });
  res.json(events);
});

// Create event
router.post('/', async (req: AuthRequest, res: Response) => {
  const { title, description, startAt, endAt, allDay, color, conversationId, contactId } = req.body;
  if (!title || !startAt) return res.status(400).json({ error: 'title and startAt are required' });
  const event = await prisma.calendarEvent.create({
    data: {
      title, description,
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : null,
      allDay: allDay ?? false,
      color: color || '#6366f1',
      workspaceId: req.params.workspaceId,
      conversationId: conversationId || null,
      contactId: contactId || null,
    },
  });
  res.status(201).json(event);
});

// Update event
router.patch('/:eventId', async (req: AuthRequest, res: Response) => {
  const { title, description, startAt, endAt, allDay, color } = req.body;
  const event = await prisma.calendarEvent.update({
    where: { id: req.params.eventId },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(startAt !== undefined && { startAt: new Date(startAt) }),
      ...(endAt !== undefined && { endAt: endAt ? new Date(endAt) : null }),
      ...(allDay !== undefined && { allDay }),
      ...(color !== undefined && { color }),
    },
  });
  res.json(event);
});

// Delete event
router.delete('/:eventId', async (req: AuthRequest, res: Response) => {
  await prisma.calendarEvent.delete({ where: { id: req.params.eventId } });
  res.json({ message: 'Deleted' });
});

export default router;
