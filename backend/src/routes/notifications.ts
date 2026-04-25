import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// GET /notifications — list for current user in current workspace
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id, workspaceId: req.params.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unread = notifications.filter((n) => !n.read).length;
    res.json({ notifications, unread });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /notifications/mark-all-read
router.patch('/mark-all-read', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, workspaceId: req.params.workspaceId, read: false },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// DELETE /notifications/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// DELETE /notifications — clear all
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.deleteMany({
      where: { userId: req.user!.id, workspaceId: req.params.workspaceId },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

export default router;

// Helper to create a notification and emit via socket
export async function createNotification(
  io: any,
  data: {
    type: string;
    title: string;
    body?: string;
    userId: string;
    workspaceId: string;
    entityType?: string;
    entityId?: string;
  }
) {
  const notification = await prisma.notification.create({ data });
  io.to(`workspace:${data.workspaceId}`).emit('notification:new', notification);
  return notification;
}
