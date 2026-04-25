import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';
import { tryAutoAssign } from '../services/autoAssign';
import { logAudit } from '../services/auditLog';
import { runAutomations } from '../services/automationEngine';

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
  if (search) where.contact = { name: { contains: search } };

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

  const existing = await prisma.conversation.findFirst({
    where: { contactId, channelId, status: 'open' },
  });
  if (existing) return res.json(existing);

  // Get workspace SLA hours
  const workspace = await prisma.workspace.findUnique({
    where: { id: req.params.workspaceId },
    select: { slaHours: true },
  });
  const slaDueAt = new Date(Date.now() + (workspace?.slaHours || 24) * 60 * 60 * 1000);

  const conversation = await prisma.conversation.create({
    data: { contactId, channelId, workspaceId: req.params.workspaceId, status: status || 'open', slaDueAt },
    include: { contact: true, channel: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  // Try auto-assign
  tryAutoAssign(conversation.id, req.params.workspaceId, channelId).catch(console.error);

  // Run automations
  runAutomations(req.params.workspaceId, 'conversation.created', {
    conversationId: conversation.id,
    contactId: conversation.contactId,
    channelId,
    status: conversation.status,
  }).catch(console.error);

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

// Update conversation (status, assignee, tags, snooze)
router.patch('/:conversationId', async (req: AuthRequest, res: Response) => {
  const { status, assigneeId, tagIds, snoozedUntil } = req.body;

  const updateData: any = {};
  if (status !== undefined) updateData.status = status;
  if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
  if (snoozedUntil !== undefined) {
    updateData.snoozedUntil = snoozedUntil ? new Date(snoozedUntil) : null;
    if (snoozedUntil) updateData.status = 'pending';
  }
  if (tagIds !== undefined) {
    updateData.conversationTags = {
      deleteMany: {},
      create: tagIds.map((tagId: string) => ({ tagId })),
    };
  }

  const conversation = await prisma.conversation.update({
    where: { id: req.params.conversationId },
    data: updateData,
    include: {
      contact: true,
      channel: true,
      assignee: { select: { id: true, name: true, avatar: true } },
      conversationTags: { include: { tag: true } },
    },
  });

  // Run automations for status changes
  if (status === 'resolved') {
    runAutomations(req.params.workspaceId, 'conversation.resolved', {
      conversationId: req.params.conversationId,
      contactId: conversation.contactId,
      status,
    }).catch(console.error);
  }

  // Log audit
  if (req.user && (status !== undefined || assigneeId !== undefined)) {
    logAudit(
      req.params.workspaceId,
      req.user.id,
      req.user.name,
      status !== undefined ? `conversation.${status}` : 'conversation.updated',
      'conversation',
      req.params.conversationId,
      { status, assigneeId }
    ).catch(console.error);
  }

  res.json(conversation);
});

export default router;
