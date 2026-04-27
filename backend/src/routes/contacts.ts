import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// List contacts
router.get('/', async (req: AuthRequest, res: Response) => {
  const { search, page = '1', limit = '50' } = req.query as any;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: any = { workspaceId: req.params.workspaceId };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        contactTags: { include: { tag: true } },
        _count: { select: { conversations: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.contact.count({ where }),
  ]);

  res.json({ contacts, total, page: parseInt(page), limit: parseInt(limit) });
});

// Create contact
router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, phone, email, company, notes, tagIds } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const contact = await prisma.contact.create({
    data: {
      name,
      phone,
      email,
      company,
      notes,
      workspaceId: req.params.workspaceId,
      contactTags: tagIds?.length
        ? { create: tagIds.map((tagId: string) => ({ tagId })) }
        : undefined,
    },
    include: { contactTags: { include: { tag: true } } },
  });
  res.status(201).json(contact);
});

// Import contacts from CSV (body: { csv: string })
router.post('/import', async (req: AuthRequest, res: Response) => {
  const { csv } = req.body;
  if (!csv) return res.status(400).json({ error: 'csv field is required' });

  const lines = csv.split('\n').map((l: string) => l.trim()).filter(Boolean);
  if (lines.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });

  // Parse header
  const header = lines[0].split(',').map((h: string) => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
  const idx = (name: string) => header.indexOf(name);

  const nameIdx = idx('name');
  if (nameIdx === -1) return res.status(400).json({ error: 'CSV must have a "name" column' });

  const rows = lines.slice(1);
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    // Handle quoted fields simply
    const cols = row.split(',').map((c: string) => c.trim().replace(/^"|"$/g, ''));
    const name = cols[nameIdx];
    if (!name) { skipped++; continue; }

    const phone = idx('phone') !== -1 ? cols[idx('phone')] || undefined : undefined;
    const email = idx('email') !== -1 ? cols[idx('email')] || undefined : undefined;
    const company = idx('company') !== -1 ? cols[idx('company')] || undefined : undefined;
    const notes = idx('notes') !== -1 ? cols[idx('notes')] || undefined : undefined;

    try {
      await prisma.contact.create({
        data: { name, phone, email, company, notes, workspaceId: req.params.workspaceId },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  res.json({ created, skipped, total: rows.length });
});

// ── Find duplicate contacts — MUST be before /:contactId ─────────────────────
router.get('/duplicates', async (req: AuthRequest, res: Response) => {
  const contacts = await prisma.contact.findMany({
    where: { workspaceId: req.params.workspaceId },
    select: { id: true, name: true, phone: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const groups: Array<{ matchKey: string; contacts: typeof contacts }> = [];
  const seen = new Set<string>();

  const byPhone = new Map<string, typeof contacts>();
  for (const c of contacts) {
    if (!c.phone) continue;
    const key = c.phone.replace(/\D/g, '').slice(-10);
    if (!key || key.length < 7) continue;
    if (!byPhone.has(key)) byPhone.set(key, []);
    byPhone.get(key)!.push(c);
  }
  for (const [, group] of byPhone.entries()) {
    if (group.length < 2) continue;
    const ids = group.map(c => c.id).sort().join(',');
    if (seen.has(ids)) continue;
    seen.add(ids);
    groups.push({ matchKey: 'phone', contacts: group });
  }

  const byEmail = new Map<string, typeof contacts>();
  for (const c of contacts) {
    if (!c.email) continue;
    const key = c.email.toLowerCase().trim();
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key)!.push(c);
  }
  for (const [, group] of byEmail.entries()) {
    if (group.length < 2) continue;
    const ids = group.map(c => c.id).sort().join(',');
    if (seen.has(ids)) continue;
    seen.add(ids);
    groups.push({ matchKey: 'email', contacts: group });
  }

  res.json({ groups, totalDuplicates: groups.reduce((s, g) => s + g.contacts.length - 1, 0) });
});

// Get contact
router.get('/:contactId', async (req: AuthRequest, res: Response) => {
  const contact = await prisma.contact.findFirst({
    where: { id: req.params.contactId, workspaceId: req.params.workspaceId },
    include: {
      contactTags: { include: { tag: true } },
      conversations: {
        include: { channel: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { lastMessageAt: 'desc' },
      },
    },
  });
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  res.json(contact);
});

// Update contact
router.patch('/:contactId', async (req: AuthRequest, res: Response) => {
  const { name, phone, email, company, notes, tagIds, lifecycleStage } = req.body;
  const contact = await prisma.contact.update({
    where: { id: req.params.contactId },
    data: {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(company !== undefined && { company }),
      ...(notes !== undefined && { notes }),
      ...(lifecycleStage !== undefined && { lifecycleStage }),
      contactTags: tagIds !== undefined
        ? {
            deleteMany: {},
            create: tagIds.map((tagId: string) => ({ tagId })),
          }
        : undefined,
    },
    include: { contactTags: { include: { tag: true } } },
  });
  res.json(contact);
});

// Delete contact
router.delete('/:contactId', async (req: AuthRequest, res: Response) => {
  await prisma.contact.delete({ where: { id: req.params.contactId } });
  res.json({ message: 'Contact deleted' });
});

// Merge contacts: keep primaryId, absorb secondaryId
router.post('/merge', async (req: AuthRequest, res: Response) => {
  const { primaryId, secondaryId } = req.body;
  if (!primaryId || !secondaryId) return res.status(400).json({ error: 'primaryId and secondaryId required' });
  if (primaryId === secondaryId) return res.status(400).json({ error: 'Cannot merge contact with itself' });

  try {
    const [primary, secondary] = await Promise.all([
      prisma.contact.findFirst({ where: { id: primaryId, workspaceId: req.params.workspaceId } }),
      prisma.contact.findFirst({ where: { id: secondaryId, workspaceId: req.params.workspaceId } }),
    ]);
    if (!primary || !secondary) return res.status(404).json({ error: 'One or both contacts not found' });

    await prisma.$transaction([
      prisma.conversation.updateMany({ where: { contactId: secondaryId }, data: { contactId: primaryId } }),
      prisma.contact.update({
        where: { id: primaryId },
        data: {
          email: primary.email || secondary.email,
          company: primary.company || secondary.company,
          notes: [primary.notes, secondary.notes].filter(Boolean).join('\n\n'),
        },
      }),
      prisma.contact.delete({ where: { id: secondaryId } }),
    ]);

    const merged = await prisma.contact.findUnique({
      where: { id: primaryId },
      include: { contactTags: { include: { tag: true } } },
    });
    res.json(merged);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Merge failed' });
  }
});

export default router;
