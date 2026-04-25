import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });

// Public CSAT submission (no auth needed — uses conversationId as token)
router.post('/submit', async (req: Request, res: Response) => {
  const { conversationId, score, comment } = req.body;
  if (!conversationId || !score) return res.status(400).json({ error: 'conversationId and score required' });
  if (score < 1 || score > 5) return res.status(400).json({ error: 'score must be 1-5' });

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, contactId: true, workspaceId: true, csatScore: true },
  });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  // Update conversation score
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { csatScore: score },
  });

  await prisma.csatResponse.create({
    data: {
      score,
      comment: comment || null,
      conversationId,
      contactId: conv.contactId,
      workspaceId: conv.workspaceId,
    },
  });

  res.json({ success: true });
});

// Protected: get CSAT stats for workspace
router.use(authenticate, requireWorkspace());

router.get('/', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const responses = await prisma.csatResponse.findMany({
    where: { workspaceId, createdAt: { gte: thirtyDaysAgo } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const total = responses.length;
  const avg = total ? Math.round((responses.reduce((s, r) => s + r.score, 0) / total) * 10) / 10 : null;
  const distribution = [1, 2, 3, 4, 5].map(score => ({
    score,
    count: responses.filter(r => r.score === score).length,
  }));

  res.json({ total, avg, distribution, responses });
});

// Send CSAT request for a conversation
router.post('/send/:conversationId', authenticate, requireWorkspace(), async (req: AuthRequest, res: Response) => {
  const { conversationId } = req.params;
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, workspaceId: req.params.workspaceId },
    include: { contact: { select: { name: true, phone: true } } },
  });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { csatSentAt: new Date() },
  });

  res.json({ success: true, conversationId });
});

export default router;
