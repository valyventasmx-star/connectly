import { Router, Response } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// GET — return current config (mask the URL)
router.get('/', async (req: AuthRequest, res: Response) => {
  const ws = await prisma.workspace.findUnique({
    where: { id: req.params.workspaceId },
    select: { slackWebhookUrl: true },
  });
  res.json({ connected: !!ws?.slackWebhookUrl, masked: ws?.slackWebhookUrl ? '••••' + ws.slackWebhookUrl.slice(-8) : null });
});

// PUT — save webhook URL + send test message
router.put('/', async (req: AuthRequest, res: Response) => {
  const { webhookUrl } = req.body;
  if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
    return res.status(400).json({ error: 'Invalid Slack webhook URL' });
  }
  // Send a test ping
  try {
    await axios.post(webhookUrl, { text: '✅ *Connectly* is now connected to this Slack channel! You will receive notifications for new conversations here.' });
  } catch {
    return res.status(400).json({ error: 'Could not reach Slack webhook — check the URL and try again.' });
  }
  const ws = await prisma.workspace.update({
    where: { id: req.params.workspaceId },
    data: { slackWebhookUrl: webhookUrl },
    select: { slackWebhookUrl: true },
  });
  res.json({ connected: true, masked: '••••' + ws.slackWebhookUrl!.slice(-8) });
});

// DELETE — disconnect
router.delete('/', async (req: AuthRequest, res: Response) => {
  await prisma.workspace.update({ where: { id: req.params.workspaceId }, data: { slackWebhookUrl: null } });
  res.json({ connected: false });
});

export default router;

// ── Utility: send a Slack notification (called from webhook handlers) ─────────
export async function notifySlack(workspaceId: string, text: string): Promise<void> {
  try {
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { slackWebhookUrl: true } });
    if (!ws?.slackWebhookUrl) return;
    await axios.post(ws.slackWebhookUrl, { text });
  } catch {
    // Slack notification failures are non-fatal
  }
}
