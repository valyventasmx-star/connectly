import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { getIO } from '../services/socket';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// Get AI settings
router.get('/ai', async (req: AuthRequest, res: Response) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: req.params.workspaceId },
    select: { aiEnabled: true, aiPrompt: true, plan: true },
  });
  res.json(workspace);
});

// Update AI settings
router.patch('/ai', async (req: AuthRequest, res: Response) => {
  const { aiEnabled, aiPrompt } = req.body;
  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });

  if (aiEnabled && workspace?.plan === 'free') {
    return res.status(403).json({ error: 'AI assistant requires a Pro or Agency plan. Please upgrade.' });
  }

  const updated = await prisma.workspace.update({
    where: { id: req.params.workspaceId },
    data: { aiEnabled, aiPrompt },
    select: { aiEnabled: true, aiPrompt: true },
  });
  res.json(updated);
});

// Manual AI reply for a conversation
router.post('/:conversationId/ai-reply', async (req: AuthRequest, res: Response) => {
  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: 'AI not configured. Add ANTHROPIC_API_KEY to environment variables.' });
  }

  const conv = await prisma.conversation.findFirst({
    where: { id: req.params.conversationId, workspaceId: req.params.workspaceId },
    include: { channel: true, contact: true },
  });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const messages = await prisma.message.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const history = messages.reverse().map((m) => ({
    role: m.direction === 'outbound' ? 'assistant' : 'user',
    content: m.content,
  }));

  const systemPrompt = workspace?.aiPrompt ||
    `You are a helpful customer support assistant for ${workspace?.name}. Be friendly, concise, and professional. Respond in the same language the customer is using.`;

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages: history.length > 0 ? history as any : [{ role: 'user', content: 'Hello' }],
    });

    const aiContent = (response.content[0] as any).text;

    let waMessageId: string | undefined;
    if (conv.channel.status === 'connected' && conv.channel.accessToken && conv.channel.phoneNumberId && conv.contact.phone) {
      try {
        const result = await sendWhatsAppMessage(conv.channel.accessToken, conv.channel.phoneNumberId, conv.contact.phone, aiContent);
        waMessageId = result.messages?.[0]?.id;
      } catch (e) {
        console.error('WhatsApp send error:', e);
      }
    }

    const message = await prisma.message.create({
      data: {
        content: aiContent,
        type: 'text',
        direction: 'outbound',
        status: waMessageId ? 'sent' : 'pending',
        waMessageId,
        isAiReply: true,
        conversationId: conv.id,
        senderName: 'AI Assistant',
      },
    });

    await prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: new Date() },
    });

    const io = getIO();
    io.to(`workspace:${req.params.workspaceId}`).emit('new_message', { conversationId: conv.id, message });

    res.json(message);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
