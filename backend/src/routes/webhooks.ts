import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getIO } from '../services/socket';

const router = Router();

// Verify webhook (GET) - Meta sends this to verify your endpoint
router.get('/whatsapp/:channelId', async (req: Request, res: Response) => {
  const channel = await prisma.channel.findUnique({ where: { id: req.params.channelId } });
  if (!channel) return res.status(404).send('Channel not found');

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === channel.webhookVerifyToken) {
    console.log(`Webhook verified for channel ${channel.id}`);
    return res.send(challenge);
  }
  res.status(403).send('Forbidden');
});

// Receive messages (POST)
router.post('/whatsapp/:channelId', async (req: Request, res: Response) => {
  res.sendStatus(200); // Always respond 200 immediately to Meta

  const channel = await prisma.channel.findUnique({
    where: { id: req.params.channelId },
    include: { workspace: true },
  });
  if (!channel) return;

  const body = req.body;
  if (body.object !== 'whatsapp_business_account') return;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;
      const value = change.value;

      // Handle incoming messages
      for (const msg of value.messages || []) {
        const from = msg.from; // phone number
        const waMessageId = msg.id;
        const timestamp = new Date(parseInt(msg.timestamp) * 1000);

        let content = '';
        let type = msg.type;

        if (msg.type === 'text') content = msg.text?.body || '';
        else if (msg.type === 'image') content = msg.image?.caption || '[Image]';
        else if (msg.type === 'document') content = msg.document?.filename || '[Document]';
        else if (msg.type === 'audio') content = '[Audio]';
        else if (msg.type === 'video') content = msg.video?.caption || '[Video]';
        else content = `[${msg.type}]`;

        // Find or create contact
        let contact = await prisma.contact.findFirst({
          where: { phone: from, workspaceId: channel.workspaceId },
        });
        const contactName = value.contacts?.[0]?.profile?.name || from;
        if (!contact) {
          contact = await prisma.contact.create({
            data: { name: contactName, phone: from, workspaceId: channel.workspaceId },
          });
        }

        // Find or create conversation
        let conversation = await prisma.conversation.findFirst({
          where: { contactId: contact.id, channelId: channel.id, status: 'open' },
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

        // Check duplicate
        const existingMsg = waMessageId
          ? await prisma.message.findFirst({ where: { waMessageId } })
          : null;
        if (existingMsg) continue;

        const message = await prisma.message.create({
          data: {
            content,
            type,
            direction: 'inbound',
            status: 'delivered',
            waMessageId,
            conversationId: conversation.id,
            senderName: contactName,
            createdAt: timestamp,
          },
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: timestamp, unreadCount: { increment: 1 } },
        });

        // Notify via socket
        const io = getIO();
        io.to(`workspace:${channel.workspaceId}`).emit('new_message', {
          conversationId: conversation.id,
          message,
          contact,
          conversation: { ...conversation, unreadCount: (conversation.unreadCount || 0) + 1 },
        });
        io.to(`workspace:${channel.workspaceId}`).emit('conversation_updated', {
          conversationId: conversation.id,
        });
      }

      // Handle message status updates
      for (const status of value.statuses || []) {
        const { id: waMessageId, status: newStatus } = status;
        await prisma.message.updateMany({
          where: { waMessageId },
          data: { status: newStatus === 'read' ? 'read' : newStatus === 'delivered' ? 'delivered' : 'sent' },
        });
      }
    }
  }
});

export default router;
