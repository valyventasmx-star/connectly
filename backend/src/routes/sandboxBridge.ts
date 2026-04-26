/**
 * sandboxBridge.ts
 *
 * Server-to-server endpoint called by the valy-bot-core WhatsApp bot after
 * each message exchange. It persists inbound + outbound messages into the
 * Connectly database so they appear in the Inbox UI.
 *
 * Authentication: X-Bridge-Secret header (shared secret, never exposed to
 * the public internet — only the bot server sends this request).
 *
 * POST /api/sandbox/ingest
 * Body: {
 *   phone        string   – WhatsApp "from" number, e.g. "521234567890"
 *   userText     string   – what the customer said
 *   botReply     string   – what the bot replied
 *   waMessageId? string   – Meta message ID (used for deduplication)
 *   contactName? string   – name extracted by the bot, if any
 *   source?      string   – default "whatsapp_sandbox"
 * }
 *
 * Response 200: { ok: true, conversationId, contactId, isNew: { contact, conversation } }
 * Response 400: { error: string }
 * Response 401: { error: "Unauthorized" }
 * Response 404: { error: "Workspace not found" }
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getIO } from '../services/socket';

const router = Router();

// ── helpers ────────────────────────────────────────────────────────────────

const WORKSPACE_SLUG = 'breton_demo';
const SANDBOX_CHANNEL_NAME = 'WhatsApp Sandbox';

function authGuard(req: Request, res: Response): boolean {
  const expected = process.env.SANDBOX_BRIDGE_SECRET;
  if (!expected) {
    // If the secret env var is not set we allow localhost callers only
    const ip = req.ip || req.socket?.remoteAddress || '';
    if (ip === '::1' || ip === '127.0.0.1' || ip.endsWith('localhost')) {
      return true;
    }
    console.warn('[SANDBOX_BRIDGE] SANDBOX_BRIDGE_SECRET not set – rejecting non-local request from', ip);
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  const provided = req.headers['x-bridge-secret'] as string | undefined;
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ── route ──────────────────────────────────────────────────────────────────

router.post('/ingest', async (req: Request, res: Response) => {
  if (!authGuard(req, res)) return;

  const {
    phone,
    userText,
    botReply,
    waMessageId,
    contactName,
    source = 'whatsapp_sandbox',
  } = req.body as {
    phone?: string;
    userText?: string;
    botReply?: string;
    waMessageId?: string;
    contactName?: string;
    source?: string;
  };

  // ── validation ────────────────────────────────────────────────────────────
  if (!phone || !userText || !botReply) {
    res.status(400).json({ error: 'phone, userText and botReply are required' });
    return;
  }

  const cleanPhone = phone.replace(/\s+/g, '');

  try {
    // ── 1. resolve workspace ────────────────────────────────────────────────
    const workspace = await prisma.workspace.findUnique({
      where: { slug: WORKSPACE_SLUG },
    });

    if (!workspace) {
      console.error(`[SANDBOX_BRIDGE] Workspace "${WORKSPACE_SLUG}" not found. Run the seed script first.`);
      res.status(404).json({
        error: `Workspace "${WORKSPACE_SLUG}" not found. Create it with the seed script in backend/scripts/seedBretonDemo.ts`,
      });
      return;
    }

    // ── 2. resolve channel (find or create) ─────────────────────────────────
    let channel = await prisma.channel.findFirst({
      where: { workspaceId: workspace.id, type: 'whatsapp', name: SANDBOX_CHANNEL_NAME },
    });

    const channelWasNew = !channel;
    if (!channel) {
      channel = await prisma.channel.create({
        data: {
          name: SANDBOX_CHANNEL_NAME,
          type: 'whatsapp',
          status: 'connected',
          workspaceId: workspace.id,
          // phoneNumberId and accessToken are not needed for sandbox-only persistence;
          // they are only required when Connectly itself sends outbound messages.
          // The bot handles sending independently.
        },
      });
      console.log(`[SANDBOX_BRIDGE] Channel created: ${channel.id} ("${SANDBOX_CHANNEL_NAME}")`);
    }

    // ── 3. upsert contact ────────────────────────────────────────────────────
    let contact = await prisma.contact.findFirst({
      where: { phone: cleanPhone, workspaceId: workspace.id },
    });

    const contactWasNew = !contact;
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          name: contactName || cleanPhone, // use extracted name or fall back to phone
          phone: cleanPhone,
          platform: 'whatsapp',
          lifecycleStage: 'new_lead',
          workspaceId: workspace.id,
        },
      });
    } else if (contactName && contact.name === contact.phone) {
      // Bot extracted a name this round — update the record
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: { name: contactName },
      });
    }

    console.log(
      `[SANDBOX_BRIDGE] [CONTACT_${contactWasNew ? 'CREATED' : 'FOUND'}]`,
      `id=${contact.id}  phone=${cleanPhone}  name="${contact.name}"`
    );

    // ── 4. find or create open conversation ──────────────────────────────────
    let conversation = await prisma.conversation.findFirst({
      where: {
        contactId: contact.id,
        channelId: channel.id,
        status: { in: ['open', 'pending'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const conversationWasNew = !conversation;
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          contactId: contact.id,
          channelId: channel.id,
          workspaceId: workspace.id,
          status: 'open',
          lastMessageAt: new Date(),
          // slaDueAt computed from workspace.slaHours
          slaDueAt: new Date(Date.now() + workspace.slaHours * 60 * 60 * 1000),
        },
      });
    }

    console.log(
      `[SANDBOX_BRIDGE] [CONVERSATION_${conversationWasNew ? 'CREATED' : 'FOUND'}]`,
      `id=${conversation.id}  status=${conversation.status}`
    );

    // ── 5. save inbound message (with dedup) ─────────────────────────────────
    let inboundMsg;

    if (waMessageId) {
      const existing = await prisma.message.findFirst({
        where: { conversationId: conversation.id, waMessageId },
      });
      if (existing) {
        console.log(`[SANDBOX_BRIDGE] Inbound message already saved (waMessageId=${waMessageId}), skipping`);
        inboundMsg = existing;
      }
    }

    if (!inboundMsg) {
      inboundMsg = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: userText,
          direction: 'inbound',
          status: 'delivered',
          waMessageId: waMessageId || null,
          senderName: contact.name,
        },
      });
      console.log(`[SANDBOX_BRIDGE] [MESSAGE_SAVED] inbound id=${inboundMsg.id}  text="${userText.slice(0, 60)}"`);
    }

    // ── 6. save outbound message ──────────────────────────────────────────────
    const outboundMsg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: botReply,
        direction: 'outbound',
        status: 'sent',
        isAiReply: true,
        senderName: 'Valy Bot',
      },
    });

    console.log(`[SANDBOX_BRIDGE] [MESSAGE_SAVED] outbound id=${outboundMsg.id}  text="${botReply.slice(0, 60)}"`);

    // ── 7. update conversation metadata ─────────────────────────────────────
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    });

    // ── 8. emit socket events (live Inbox update) ─────────────────────────────
    try {
      const io = getIO();
      const room = `workspace:${workspace.id}`;

      const conversationPayload = {
        ...conversation,
        contact,
        channel,
        messages: [inboundMsg],
        lastMessageAt: new Date(),
      };

      io.to(room).emit('new_message', {
        ...inboundMsg,
        conversation: conversationPayload,
      });

      io.to(room).emit('new_message', {
        ...outboundMsg,
        conversation: conversationPayload,
      });

      io.to(room).emit('conversation_updated', conversationPayload);
    } catch (socketErr) {
      // Socket may not be initialized if server just started — non-fatal
      console.warn('[SANDBOX_BRIDGE] Socket emit failed (non-fatal):', (socketErr as Error).message);
    }

    // ── 9. respond ───────────────────────────────────────────────────────────
    res.json({
      ok: true,
      conversationId: conversation.id,
      contactId: contact.id,
      channelId: channel.id,
      workspaceId: workspace.id,
      isNew: {
        contact: contactWasNew,
        conversation: conversationWasNew,
        channel: channelWasNew,
      },
    });

  } catch (err) {
    console.error('[SANDBOX_BRIDGE] Error persisting message:', err);
    res.status(500).json({ error: 'Internal error persisting to Connectly' });
  }
});

export default router;
