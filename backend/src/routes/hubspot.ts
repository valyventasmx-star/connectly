import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';
import axios from 'axios';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// GET /api/workspaces/:workspaceId/hubspot — get HubSpot config
router.get('/', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { hubspotApiKey: true, hubspotPortalId: true, hubspotLastSync: true },
    });
    res.json({
      connected: !!workspace?.hubspotApiKey,
      portalId: workspace?.hubspotPortalId,
      lastSync: workspace?.hubspotLastSync,
      // never return the actual key — just whether it's set
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch HubSpot config' });
  }
});

// PUT /api/workspaces/:workspaceId/hubspot — save API key
router.put('/', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  const { apiKey } = req.body as { apiKey: string };

  if (!apiKey) {
    res.status(400).json({ error: 'apiKey is required' });
    return;
  }

  try {
    // Verify the key works by fetching portal info
    const hsRes = await axios.get('https://api.hubapi.com/account-info/v3/details', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const portalId = String(hsRes.data?.portalId || '');

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { hubspotApiKey: apiKey, hubspotPortalId: portalId },
    });

    res.json({ connected: true, portalId });
  } catch (err: any) {
    if (err.response?.status === 401) {
      res.status(401).json({ error: 'Invalid HubSpot API key' });
    } else {
      res.status(500).json({ error: 'Failed to connect HubSpot' });
    }
  }
});

// DELETE /api/workspaces/:workspaceId/hubspot — disconnect
router.delete('/', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  try {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { hubspotApiKey: null, hubspotPortalId: null, hubspotLastSync: null },
    });
    res.json({ connected: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect HubSpot' });
  }
});

// POST /api/workspaces/:workspaceId/hubspot/sync — pull contacts from HubSpot
router.post('/sync', async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { hubspotApiKey: true },
    });
    if (!workspace?.hubspotApiKey) {
      res.status(400).json({ error: 'HubSpot not connected' });
      return;
    }

    // Fetch contacts from HubSpot (first 100)
    const hsRes = await axios.get('https://api.hubapi.com/crm/v3/objects/contacts', {
      headers: { Authorization: `Bearer ${workspace.hubspotApiKey}` },
      params: {
        limit: 100,
        properties: 'email,firstname,lastname,phone,company',
      },
    });

    const hsContacts: any[] = hsRes.data?.results || [];
    let created = 0;
    let updated = 0;

    for (const hs of hsContacts) {
      const p = hs.properties || {};
      const email = p.email || null;
      const phone = p.phone?.replace(/\s/g, '') || null;
      const name = [p.firstname, p.lastname].filter(Boolean).join(' ') || email || phone || 'Unknown';
      const company = p.company || null;

      if (!email && !phone) continue;

      // Look for existing contact
      const existing = await prisma.contact.findFirst({
        where: {
          workspaceId,
          OR: [
            email ? { email } : { id: 'NOMATCH' },
            phone ? { phone } : { id: 'NOMATCH' },
          ],
        },
      });

      if (existing) {
        await prisma.contact.update({
          where: { id: existing.id },
          data: { name: existing.name || name, email: email || existing.email, phone: phone || existing.phone, company: company || existing.company },
        });
        updated++;
      } else {
        await prisma.contact.create({
          data: { name, email, phone, company, workspaceId },
        });
        created++;
      }
    }

    // Record sync time
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { hubspotLastSync: new Date() },
    });

    res.json({ created, updated, total: hsContacts.length });
  } catch (err: any) {
    console.error('HubSpot sync error:', err.response?.data || err.message);
    res.status(500).json({ error: 'HubSpot sync failed' });
  }
});

// POST /api/workspaces/:workspaceId/hubspot/push-contact/:contactId — push one contact to HubSpot
router.post('/push-contact/:contactId', async (req: AuthRequest, res: Response) => {
  const { workspaceId, contactId } = req.params;
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { hubspotApiKey: true },
    });
    if (!workspace?.hubspotApiKey) {
      res.status(400).json({ error: 'HubSpot not connected' });
      return;
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, workspaceId },
    });
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    const [firstName, ...restName] = (contact.name || 'Unknown').split(' ');
    const lastName = restName.join(' ') || '';

    const properties: Record<string, string> = {
      firstname: firstName,
      lastname: lastName,
    };
    if (contact.email) properties.email = contact.email;
    if (contact.phone) properties.phone = contact.phone;
    if (contact.company) properties.company = contact.company;

    // Search for existing HubSpot contact by email
    let hsId: string | null = null;
    if (contact.email) {
      try {
        const searchRes = await axios.post(
          'https://api.hubapi.com/crm/v3/objects/contacts/search',
          { filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: contact.email }] }] },
          { headers: { Authorization: `Bearer ${workspace.hubspotApiKey}` } }
        );
        hsId = searchRes.data?.results?.[0]?.id || null;
      } catch {}
    }

    if (hsId) {
      await axios.patch(
        `https://api.hubapi.com/crm/v3/objects/contacts/${hsId}`,
        { properties },
        { headers: { Authorization: `Bearer ${workspace.hubspotApiKey}` } }
      );
      res.json({ action: 'updated', hsId });
    } else {
      const createRes = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/contacts',
        { properties },
        { headers: { Authorization: `Bearer ${workspace.hubspotApiKey}` } }
      );
      res.json({ action: 'created', hsId: createRes.data?.id });
    }
  } catch (err: any) {
    console.error('HubSpot push error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to push contact to HubSpot' });
  }
});

export default router;
