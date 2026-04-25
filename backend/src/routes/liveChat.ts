import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });

// PUBLIC: POST /live-chat/conversation — widget creates a conversation (no auth)
router.post('/conversation', async (req, res) => {
  try {
    const { workspaceId, visitorName, visitorEmail, message } = req.body;
    if (!workspaceId || !message) {
      return res.status(400).json({ error: 'workspaceId and message required' });
    }

    const widget = await prisma.liveChatWidget.findUnique({ where: { workspaceId } });
    if (!widget || !widget.enabled) {
      return res.status(404).json({ error: 'Live chat not available' });
    }

    let contact = visitorEmail
      ? await prisma.contact.findFirst({ where: { email: visitorEmail, workspaceId } })
      : null;

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          name: visitorName || 'Website Visitor',
          email: visitorEmail,
          phone: `widget-${Date.now()}`,
          workspaceId,
        },
      });
    }

    if (!widget.channelId) {
      return res.status(400).json({ error: 'Live chat widget has no channel configured' });
    }

    const conversation = await prisma.conversation.create({
      data: {
        contactId: contact.id,
        workspaceId,
        channelId: widget.channelId,
        status: 'open',
      },
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: message,
        type: 'text',
        direction: 'inbound',
      },
    });

    res.status(201).json({ conversationId: conversation.id, contactId: contact.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// PUBLIC: GET /live-chat/widget/:workspaceId — widget config (no auth needed)
router.get('/widget/:workspaceId', async (req, res) => {
  try {
    const widget = await prisma.liveChatWidget.findUnique({
      where: { workspaceId: req.params.workspaceId },
    });
    if (!widget || !widget.enabled) return res.status(404).json({ error: 'Not found' });
    res.json({
      primaryColor: widget.primaryColor,
      greeting: widget.greeting,
      botName: widget.botName,
      position: widget.position,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch widget config' });
  }
});

// Authenticated routes below
router.use(authenticate, requireWorkspace());

// GET /live-chat — get widget config for workspace
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const widget = await prisma.liveChatWidget.findUnique({
      where: { workspaceId: req.params.workspaceId },
    });
    res.json(widget || {});
  } catch {
    res.status(500).json({ error: 'Failed to fetch widget config' });
  }
});

// PUT /live-chat — create or update widget config
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const { channelId, primaryColor, greeting, botName, position, enabled, allowedOrigins } = req.body;
    const widget = await prisma.liveChatWidget.upsert({
      where: { workspaceId: req.params.workspaceId },
      create: {
        workspaceId: req.params.workspaceId,
        channelId,
        primaryColor: primaryColor || '#6366f1',
        greeting: greeting || 'Hi! How can we help you today?',
        botName: botName || 'Support',
        position: position || 'bottom-right',
        enabled: enabled ?? true,
        allowedOrigins,
      },
      update: { channelId, primaryColor, greeting, botName, position, enabled, allowedOrigins },
    });
    res.json(widget);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save widget config' });
  }
});

export default router;
