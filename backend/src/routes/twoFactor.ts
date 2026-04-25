import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

const router = Router();
router.use(authenticate);

// Generate 2FA secret + QR code
router.post('/setup', async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.totpEnabled) return res.status(400).json({ error: '2FA already enabled' });

  const secret = speakeasy.generateSecret({
    name: `Connectly (${user.email})`,
    issuer: 'Connectly',
    length: 20,
  });

  // Store temp secret (not enabled yet)
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: secret.base32 },
  });

  const qrUrl = await QRCode.toDataURL(secret.otpauth_url!);
  res.json({ secret: secret.base32, qrCode: qrUrl });
});

// Verify token and enable 2FA
router.post('/verify', async (req: AuthRequest, res: Response) => {
  const { token } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.totpSecret) return res.status(400).json({ error: 'Run /setup first' });

  const valid = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: 'base32',
    token,
    window: 2,
  });

  if (!valid) return res.status(400).json({ error: 'Invalid code' });

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true },
  });

  res.json({ success: true, message: '2FA enabled successfully' });
});

// Disable 2FA
router.post('/disable', async (req: AuthRequest, res: Response) => {
  const { token } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.totpEnabled || !user.totpSecret) return res.status(400).json({ error: '2FA not enabled' });

  const valid = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: 'base32',
    token,
    window: 2,
  });

  if (!valid) return res.status(400).json({ error: 'Invalid code' });

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null },
  });

  res.json({ success: true });
});

// Get 2FA status
router.get('/status', async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { totpEnabled: true },
  });
  res.json({ enabled: user?.totpEnabled || false });
});

export default router;
