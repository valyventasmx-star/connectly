import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getIO } from '../services/socket';

const router = Router({ mergeParams: true });

// Twilio SMS inbound webhook: POST /api/webhooks/sms/:channelId
// Twilio sends: From, To, Body, MessageSid (as URL-encoded form data)
router.post('/:channelId', async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { From, Body, MessageSid } = req.body as {
    From?: string;
    Body?: string;
    MessageSid?: string;
  };

  try {
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, type: 'sms' },
    });
    if (!channel) {
      res.status(404).send('Channel not found');
      return;
    }

    const phone = From?.replace(/\s/g, '') || '';
    const content = Body || '';

    // Find or create contact
    let contact = await prisma.contact.findFirst({
      where: { phone, workspaceId: channel.workspaceId },
    });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          name: phone,
          phone,
          platform: 'sms',
          workspaceId: channel.workspaceId,
        },
      });
    }

    // Find or create open conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        contactId: contact.id,
        channelId: channel.id,
        status: { in: ['open', 'pending'] },
      },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          contactId: contact.id,
          channelId: channel.id,
          workspaceId: channel.workspaceId,
          status: 'open',
          lastMessageAt: new Date(),
        },
      });
    }

    // Save message
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content,
        direction: 'inbound',
        status: 'delivered',
        externalId: MessageSid,
      },
    });

    // Update conversation lastMessageAt
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    // Emit via Socket.io
    const io = getIO();
    io.to(`workspace:${channel.workspaceId}`).emit('new_message', {
      ...message,
      conversation: { ...conversation, contact, channel },
    });
    io.to(`workspace:${channel.workspaceId}`).emit('conversation_updated', {
      ...conversation,
      contact,
      channel,
    });

    // Twilio expects TwiML response (empty is fine)
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  } catch (err) {
    console.error('SMS webhook error:', err);
    res.status(500).send('<Response></Response>');
  }
});

export default router;
