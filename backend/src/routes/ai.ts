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
    select: { aiEnabled: true, aiAutoPilot: true, aiPrompt: true, plan: true },
  });
  res.json(workspace);
});

// Update AI settings
router.patch('/ai', async (req: AuthRequest, res: Response) => {
  const { aiEnabled, aiAutoPilot, aiPrompt } = req.body;
  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });

  if (aiEnabled && workspace?.plan === 'free') {
    return res.status(403).json({ error: 'AI assistant requires a Pro or Agency plan. Please upgrade.' });
  }

  const updated = await prisma.workspace.update({
    where: { id: req.params.workspaceId },
    data: { aiEnabled, aiAutoPilot, aiPrompt },
    select: { aiEnabled: true, aiAutoPilot: true, aiPrompt: true },
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

// AI Suggested Replies
router.get('/conversations/:conversationId/ai-suggestions', async (req: AuthRequest, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'AI not configured' });
  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });
  const conv = await prisma.conversation.findFirst({
    where: { id: req.params.conversationId, workspaceId: req.params.workspaceId },
    include: { contact: true },
  });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const messages = await prisma.message.findMany({
    where: { conversationId: conv.id, isNote: false },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  const history = messages.reverse().map(m => ({
    role: m.direction === 'outbound' ? 'assistant' : 'user',
    content: m.content,
  }));

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const systemPrompt = workspace?.aiPrompt || `You are a helpful customer support assistant for ${workspace?.name}.`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: `${systemPrompt}\n\nGenerate exactly 3 different short suggested reply options for the agent. Each should be a complete, ready-to-send message. Return ONLY a JSON array of 3 strings, nothing else. Example: ["Reply 1", "Reply 2", "Reply 3"]`,
      messages: history.length > 0 ? history as any : [{ role: 'user', content: 'Hello' }],
    });

    const raw = (response.content[0] as any).text.trim();
    const suggestions = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] || '[]');
    res.json({ suggestions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Conversation Summary
router.get('/conversations/:conversationId/ai-summary', async (req: AuthRequest, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'AI not configured' });
  const conv = await prisma.conversation.findFirst({
    where: { id: req.params.conversationId, workspaceId: req.params.workspaceId },
    include: { contact: true },
  });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const messages = await prisma.message.findMany({
    where: { conversationId: conv.id, isNote: false },
    orderBy: { createdAt: 'asc' },
  });
  if (messages.length === 0) return res.json({ summary: 'No messages in this conversation yet.' });

  const transcript = messages.map(m =>
    `[${m.direction === 'inbound' ? conv.contact.name : 'Agent'}]: ${m.content}`
  ).join('\n');

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Summarize this customer support conversation in 2-3 sentences. Focus on the issue, actions taken, and current status:\n\n${transcript}`,
      }],
    });
    res.json({ summary: (response.content[0] as any).text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Intent Detection — detect intent of a message text
router.post('/detect-intent', async (req: AuthRequest, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'AI not configured' });
  const { text, messageId } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Classify this customer message into ONE of these intents: greeting, question, complaint, purchase_intent, support_request, feedback, farewell, escalation, other.\n\nMessage: "${text}"\n\nRespond with ONLY the intent label, nothing else.`,
      }],
    });
    const intent = (response.content[0] as any).text.trim().toLowerCase().replace(/[^a-z_]/g, '');
    if (messageId) {
      await prisma.message.updateMany({ where: { id: messageId }, data: { intent } });
    }
    res.json({ intent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Quality Score — score an outbound agent message 1-5
router.post('/score-quality', async (req: AuthRequest, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'AI not configured' });
  const { messageId, agentMessage, customerMessage } = req.body;
  if (!agentMessage) return res.status(400).json({ error: 'agentMessage required' });

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Rate this customer support response on a scale of 1-5 (1=poor, 5=excellent) based on clarity, helpfulness, tone, and professionalism.\n\n${customerMessage ? `Customer said: "${customerMessage}"\n\n` : ''}Agent replied: "${agentMessage}"\n\nRespond with ONLY a single digit (1-5), nothing else.`,
      }],
    });
    const raw = (response.content[0] as any).text.trim();
    const qualityScore = Math.min(5, Math.max(1, parseInt(raw) || 3));
    if (messageId) {
      await prisma.message.updateMany({ where: { id: messageId }, data: { qualityScore } });
    }
    res.json({ qualityScore });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Auto-Translation ─────────────────────────────────────────────────────────
router.post('/ai/translate', async (req: AuthRequest, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'AI not configured' });
  const { text, targetLang } = req.body as { text: string; targetLang: string };
  if (!text || !targetLang) return res.status(400).json({ error: 'text and targetLang required' });

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Translate the following text to ${targetLang}. Return ONLY the translated text, nothing else, no explanations:\n\n${text}`,
      }],
    });
    res.json({ translated: (response.content[0] as any).text.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI Triage — rank open conversations by urgency ───────────────────────────
router.post('/ai/triage', async (req: AuthRequest, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'AI not configured' });

  try {
    // Fetch up to 25 open conversations with their last 3 messages
    const convs = await prisma.conversation.findMany({
      where: { workspaceId: req.params.workspaceId, status: 'open' },
      include: {
        contact: { select: { name: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 25,
    });

    if (convs.length === 0) return res.json({ rankings: [] });

    const items = convs.map(c => {
      const waitMins = c.lastMessageAt
        ? Math.floor((Date.now() - new Date(c.lastMessageAt).getTime()) / 60000)
        : 0;
      const lastMessages = c.messages
        .reverse()
        .map(m => `[${m.direction === 'inbound' ? c.contact.name : 'Agent'}]: ${m.content}`)
        .join('\n');
      return { id: c.id, contact: c.contact.name, waitingMinutes: waitMins, lastMessages };
    });

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `You are a customer support triage AI. Analyze these ${items.length} open conversations and assign each an urgency score.

Urgency scale:
1 = CRITICAL (angry customer, threat to cancel/leave, emergency)
2 = HIGH (frustrated, waiting long, unresolved complaint)
3 = MEDIUM (general question, normal follow-up)
4 = LOW (simple question, already handled)
5 = INFORMATIONAL (just checking in, positive feedback)

Consider: emotional tone, waiting time, keywords like "cancel", "urgent", "refund", "angry", "help!", etc.

Return ONLY a valid JSON array, nothing else:
[{"id":"...","urgencyScore":1,"reason":"one short sentence why"}]

Conversations:
${JSON.stringify(items, null, 2)}`,
      }],
    });

    const raw = (response.content[0] as any).text.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    const rankings = match ? JSON.parse(match[0]) : [];

    res.json({ rankings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
