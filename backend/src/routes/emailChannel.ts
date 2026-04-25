import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';
import { testEmailConnection, sendEmail, processInboundEmail } from '../services/emailService';

const router = Router({ mergeParams: true });

// ─── Inbound webhook (no auth — called by Mailgun/SendGrid/Postmark) ───────────
router.post('/inbound/:workspaceId/:channelId', async (req: Request, res: Response) => {
  try {
    const { workspaceId, channelId } = req.params;
    const body = req.body;

    // Normalize across Mailgun / SendGrid / Postmark / raw
    const from = body.sender || body.from || body.From || '';
    const fromName = body['sender-name'] || body.fromname || '';
    const subject = body.subject || body.Subject || '(no subject)';
    const text = body['body-plain'] || body.text || body.TextBody || body.plain || '';
    const messageId = body['Message-Id'] || body['message-id'] || body.MessageID || `${Date.now()}@inbound`;
    const inReplyTo = body['In-Reply-To'] || body['in-reply-to'] || body.InReplyTo;

    await processInboundEmail({
      workspaceId, channelId,
      from, fromName, subject,
      body: text,
      messageId,
      inReplyTo,
    });

    res.json({ success: true });
  } catch (e: any) {
    console.error('Email inbound error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Protected routes ──────────────────────────────────────────────────────────
router.use(authenticate, requireWorkspace());

// Test SMTP connection
router.post('/test', async (req: AuthRequest, res: Response) => {
  const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom } = req.body;
  const ok = await testEmailConnection({ smtpHost, smtpPort: parseInt(smtpPort), smtpUser, smtpPass, smtpFrom });
  res.json({ success: ok, message: ok ? 'Connection successful ✅' : 'Connection failed ❌' });
});

// Send email reply from a conversation
router.post('/send', async (req: AuthRequest, res: Response) => {
  const { channelId, conversationId, content } = req.body;
  if (!channelId || !conversationId || !content) {
    return res.status(400).json({ error: 'channelId, conversationId, content required' });
  }

  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, workspaceId: req.params.workspaceId },
    include: { contact: true },
  });
  if (!conv?.contact?.email) return res.status(400).json({ error: 'Contact has no email' });

  // Get last inbound message-id for threading
  const lastThread = await prisma.emailThread.findFirst({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
  });

  try {
    const { messageId } = await sendEmail(
      channelId,
      conv.contact.email,
      `Re: Conversation #${conversationId.slice(0, 8)}`,
      content,
      lastThread?.messageId
    );

    // Save outbound message-id to thread
    await prisma.emailThread.create({
      data: { messageId, conversationId, workspaceId: req.params.workspaceId },
    });

    res.json({ success: true, messageId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
