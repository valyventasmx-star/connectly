import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { getIO } from '../services/socket';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// Fire outbound webhooks asynchronously
async function fireWebhooks(workspaceId: string, event: string, payload: any) {
  try {
    const hooks = await prisma.outboundWebhook.findMany({
      where: { workspaceId, active: true },
    });
    for (const hook of hooks) {
      const events: string[] = JSON.parse(hook.events || '[]');
      if (!events.includes(event)) continue;
      const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
      try {
        const url = new URL(hook.url);
        const lib = url.protocol === 'https:' ? https : http;
        const reqOptions = {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            ...(hook.secret ? { 'X-Webhook-Secret': hook.secret } : {}),
          },
        };
        const req = lib.request(reqOptions);
        req.on('error', () => {});
        req.write(body);
        req.end();
      } catch {}
    }
  } catch {}
}

// Get messages for conversation
router.get('/:conversationId/messages', async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '100' } = req.query as any;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const conv = await prisma.conversation.findFirst({
    where: { id: req.params.conversationId, workspaceId: req.params.workspaceId },
  });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: req.params.conversationId },
      include: { reactions: true },
      orderBy: { createdAt: 'asc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.message.count({ where: { conversationId: req.params.conversationId } }),
  ]);

  await prisma.conversation.update({
    where: { id: req.params.conversationId },
    data: { unreadCount: 0 },
  });

  res.json({ messages, total });
});

// Send message
router.post('/:conversationId/messages', async (req: AuthRequest, res: Response) => {
  const { content, type = 'text', isNote = false } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });

  const conv = await prisma.conversation.findFirst({
    where: { id: req.params.conversationId, workspaceId: req.params.workspaceId },
    include: { channel: true, contact: true },
  });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  let waMessageId: string | undefined;

  if (!isNote && conv.channel.status === 'connected' && conv.channel.accessToken && conv.channel.phoneNumberId && conv.contact.phone) {
    try {
      const result = await sendWhatsAppMessage(
        conv.channel.accessToken,
        conv.channel.phoneNumberId,
        conv.contact.phone,
        content,
        type
      );
      waMessageId = result.messages?.[0]?.id;
    } catch (err: any) {
      console.error('WhatsApp send error:', err.response?.data || err.message);
    }
  }

  // Track first response time
  const isFirstResponse = !isNote && !conv.firstResponseAt;

  const message = await prisma.message.create({
    data: {
      content, type,
      direction: 'outbound',
      status: isNote ? 'sent' : (waMessageId ? 'sent' : 'pending'),
      waMessageId,
      isNote: Boolean(isNote),
      conversationId: conv.id,
      senderId: req.user!.id,
      senderName: req.user!.name,
    },
    include: { reactions: true },
  });

  await prisma.conversation.update({
    where: { id: conv.id },
    data: {
      lastMessageAt: new Date(),
      status: 'open',
      ...(isFirstResponse && { firstResponseAt: new Date() }),
    },
  });

  const io = getIO();
  io.to(`workspace:${req.params.workspaceId}`).emit('new_message', {
    conversationId: conv.id,
    message,
  });

  if (!isNote) {
    fireWebhooks(req.params.workspaceId, 'message.sent', { message, conversationId: conv.id });
  }

  res.status(201).json(message);
});

export default router;
