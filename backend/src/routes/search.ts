import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

router.get('/', async (req: AuthRequest, res: Response) => {
  const { q } = req.query as any;
  if (!q || q.trim().length < 2) return res.json({ contacts: [], conversations: [], messages: [] });

  const workspaceId = req.params.workspaceId;
  const term = q.trim();

  const [contacts, conversations, messages] = await Promise.all([
    // Contacts by name, phone, email
    prisma.contact.findMany({
      where: {
        workspaceId,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { company: { contains: term, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, name: true, phone: true, email: true, company: true },
    }),

    // Conversations by contact name
    prisma.conversation.findMany({
      where: {
        workspaceId,
        contact: { name: { contains: term, mode: 'insensitive' } },
      },
      take: 5,
      include: {
        contact: { select: { id: true, name: true } },
        channel: { select: { id: true, name: true, type: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),

    // Messages by content
    prisma.message.findMany({
      where: {
        conversation: { workspaceId },
        content: { contains: term, mode: 'insensitive' },
        isNote: false,
      },
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        conversation: {
          include: {
            contact: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  res.json({ contacts, conversations, messages });
});

export default router;
