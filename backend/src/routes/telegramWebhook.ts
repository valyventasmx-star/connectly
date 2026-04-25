import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getIO } from '../services/socket';
import { detectLanguage } from '../services/languageDetection';

const router = Router();

// POST /webhooks/telegram/:channelId — Telegram sends updates here
router.post('/:channelId', async (req: Request, res: Response) => {
  res.sendStatus(200); // Always respond 200 to Telegram

  const channel = await prisma.channel.findUnique({
    where: { id: req.params.channelId },
    include: { workspace: true },
  });
  if (!channel || !channel.telegramBotToken) return;

  const update = req.body;
  const msg = update.message || update.edited_message;
  if (!msg) return;

  const chatId = String(msg.chat?.id);
  const text = msg.text || msg.caption || (msg.photo ? '[Photo]' : msg.document ? '[Document]' : '[Media]');
  const externalMsgId = String(msg.message_id);
  const from = msg.from;
  const senderName = [from?.first_name, from?.last_name].filter(Boolean).join(' ') || 'Telegram User';

  const language = text && !text.startsWith('[') ? await detectLanguage(text) : null;

  // Find or create contact
  let contact = await prisma.contact.findFirst({
    where: { externalId: chatId, workspaceId: channel.workspaceId },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        name: senderName,
        externalId: chatId,
        platform: 'telegram',
        language,
        phone: `telegram-${chatId}`,
        workspaceId: channel.workspaceId,
      },
    });
  } else if (language && !contact.language) {
    await prisma.contact.update({ where: { id: contact.id }, data: { language } });
  }

  // Find or create open conversation
  let conversation = await prisma.conversation.findFirst({
    where: { contactId: contact.id, channelId: channel.id, status: { in: ['open', 'snoozed', 'pending'] } },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        contactId: contact.id,
        channelId: channel.id,
        workspaceId: channel.workspaceId,
        status: 'open',
      },
    });
  }

  const message = await prisma.message.create({
    data: {
      content: text,
      type: msg.photo ? 'image' : msg.document ? 'document' : msg.voice ? 'audio' : 'text',
      direction: 'inbound',
      status: 'delivered',
      externalId: externalMsgId,
      language,
      conversationId: conversation.id,
      senderName,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
  });

  const io = getIO();
  io.to(`workspace:${channel.workspaceId}`).emit('new_message', { conversationId: conversation.id, message });
  io.to(`workspace:${channel.workspaceId}`).emit('conversation_updated', {
    id: conversation.id, lastMessageAt: new Date(),
  });
});

// Helper: register Telegram webhook URL for a channel
export async function registerTelegramWebhook(botToken: string, webhookUrl: string) {
  const axios = (await import('axios')).default;
  const res = await axios.post(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    url: webhookUrl,
    allowed_updates: ['message', 'edited_message'],
  });
  return res.data;
}

export default router;
