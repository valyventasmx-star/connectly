import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// List conversations
router.get('/', async (req: AuthRequest, res: Response) => {
  const { status, channelId, assigneeId, search, page = '1', limit = '50' } = req.query as any;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: any = { workspaceId: req.params.workspaceId };
  if (status) where.status = status;
  if (channelId) where.channelId = channelId;
  if (assigneeId === 'null') where.assigneeId = null;
  else if (assigneeId) where.assigneeId = assigneeId;
  if (search) {
    where.contact = { name: { contains: search } };
  }

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        contact: { include: { contactTags: { include: { tag: true } } } },
        channel: true,
        assignee: { select: { id: true, name: true, avatar: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        conversationTags: { include: { tag: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.conversation.count({ where }),
  ]);

  res.json({ conversations, total, page: parseInt(page), limit: parseInt(limit) });
});

// Create conversation
router.post('/', async (req: AuthRequest, res: Response) => {
  const { contactId, channelId, status } = req.body;
  if (!contactId || !channelId) return res.status(400).json({ error: 'contactId and channelId required' });

  // Check for existing open conversation
  const existing = await prisma.conversation.findFirst({
    where: { contactId, channelId, status: 'open' },
  });
  if (existing) return res.json(existing);

  const conversation = await prisma.conversation.create({
    data: {
      contactId,
      channelId,
      workspaceId: req.params.workspaceId,
      status: status || 'open',
    },
    include: {
      contact: true,
      channel: true,
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  res.status(201).json(conversation);
});

// Get conversation
router.get('/:conversationId', async (req: AuthRequest, res: Response) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.conversationId, workspaceId: req.params.workspaceId },
    include: {
      contact: { include: { contactTags: { include: { tag: true } } } },
      channel: true,
      assignee: { select: { id: true, name: true, avatar: true } },
      conversationTags: { include: { tag: true } },
    },
  });
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  res.json(conversation);
});

// Update conversation (status, assignee, tags)
router.patch('/:conversationId', async (req: AuthRequest, res: Response) => {
  const { status, assigneeId, tagIds } = req.body;
  const conversation = await prisma.conversation.update({
    where: { id: req.params.conversationId },
    data: {
      status,
      assigneeId,
      conversationTags: tagIds !== undefined
        ? { deleteMany: {}, create: tagIds.map((tagId: string) => ({ tagId })) }
        : undefined,
    },
    include: {
      contact: true,
      channel: true,
      assignee: { select: { id: true, name: true, avatar: true } },
      conversationTags: { include: { tag: true } },
    },
  });
  res.json(conversation);
});

export default router;
