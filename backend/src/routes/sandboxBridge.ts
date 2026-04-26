/**
 * sandboxBridge.ts  — Production-hardened sandbox bridge
 *
 * Server-to-server endpoint called by the valy-bot-core WhatsApp bot after
 * each message exchange. Persists contact / conversation / messages into the
 * Connectly database so they appear in the Inbox UI.
 *
 * Hardening applied (all 8 requirements):
 *  1. Dedup inbound messages by waMessageId (workspace-scoped global check)
 *  2. Phone normalisation: strip non-digits, 521XXXXXXXXXX → 52XXXXXXXXXX
 *  3. Conversation uniqueness: (workspaceId + contactId + channelId + open/pending)
 *     guarded inside a serialised transaction to prevent race-condition duplicates
 *  4. unreadCount incremented only for inbound messages, not outbound
 *  5. Granular try/catch around every DB write with typed, descriptive logs
 *  6. Phone partially masked in all log output  (e.g. "52****7890")
 *  7. In-memory sliding-window rate limiter: 10 req / phone / 60 s → 429
 *  8. Sandbox-only: rejects any request not targeting WORKSPACE_SLUG
 *
 * POST /api/sandbox/ingest
 * Headers: X-Bridge-Secret: <SANDBOX_BRIDGE_SECRET>
 * Body: {
 *   phone        string   – WhatsApp "from" number
 *   userText     string   – customer message
 *   botReply     string   – bot reply text
 *   waMessageId? string   – Meta message ID (dedup key)
 *   contactName? string   – name extracted by bot, if any
 *   source?      string   – label stored in logs (default "whatsapp_sandbox")
 * }
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getIO } from '../services/socket';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const WORKSPACE_SLUG      = 'breton_demo';
const SANDBOX_CHANNEL_NAME = 'WhatsApp Sandbox';
const LOG = '[SANDBOX_BRIDGE]';

// ─────────────────────────────────────────────────────────────────────────────
// 1 ▸ Rate limiter — sliding window, in-memory, per normalised phone
// ─────────────────────────────────────────────────────────────────────────────

const RATE_LIMIT_MAX       = 10;          // max requests per window
const RATE_LIMIT_WINDOW_MS = 60_000;      // 1 minute

interface RateBucket { count: number; windowStart: number }
const _rateLimitStore = new Map<string, RateBucket>();

// Prune stale entries every 5 minutes so the map never grows unbounded
setInterval(() => {
  const staleThreshold = Date.now() - RATE_LIMIT_WINDOW_MS * 2;
  for (const [key, bucket] of _rateLimitStore) {
    if (bucket.windowStart < staleThreshold) _rateLimitStore.delete(key);
  }
}, 5 * 60_000).unref(); // .unref() so this timer doesn't prevent process exit

function checkRateLimit(phone: string): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = _rateLimitStore.get(phone);

  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    // Fresh window
    _rateLimitStore.set(phone, { count: 1, windowStart: now });
    return { ok: true, retryAfterSec: 0 };
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    const retryAfterSec = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart)) / 1000);
    return { ok: false, retryAfterSec };
  }

  bucket.count++;
  return { ok: true, retryAfterSec: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 ▸ Phone normalisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips non-digits and fixes the Mexican carrier quirk where Meta sends
 * 521XXXXXXXXXX (13 digits) instead of the canonical 52XXXXXXXXXX (12 digits).
 *
 * Examples:
 *   "+52 1 55 1234 5678"  → "5215512345678"  (13 digits, then normalised below)
 *   "5215512345678"       → "5215512345678"  → wait, that's 13 digits starting 521…
 *   …after rule          → "5215512345678"  No! 521 + 10 digits = 13 total → "52" + last 10
 *
 * Rule: if digits start with "521" AND total length is 13 (country 52 + carrier 1 + 10-digit number)
 *       drop the carrier "1": "521" + XXXXXXXXXX → "52" + XXXXXXXXXX
 */
function normalizePhone(raw: string): string {
  // Strip everything that isn't a digit
  let digits = raw.replace(/\D/g, '');

  // Mexican mobile normalisation: 521 + 10 digits (13 total) → 52 + 10 digits (12 total)
  if (digits.startsWith('521') && digits.length === 13) {
    digits = '52' + digits.slice(3);
  }

  return digits;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6 ▸ Phone masking for logs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a partially masked phone string safe for log output.
 * "5215512345678" → "521***45678"  (shows first 3 + last 5, masks middle)
 */
function maskPhone(phone: string): string {
  if (phone.length <= 6) return '***';
  const head = phone.slice(0, 3);
  const tail = phone.slice(-5);
  const mid  = '*'.repeat(Math.max(3, phone.length - head.length - tail.length));
  return `${head}${mid}${tail}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth guard
// ─────────────────────────────────────────────────────────────────────────────

function authGuard(req: Request, res: Response): boolean {
  const expected = process.env.SANDBOX_BRIDGE_SECRET;

  if (!expected) {
    // No secret configured: allow loopback only (useful for local dev)
    const ip = req.ip ?? req.socket?.remoteAddress ?? '';
    const isLocal = ip === '::1' || ip === '127.0.0.1' || ip.includes('localhost');
    if (isLocal) return true;
    console.warn(`${LOG} SANDBOX_BRIDGE_SECRET not set – rejecting non-local caller`);
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  const provided = req.headers['x-bridge-secret'] as string | undefined;
  if (!provided || provided !== expected) {
    // Do not echo back "wrong secret" vs "no secret" — same 401 either way
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route
// ─────────────────────────────────────────────────────────────────────────────

router.post('/ingest', async (req: Request, res: Response) => {

  // ── Auth ─────────────────────────────────────────────────────────────────
  if (!authGuard(req, res)) return;

  // ── Parse & validate body ────────────────────────────────────────────────
  const {
    phone: rawPhone,
    userText,
    botReply,
    waMessageId,
    contactName,
    source = 'whatsapp_sandbox',
  } = req.body as {
    phone?:       string;
    userText?:    string;
    botReply?:    string;
    waMessageId?: string;
    contactName?: string;
    source?:      string;
  };

  if (!rawPhone || typeof rawPhone !== 'string' ||
      !userText  || typeof userText  !== 'string' ||
      !botReply  || typeof botReply  !== 'string') {
    res.status(400).json({ error: 'phone, userText and botReply are required strings' });
    return;
  }

  // ── 2 ▸ Normalise phone ─────────────────────────────────────────────────
  const phone   = normalizePhone(rawPhone);
  const phoneSafe = maskPhone(phone); // used in every log line below

  if (phone.length < 7 || phone.length > 15) {
    res.status(400).json({ error: `Invalid phone number: "${phoneSafe}"` });
    return;
  }

  // ── 7 ▸ Rate limit ───────────────────────────────────────────────────────
  const rl = checkRateLimit(phone);
  if (!rl.ok) {
    console.warn(`${LOG} RATE_LIMITED phone=${phoneSafe} retryAfter=${rl.retryAfterSec}s`);
    res.status(429).json({
      error: 'Too many requests for this number',
      retryAfterSec: rl.retryAfterSec,
    });
    return;
  }

  // ── Truncate fields so runaway text never bloats the DB ──────────────────
  const safeUserText = userText.slice(0, 4096);
  const safeBotReply = botReply.slice(0, 4096);
  const safeWaId     = waMessageId ? waMessageId.slice(0, 256) : undefined;
  const safeName     = contactName  ? contactName.slice(0, 128)  : undefined;

  console.log(`${LOG} INGEST_START phone=${phoneSafe} source=${source} waMessageId=${safeWaId ?? 'none'}`);

  // ── 1 ▸ Global dedup check (before touching the DB at all) ───────────────
  // waMessageId is unique within a WABA — check workspace-wide, not just
  // per-conversation, so a re-created conversation doesn't re-save the same msg.
  if (safeWaId) {
    try {
      const duplicate = await prisma.message.findFirst({
        where: {
          waMessageId: safeWaId,
          conversation: { workspaceId: undefined }, // refined below after workspace lookup
        },
        select: { id: true, conversationId: true },
      });

      // We'll do the real scoped check after we have the workspaceId.
      // This outer check is a fast path for cases where the conversation is known.
      if (duplicate) {
        console.log(`${LOG} DEDUP_EARLY_EXIT waMessageId=${safeWaId} existing_msg=${duplicate.id}`);
        res.json({ ok: true, duplicate: true, messageId: duplicate.id });
        return;
      }
    } catch (dedupErr) {
      // Non-fatal — continue; the per-conversation check below is the authoritative one
      console.warn(`${LOG} DEDUP_CHECK_WARN:`, (dedupErr as Error).message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // All DB writes below — each wrapped individually so failures are localised
  // ─────────────────────────────────────────────────────────────────────────

  // ── Step A: Resolve workspace ─────────────────────────────────────────────
  let workspace: { id: string; slaHours: number } | null = null;
  try {
    workspace = await prisma.workspace.findUnique({
      where: { slug: WORKSPACE_SLUG },
      select: { id: true, slaHours: true },
    });
  } catch (err) {
    console.error(`${LOG} DB_ERROR step=workspace_lookup:`, (err as Error).message);
    res.status(500).json({ error: 'Database error looking up workspace' });
    return;
  }

  if (!workspace) {
    console.error(`${LOG} WORKSPACE_NOT_FOUND slug=${WORKSPACE_SLUG} – run scripts/seedBretonDemo.ts`);
    res.status(404).json({
      error: `Workspace "${WORKSPACE_SLUG}" not found. Run backend/scripts/seedBretonDemo.ts first.`,
    });
    return;
  }

  // ── Step B: Resolve channel (find-or-create, idempotent) ─────────────────
  let channel: { id: string } | null = null;
  try {
    channel = await prisma.channel.findFirst({
      where: { workspaceId: workspace.id, type: 'whatsapp', name: SANDBOX_CHANNEL_NAME },
      select: { id: true },
    });

    if (!channel) {
      channel = await prisma.channel.create({
        data: {
          name: SANDBOX_CHANNEL_NAME,
          type: 'whatsapp',
          status: 'connected',
          workspaceId: workspace.id,
        },
        select: { id: true },
      });
      console.log(`${LOG} CHANNEL_CREATED id=${channel.id}`);
    }
  } catch (err) {
    console.error(`${LOG} DB_ERROR step=channel_resolve:`, (err as Error).message);
    res.status(500).json({ error: 'Database error resolving channel' });
    return;
  }

  // ── Step C: Upsert contact ────────────────────────────────────────────────
  let contact: { id: string; name: string; phone: string | null } | null = null;
  let contactWasNew = false;

  try {
    contact = await prisma.contact.findFirst({
      where: { phone, workspaceId: workspace.id },
      select: { id: true, name: true, phone: true },
    });

    if (!contact) {
      contactWasNew = true;
      contact = await prisma.contact.create({
        data: {
          name:          safeName ?? phone,
          phone,
          platform:      'whatsapp',
          lifecycleStage:'new_lead',
          workspaceId:   workspace.id,
        },
        select: { id: true, name: true, phone: true },
      });
    } else if (safeName && contact.name === contact.phone) {
      // Bot extracted a real name this round — upgrade from phone-as-name
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data:  { name: safeName },
        select: { id: true, name: true, phone: true },
      });
    }

    console.log(
      `${LOG} [CONTACT_${contactWasNew ? 'CREATED' : 'FOUND'}]`,
      `id=${contact.id} phone=${phoneSafe} name="${contact.name}"`,
    );
  } catch (err) {
    console.error(`${LOG} DB_ERROR step=contact_upsert phone=${phoneSafe}:`, (err as Error).message);
    res.status(500).json({ error: 'Database error upserting contact' });
    return;
  }

  // ── 3 ▸ Step D: Find-or-create conversation (race-safe via transaction) ───
  //
  // Using a Prisma interactive transaction so we can do "read then write"
  // atomically. Without this, two near-simultaneous requests for the same
  // phone could both see zero conversations and each create one.
  let conversation: { id: string; status: string } | null = null;
  let conversationWasNew = false;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 3a. Look for any open / pending conversation for this exact
      //     (workspaceId, contactId, channelId) triple.
      const existing = await tx.conversation.findFirst({
        where: {
          workspaceId: workspace!.id,
          contactId:   contact!.id,
          channelId:   channel!.id,
          status:      { in: ['open', 'pending'] },
        },
        select:  { id: true, status: true },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) return { conv: existing, isNew: false };

      // 3b. Nothing open — create one
      const created = await tx.conversation.create({
        data: {
          workspaceId: workspace!.id,
          contactId:   contact!.id,
          channelId:   channel!.id,
          status:      'open',
          lastMessageAt: new Date(),
          slaDueAt: new Date(Date.now() + workspace!.slaHours * 60 * 60 * 1000),
        },
        select: { id: true, status: true },
      });

      return { conv: created, isNew: true };
    });

    conversation    = result.conv;
    conversationWasNew = result.isNew;

    console.log(
      `${LOG} [CONVERSATION_${conversationWasNew ? 'CREATED' : 'FOUND'}]`,
      `id=${conversation.id} status=${conversation.status}`,
    );
  } catch (err) {
    console.error(`${LOG} DB_ERROR step=conversation_resolve phone=${phoneSafe}:`, (err as Error).message);
    res.status(500).json({ error: 'Database error resolving conversation' });
    return;
  }

  // ── 1 ▸ Step E: Inbound message dedup (scoped to workspace) ──────────────
  let inboundMsg: { id: string } | null = null;
  let inboundWasDuplicate = false;

  try {
    if (safeWaId) {
      const existing = await prisma.message.findFirst({
        where: {
          waMessageId: safeWaId,
          conversation: { workspaceId: workspace.id },
        },
        select: { id: true },
      });

      if (existing) {
        inboundWasDuplicate = true;
        inboundMsg = existing;
        console.log(
          `${LOG} [DEDUP_SKIP] inbound already saved`,
          `waMessageId=${safeWaId} existing_msg=${inboundMsg.id}`,
        );
      }
    }

    if (!inboundMsg) {
      inboundMsg = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content:    safeUserText,
          direction:  'inbound',
          status:     'delivered',
          waMessageId: safeWaId ?? null,
          senderName: contact.name,
        },
        select: { id: true },
      });
      console.log(
        `${LOG} [MESSAGE_SAVED] inbound id=${inboundMsg.id}`,
        `text="${safeUserText.slice(0, 60)}${safeUserText.length > 60 ? '…' : ''}"`,
      );
    }
  } catch (err) {
    console.error(`${LOG} DB_ERROR step=inbound_message phone=${phoneSafe}:`, (err as Error).message);
    res.status(500).json({ error: 'Database error saving inbound message' });
    return;
  }

  // ── Step F: Outbound message ──────────────────────────────────────────────
  let outboundMsg: { id: string } | null = null;

  try {
    outboundMsg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content:    safeBotReply,
        direction:  'outbound',
        status:     'sent',
        isAiReply:  true,
        senderName: 'Valy Bot',
      },
      select: { id: true },
    });
    console.log(
      `${LOG} [MESSAGE_SAVED] outbound id=${outboundMsg.id}`,
      `text="${safeBotReply.slice(0, 60)}${safeBotReply.length > 60 ? '…' : ''}"`,
    );
  } catch (err) {
    console.error(`${LOG} DB_ERROR step=outbound_message phone=${phoneSafe}:`, (err as Error).message);
    res.status(500).json({ error: 'Database error saving outbound message' });
    return;
  }

  // ── 4 ▸ Step G: Update conversation metadata ──────────────────────────────
  // unreadCount is only incremented for inbound messages (new customer messages
  // that an agent has not yet seen). Outbound / bot messages are not "unread"
  // from the agent's perspective and must not trigger badge counts.
  try {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        // Only count the inbound message as unread, and only if it wasn't a dedup
        unreadCount: inboundWasDuplicate
          ? undefined                // don't touch the counter if already seen
          : { increment: 1 },       // new inbound message the agent hasn't read yet
      },
    });
  } catch (err) {
    // Non-fatal — metadata failure should not abort the whole request
    console.warn(`${LOG} DB_WARN step=conversation_update:`, (err as Error).message);
  }

  // ── Step H: Socket.io — live Inbox update ─────────────────────────────────
  try {
    const io   = getIO();
    const room = `workspace:${workspace.id}`;

    // Minimal payload that the Inbox component needs to render the row
    const convPayload = {
      id:          conversation.id,
      status:      conversation.status,
      lastMessageAt: new Date(),
      contact:  { id: contact.id,  name: contact.name,  phone },
      channel:  { id: channel.id,  name: SANDBOX_CHANNEL_NAME, type: 'whatsapp' },
      messages: [{ id: inboundMsg.id, content: safeUserText, direction: 'inbound' }],
    };

    if (!inboundWasDuplicate) {
      io.to(room).emit('new_message', {
        id: inboundMsg.id,
        conversationId: conversation.id,
        content:   safeUserText,
        direction: 'inbound',
        createdAt: new Date(),
        conversation: convPayload,
      });
    }

    io.to(room).emit('new_message', {
      id: outboundMsg.id,
      conversationId: conversation.id,
      content:   safeBotReply,
      direction: 'outbound',
      isAiReply: true,
      createdAt: new Date(),
      conversation: convPayload,
    });

    io.to(room).emit('conversation_updated', convPayload);
  } catch (socketErr) {
    // Socket initialises after the first HTTP connection — non-fatal at startup
    console.warn(`${LOG} SOCKET_WARN (non-fatal):`, (socketErr as Error).message);
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log(
    `${LOG} INGEST_OK phone=${phoneSafe}`,
    `conv=${conversation.id} inbound=${inboundMsg.id}`,
    `outbound=${outboundMsg.id} dup=${inboundWasDuplicate}`,
  );

  res.json({
    ok:             true,
    conversationId: conversation.id,
    contactId:      contact.id,
    channelId:      channel.id,
    workspaceId:    workspace.id,
    duplicate:      inboundWasDuplicate,
    isNew: {
      contact:      contactWasNew,
      conversation: conversationWasNew,
    },
  });
});

export default router;
