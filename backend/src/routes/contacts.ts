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

export default router;
