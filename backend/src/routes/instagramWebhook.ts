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

      // ── AI Autopilot: auto-reply if enabled for this workspace ────────────
      try {
        const workspace = await prisma.workspace.findUnique({
          where: { id: channel.workspaceId },
          select: { aiAutoPilot: true, aiEnabled: true, aiPrompt: true, name: true },
        });
        if (workspace?.aiAutoPilot && workspace?.aiEnabled && process.env.ANTHROPIC_API_KEY && text && text !== '[Attachment]') {
          const recentMessages = await prisma.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: 'desc' },
            take: 10,
          });
          const history = recentMessages.reverse().map(m => ({
            role: m.direction === 'outbound' ? 'assistant' : 'user',
            content: m.content,
          }));
          const Anthropic = (await import('@anthropic-ai/sdk')).default;
          const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const aiResponse = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            system: workspace.aiPrompt || `You are a helpful customer support assistant for ${workspace.name}. Be friendly, concise, and professional.`,
            messages: history.length > 0 ? history as any : [{ role: 'user', content: text }],
          });
          const aiText = (aiResponse.content[0] as any).text;

          // Try to send reply via page API
          try {
            const axios = (await import('axios')).default;
            const token = channel.pageAccessToken || channel.accessToken;
            const replyEndpoint = platform === 'instagram'
              ? `https://graph.facebook.com/v19.0/me/messages`
              : `https://graph.facebook.com/v19.0/me/messages`;
            await axios.post(replyEndpoint, {
              recipient: { id: senderId },
              message: { text: aiText },
            }, { params: { access_token: token } });
          } catch { /* ignore send errors — still save the message */ }

          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              content: aiText,
              direction: 'outbound',
              status: 'sent',
              isAiReply: true,
              senderName: 'AI Assistant',
            },
          });
          await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
        }
      } catch (aiErr) {
        console.warn('[AI_AUTOPILOT] error:', (aiErr as Error).message);
      }

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
