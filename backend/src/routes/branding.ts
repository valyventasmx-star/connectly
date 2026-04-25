import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// Get branding + usage
router.get('/', async (req: AuthRequest, res: Response) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: req.params.workspaceId },
    select: {
      brandingName: true,
      brandingLogo: true,
      brandingColor: true,
      messageCount: true,
      contactCount: true,
      plan: true,
      businessHours: true,
      oooEnabled: true,
      oooMessage: true,
    },
  });
  res.json(workspace);
});

// Update branding
router.patch('/branding', async (req: AuthRequest, res: Response) => {
  const { brandingName, brandingLogo, brandingColor } = req.body;
  const workspace = await prisma.workspace.update({
    where: { id: req.params.workspaceId },
    data: { brandingName, brandingLogo, brandingColor },
    select: { brandingName: true, brandingLogo: true, brandingColor: true },
  });
  res.json(workspace);
});

// Update business hours + OOO
router.patch('/business-hours', async (req: AuthRequest, res: Response) => {
  const { businessHours, oooEnabled, oooMessage } = req.body;
  const workspace = await prisma.workspace.update({
    where: { id: req.params.workspaceId },
    data: {
      ...(businessHours !== undefined ? { businessHours: JSON.stringify(businessHours) } : {}),
      ...(oooEnabled !== undefined ? { oooEnabled } : {}),
      ...(oooMessage !== undefined ? { oooMessage } : {}),
    },
    select: { businessHours: true, oooEnabled: true, oooMessage: true },
  });
  res.json(workspace);
});

// Get live usage stats
router.get('/usage', async (req: AuthRequest, res: Response) => {
  const wid = req.params.workspaceId;
  const [contacts, conversations, messages, channels] = await Promise.all([
    prisma.contact.count({ where: { workspaceId: wid } }),
    prisma.conversation.count({ where: { workspaceId: wid } }),
    prisma.message.count({ where: { conversation: { workspaceId: wid } } }),
    prisma.channel.count({ where: { workspaceId: wid } }),
  ]);
  const workspace = await prisma.workspace.findUnique({
    where: { id: wid },
    select: { plan: true, planExpiresAt: true },
  });

  const limits: Record<string, any> = {
    free:    { contacts: 500,   messages: 1000,  channels: 1 },
    starter: { contacts: 2000,  messages: 10000, channels: 3 },
    pro:     { contacts: 10000, messages: 50000, channels: 10 },
    agency:  { contacts: -1,    messages: -1,    channels: -1 },
  };
  const plan = workspace?.plan || 'free';
  const limit = limits[plan] || limits.free;

  res.json({ contacts, conversations, messages, channels, plan, limits: limit });
});

export default router;
