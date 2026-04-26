import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

router.get('/', async (req: AuthRequest, res: Response) => {
  const templates = await prisma.whatsAppTemplate.findMany({
    where: { workspaceId: req.params.workspaceId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(templates);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, content, language = 'en', category = 'MARKETING', channelId } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'name and content required' });
  const template = await prisma.whatsAppTemplate.create({
    data: { name, content, language, category, channelId, workspaceId: req.params.workspaceId },
  });
  res.status(201).json(template);
});

router.patch('/:templateId', async (req: AuthRequest, res: Response) => {
  const { name, content, language, category, status, channelId } = req.body;
  const template = await prisma.whatsAppTemplate.update({
    where: { id: req.params.templateId },
    data: {
      ...(name !== undefined && { name }),
      ...(content !== undefined && { content }),
      ...(language !== undefined && { language }),
      ...(category !== undefined && { category }),
      ...(status !== undefined && { status }),
      ...(channelId !== undefined && { channelId }),
    },
  });
  res.json(template);
});

router.delete('/:templateId', async (req: AuthRequest, res: Response) => {
  await prisma.whatsAppTemplate.delete({ where: { id: req.params.templateId } });
  res.json({ message: 'Deleted' });
});

// ── Submit template to Meta for approval ─────────────────────────────────────
// Calls the WhatsApp Business API to create the template and marks it pending.
// Requires the workspace channel to have wabaId + accessToken in its config.
router.post('/:templateId/submit', async (req: AuthRequest, res: Response) => {
  try {
    const template = await prisma.whatsAppTemplate.findFirst({
      where: { id: req.params.templateId, workspaceId: req.params.workspaceId },
      include: { channel: true },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Resolve access token + WABA ID from channel config or env fallback
    const cfg = (template.channel as any)?.config ?? {};
    const accessToken = cfg.accessToken ?? process.env.WHATSAPP_ACCESS_TOKEN;
    const wabaId      = cfg.wabaId      ?? process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    if (!accessToken || !wabaId) {
      return res.status(400).json({
        error: 'Missing WhatsApp credentials. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID env vars, or configure them on the channel.',
      });
    }

    // Build Meta template payload (simple text body, no header/footer/buttons)
    const metaPayload = {
      name:      template.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      language:  template.language,
      category:  template.category,    // MARKETING | UTILITY | AUTHENTICATION
      components: [
        { type: 'BODY', text: template.content },
      ],
    };

    const metaRes = await fetch(
      `https://graph.facebook.com/v18.0/${wabaId}/message_templates`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metaPayload),
      }
    );
    const metaData = await metaRes.json() as any;

    if (!metaRes.ok) {
      console.error('[TEMPLATES] Meta submission failed:', metaData);
      return res.status(502).json({
        error: 'Meta rejected the template',
        detail: metaData?.error?.message ?? JSON.stringify(metaData),
      });
    }

    // Mark as pending in DB
    const updated = await prisma.whatsAppTemplate.update({
      where: { id: template.id },
      data:  { status: 'pending' },
    });

    console.log(`[TEMPLATES] Submitted to Meta: ${template.name} → id=${metaData.id} status=${metaData.status}`);
    res.json({ ok: true, template: updated, meta: { id: metaData.id, status: metaData.status } });
  } catch (err) {
    console.error('[TEMPLATES] Submit error:', (err as Error).message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Sync template statuses from Meta ─────────────────────────────────────────
router.post('/sync', async (req: AuthRequest, res: Response) => {
  try {
    const cfg = {} as any; // Could resolve from channel, for now use env
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const wabaId      = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    if (!accessToken || !wabaId) {
      return res.status(400).json({ error: 'WHATSAPP_ACCESS_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID required' });
    }

    const metaRes = await fetch(
      `https://graph.facebook.com/v18.0/${wabaId}/message_templates?fields=name,status,category,language&limit=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const metaData = await metaRes.json() as any;
    if (!metaRes.ok) return res.status(502).json({ error: 'Meta API error', detail: metaData });

    const metaTemplates: Array<{ name: string; status: string }> = metaData.data ?? [];

    // Update local statuses for templates that exist in Meta
    let synced = 0;
    for (const mt of metaTemplates) {
      const normalizedName = mt.name.toLowerCase();
      const updated = await prisma.whatsAppTemplate.updateMany({
        where: { workspaceId: req.params.workspaceId, name: { contains: normalizedName } },
        data:  { status: mt.status.toLowerCase() },
      });
      synced += updated.count;
    }

    res.json({ ok: true, synced, total: metaTemplates.length });
  } catch (err) {
    console.error('[TEMPLATES] Sync error:', (err as Error).message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
