import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// List channels
router.get('/', async (req: AuthRequest, res: Response) => {
  const channels = await prisma.channel.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: { _count: { select: { conversations: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(channels);
});

// Create channel
router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, type, phoneNumber, phoneNumberId, wabaId, accessToken } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });

  const webhookVerifyToken = uuidv4();
  const channel = await prisma.channel.create({
    data: {
      name,
      type,
      phoneNumber,
      phoneNumberId,
      wabaId,
      accessToken,
      webhookVerifyToken,
      status: accessToken && phoneNumberId ? 'connected' : 'pending',
      workspaceId: req.params.workspaceId,
    },
  });
  res.status(201).json(channel);
});

// Get channel
router.get('/:channelId', async (req: AuthRequest, res: Response) => {
  const channel = await prisma.channel.findFirst({
    where: { id: req.params.channelId, workspaceId: req.params.workspaceId },
  });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  res.json(channel);
});

// Update channel
router.patch('/:channelId', async (req: AuthRequest, res: Response) => {
  const { name, phoneNumber, phoneNumberId, wabaId, accessToken, status } = req.body;
  const channel = await prisma.channel.update({
    where: { id: req.params.channelId },
    data: {
      name,
      phoneNumber,
      phoneNumberId,
      wabaId,
      accessToken,
      status: accessToken && phoneNumberId ? 'connected' : status || 'pending',
    },
  });
  res.json(channel);
});

// Delete channel
router.delete('/:channelId', async (req: AuthRequest, res: Response) => {
  await prisma.channel.delete({ where: { id: req.params.channelId } });
  res.json({ message: 'Channel deleted' });
});

// Test connection
router.post('/:channelId/test', async (req: AuthRequest, res: Response) => {
  const channel = await prisma.channel.findFirst({
    where: { id: req.params.channelId, workspaceId: req.params.workspaceId },
  });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (!channel.accessToken || !channel.phoneNumberId) {
    return res.status(400).json({ error: 'Channel not configured with Access Token and Phone Number ID' });
  }
  try {
    const axios = (await import('axios')).default;
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${channel.phoneNumberId}`,
      { headers: { Authorization: `Bearer ${channel.accessToken}` } }
    );
    await prisma.channel.update({ where: { id: channel.id }, data: { status: 'connected' } });
    res.json({ success: true, data: response.data });
  } catch (err: any) {
    await prisma.channel.update({ where: { id: channel.id }, data: { status: 'error' } });
    res.status(400).json({ error: 'Connection failed', details: err.response?.data?.error?.message || err.message });
  }
});

export default router;
