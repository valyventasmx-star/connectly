import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// List custom fields for workspace
router.get('/', async (req: AuthRequest, res: Response) => {
  const fields = await prisma.customField.findMany({
    where: { workspaceId: req.params.workspaceId },
    orderBy: { createdAt: 'asc' },
  });
  res.json(fields);
});

// Create custom field
router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, type = 'text', options } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const field = await prisma.customField.create({
    data: {
      name,
      type,
      options: options ? JSON.stringify(options) : undefined,
      workspaceId: req.params.workspaceId,
    },
  });
  res.status(201).json(field);
});

// Update field
router.patch('/:fieldId', async (req: AuthRequest, res: Response) => {
  const { name, type, options } = req.body;
  const field = await prisma.customField.update({
    where: { id: req.params.fieldId },
    data: {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(options !== undefined && { options: JSON.stringify(options) }),
    },
  });
  res.json(field);
});

// Delete field
router.delete('/:fieldId', async (req: AuthRequest, res: Response) => {
  await prisma.customField.delete({ where: { id: req.params.fieldId } });
  res.json({ message: 'Deleted' });
});

// Get field values for a contact
router.get('/values/:contactId', async (req: AuthRequest, res: Response) => {
  const values = await prisma.contactCustomFieldValue.findMany({
    where: { contactId: req.params.contactId },
    include: { field: true },
  });
  res.json(values);
});

// Upsert field value for a contact
router.put('/values/:contactId/:fieldId', async (req: AuthRequest, res: Response) => {
  const { value } = req.body;
  const result = await prisma.contactCustomFieldValue.upsert({
    where: {
      contactId_fieldId: {
        contactId: req.params.contactId,
        fieldId: req.params.fieldId,
      },
    },
    update: { value },
    create: {
      value,
      contactId: req.params.contactId,
      fieldId: req.params.fieldId,
    },
  });
  res.json(result);
});

export default router;
