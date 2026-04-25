import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getIO } from '../services/socket';
import { detectLanguage } from '../services/languageDetection';

const router = Router();

// Verify webhook (GET) — Meta sends this
router.get('/:channelId', async (req: Request, res: Response) => {
  const channel = await prisma.channel.findUnique({ where: { id: req.params.channelId } });
  if (!channel) return res.status(404).send('Channel not found');
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === channel.webhookVerifyToken) {
    console.log(`Instagram/Messenger webhook verified for channel ${channel.id}`);
    return res.send(challenge);
  }
  res.status(403).send('Forbidden');
});

// Receive messages (POST) — handles both Instagram DM and Facebook Messenger
router.post('/:channelId', async (req: Request, res: Response) => {
  res.sendStatus(200); // Respond immediately

  const channel = await prisma.channel.findUnique({
    where: { id: req.params.channelId },
    include: { workspace: true },
  });
  if (!channel) return;

  const body = req.body;
  const isInstagram = body.object === 'instagram';
  const isMessenger = body.object === 'page';
  if (!isInstagram && !isMessenger) return;

  for (const entry of body.entry || []) {
    const messaging = isInstagram ? entry.messaging : entry.messaging;
    for (const event of messaging || []) {
      if (!event.message || event.message.is_echo) continue; // skip outbound echos

      const senderId = event.sender?.id;
      if (!senderId) continue;

      const text = event.message?.text || (event.message?.attachments ? '[Attachment]' : '');
      const externalMsgId = event.message?.mid;
      const platform = isInstagram ? 'instagram' : 'messenger';

      // Detect language
      const language = text && text !== '[Attachment]' ? await detectLanguage(text) : null;

      // Find or create contact by externalId
      let contact = await prisma.contact.findFirst({
        where: { externalId: senderId, workspaceId: channel.workspaceId },
      });

      if (!contact) {
        // Try to get user name from sender profile (best effort)
        let contactName = platform === 'instagram' ? 'Instagram User' : 'Messenger User';
        try {
          const axios = (await import('axios')).default;
          const token = channel.pageAccessToken || channel.accessToken;
          if (token) {
            const profile = await axios.get(`https://graph.facebook.com/v19.0/${senderId}`, {
              params: { fields: 'name', access_token: token },
            });
            if (profile.data?.name) contactName = profile.data.name;
          }
        } catch { /* ignore */ }

        contact = await prisma.contact.create({
          data: {
            name: contactName,
            externalId: senderId,
            platform,
            language,
            phone: `${platform}-${senderId}`,
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

      // Save message
      const message = await prisma.message.create({
        data: {
          content: text,
          type: event.message?.attachments ? 'document' : 'text',
          direction: 'inbound',
          status: 'delivered',
          externalId: externalMsgId,
          language,
          conversationId: conversation.id,
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
      });

      const io = getIO();
      io.to(`workspace:${channel.workspaceId}`).emit('new_message', {
        conversationId: conversation.id,
        message,
      });
      io.to(`workspace:${channel.workspaceId}`).emit('conversation_updated', {
        id: conversation.id,
        lastMessageAt: new Date(),
      });
    }
  }
});

export default router;
