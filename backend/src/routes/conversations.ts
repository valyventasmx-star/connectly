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

// Snooze a conversation
router.post('/:conversationId/snooze', async (req: AuthRequest, res: Response) => {
  const { until } = req.body;
  if (!until) return res.status(400).json({ error: 'until (datetime) is required' });
  const conversation = await prisma.conversation.update({
    where: { id: req.params.conversationId },
    data: { snoozedUntil: new Date(until), status: 'snoozed' },
  });
  res.json(conversation);
});

// Un-snooze a conversation
router.post('/:conversationId/unsnooze', async (req: AuthRequest, res: Response) => {
  const conversation = await prisma.conversation.update({
    where: { id: req.params.conversationId },
    data: { snoozedUntil: null, status: 'open' },
  });
  res.json(conversation);
});

// Merge conversations: move all messages from secondaryId into primaryId, delete secondary
router.post('/merge', async (req: AuthRequest, res: Response) => {
  const { primaryId, secondaryId } = req.body;
  if (!primaryId || !secondaryId) return res.status(400).json({ error: 'primaryId and secondaryId required' });
  if (primaryId === secondaryId) return res.status(400).json({ error: 'Cannot merge conversation with itself' });

  try {
    const [primary, secondary] = await Promise.all([
      prisma.conversation.findFirst({ where: { id: primaryId, workspaceId: req.params.workspaceId } }),
      prisma.conversation.findFirst({ where: { id: secondaryId, workspaceId: req.params.workspaceId } }),
    ]);
    if (!primary || !secondary) return res.status(404).json({ error: 'One or both conversations not found' });

    await prisma.$transaction([
      prisma.message.updateMany({ where: { conversationId: secondaryId }, data: { conversationId: primaryId } }),
      prisma.conversation.delete({ where: { id: secondaryId } }),
    ]);

    const merged = await prisma.conversation.findUnique({
      where: { id: primaryId },
      include: { contact: true, assignee: true, channel: true },
    });
    res.json(merged);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Merge failed' });
  }
});

// ── Bulk actions ─────────────────────────────────────────────────────────────
router.post('/bulk', async (req: AuthRequest, res: Response) => {
  const { ids, action, value } = req.body as {
    ids: string[];
    action: 'resolve' | 'reopen' | 'assign' | 'tag' | 'delete';
    value?: string;
  };
  if (!ids?.length || !action) return res.status(400).json({ error: 'ids and action required' });

  // Verify all convs belong to this workspace
  const count = await prisma.conversation.count({
    where: { id: { in: ids }, workspaceId: req.params.workspaceId },
  });
  if (count !== ids.length) return res.status(403).json({ error: 'Unauthorized' });

  if (action === 'resolve') {
    await prisma.conversation.updateMany({ where: { id: { in: ids } }, data: { status: 'resolved' } });
  } else if (action === 'reopen') {
    await prisma.conversation.updateMany({ where: { id: { in: ids } }, data: { status: 'open' } });
  } else if (action === 'assign') {
    await prisma.conversation.updateMany({ where: { id: { in: ids } }, data: { assigneeId: value || null } });
  } else if (action === 'delete') {
    await prisma.conversation.deleteMany({ where: { id: { in: ids } } });
  }

  res.json({ updated: ids.length });
});

// ── Revenue attribution ───────────────────────────────────────────────────────
router.post('/:conversationId/convert', async (req: AuthRequest, res: Response) => {
  const { value } = req.body as { value?: number };
  const conv = await prisma.conversation.findFirst({
    where: { id: req.params.conversationId, workspaceId: req.params.workspaceId },
  });
  if (!conv) return res.status(404).json({ error: 'Not found' });

  const updated = await prisma.conversation.update({
    where: { id: conv.id },
    data: { convertedAt: new Date(), convertedValue: value || 0 },
  });
  res.json(updated);
});

router.delete('/:conversationId/convert', async (req: AuthRequest, res: Response) => {
  await prisma.conversation.updateMany({
    where: { id: req.params.conversationId, workspaceId: req.params.workspaceId },
    data: { convertedAt: null, convertedValue: null },
  });
  res.json({ ok: true });
});

export default router;
