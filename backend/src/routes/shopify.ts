import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// Get Shopify integration status
router.get('/', async (req: AuthRequest, res: Response) => {
  const integration = await prisma.shopifyIntegration.findUnique({
    where: { workspaceId: req.params.workspaceId },
    select: { id: true, shopDomain: true, enabled: true, createdAt: true },
  });
  res.json(integration || null);
});

// Save/update Shopify integration
router.post('/', async (req: AuthRequest, res: Response) => {
  const { shopDomain, accessToken } = req.body;
  if (!shopDomain || !accessToken) return res.status(400).json({ error: 'Shop domain and access token required' });
  const integration = await prisma.shopifyIntegration.upsert({
    where: { workspaceId: req.params.workspaceId },
    update: { shopDomain, accessToken, enabled: true },
    create: { shopDomain, accessToken, workspaceId: req.params.workspaceId },
    select: { id: true, shopDomain: true, enabled: true, createdAt: true },
  });
  res.json(integration);
});

// Toggle enabled
router.patch('/', async (req: AuthRequest, res: Response) => {
  const { enabled } = req.body;
  const integration = await prisma.shopifyIntegration.update({
    where: { workspaceId: req.params.workspaceId },
    data: { enabled },
    select: { id: true, shopDomain: true, enabled: true },
  });
  res.json(integration);
});

// Delete integration
router.delete('/', async (req: AuthRequest, res: Response) => {
  await prisma.shopifyIntegration.delete({ where: { workspaceId: req.params.workspaceId } });
  res.json({ ok: true });
});

// Fetch orders for a contact (by email or phone)
router.get('/orders/:contactId', async (req: AuthRequest, res: Response) => {
  const integration = await prisma.shopifyIntegration.findUnique({
    where: { workspaceId: req.params.workspaceId },
  });
  if (!integration || !integration.enabled) return res.status(404).json({ error: 'Shopify not connected' });

  const contact = await prisma.contact.findFirst({
    where: { id: req.params.contactId, workspaceId: req.params.workspaceId },
  });
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  try {
    const query = contact.email
      ? `email:${contact.email}`
      : contact.phone
      ? `phone:${contact.phone}`
      : null;

    if (!query) return res.json({ orders: [] });

    const url = `https://${integration.shopDomain}/admin/api/2024-01/orders.json?${new URLSearchParams({ status: 'any', query, limit: '10' })}`;
    const fetchFn = (await import('node-fetch')).default;
    const response = await fetchFn(url, {
      headers: {
        'X-Shopify-Access-Token': integration.accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(400).json({ error: `Shopify API error: ${err}` });
    }

    const data = await response.json() as any;
    const orders = (data.orders || []).map((o: any) => ({
      id: o.id,
      name: o.name,
      status: o.financial_status,
      fulfillment: o.fulfillment_status,
      total: o.total_price,
      currency: o.currency,
      createdAt: o.created_at,
      itemCount: o.line_items?.length || 0,
      items: (o.line_items || []).slice(0, 3).map((i: any) => i.title),
    }));

    res.json({ orders });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
