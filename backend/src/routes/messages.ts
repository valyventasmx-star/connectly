import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { getIO } from '../services/socket';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// Get messages for conversation
router.get('/:conversationId/messages', async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '50' } = req.query as any;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const conv = await prisma.conversation.findFirst({
    where: { id: req.params.conversationId, workspaceId: req.params.workspaceId },
  });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: req.params.conversationId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.message.count({ where: { conversationId: req.params.conversationId } }),
  ]);

  // Reset unread count
  await prisma.conversation.update({
    where: { id: req.params.conversationId },
    data: { unreadCount: 0 },
  });

  res.json({ messages, total });
});

// Send message
router.post('/:conversationId/messages', async (req: AuthRequest, res: Response) => {
  const { content, type = 'text' } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });

  const conv = await prisma.conversation.findFirst({
    where: { id: req.params.conversationId, workspaceId: req.params.workspaceId },
    include: { channel: true, contact: true },
  });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  let waMessageId: string | undefined;

  // Try to send via WhatsApp if channel is connected
  if (conv.channel.status === 'connected' && conv.channel.accessToken && conv.channel.phoneNumberId && conv.contact.phone) {
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
      // Still save message even if WA send fails
    }
  }

  const message = await prisma.message.create({
    data: {
      content,
      type,
      direction: 'outbound',
      status: waMessageId ? 'sent' : 'pending',
      waMessageId,
      conversationId: conv.id,
      senderId: req.user!.id,
      senderName: req.user!.name,
    },
  });

  await prisma.conversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: new Date(), status: 'open' },
  });

  // Emit via socket
  const io = getIO();
  io.to(`workspace:${req.params.workspaceId}`).emit('new_message', {
    conversationId: conv.id,
    message,
  });

  res.status(201).json(message);
});

export default router;
