/**
 * invitations.ts — JWT-based workspace invitation system
 *
 * Flow:
 *   1. Admin POST /api/invitations/send  → generates signed token (7d), optionally emails it
 *   2. Anyone GET  /api/invitations/:token → validates token, returns workspace + email info
 *   3. Logged-in user POST /api/invitations/:token/accept → joins workspace
 *
 * If SMTP env vars are not configured the endpoint still succeeds and returns
 * the invite link so the admin can share it manually (copy-paste).
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';
// AuthRequest has req.workspaceMember after requireWorkspace() runs

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

interface InvitePayload {
  type: 'workspace_invitation';
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: string;
  invitedById: string;
  invitedByName: string;
}

function signInvite(payload: InvitePayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

function verifyInvite(token: string): InvitePayload | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    if (decoded.type !== 'workspace_invitation') return null;
    return decoded as InvitePayload;
  } catch {
    return null;
  }
}

async function sendInviteEmail(to: string, payload: InvitePayload, inviteUrl: string): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return false; // SMTP not configured

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587'),
      secure: parseInt(SMTP_PORT || '587') === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to,
      subject: `${payload.invitedByName} invited you to join ${payload.workspaceName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="margin:0 0 8px">You've been invited! 🎉</h2>
          <p style="color:#555;margin:0 0 24px">
            <strong>${payload.invitedByName}</strong> has invited you to join
            <strong>${payload.workspaceName}</strong> on Connectly as <strong>${payload.role}</strong>.
          </p>
          <a href="${inviteUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Accept Invitation
          </a>
          <p style="color:#999;font-size:12px;margin-top:24px">
            This link expires in 7 days. If you didn't expect this, you can ignore this email.
          </p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('[INVITE] Email send failed:', (err as Error).message);
    return false;
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Send invitation (admin/owner only)
router.post(
  '/workspaces/:workspaceId/invitations/send',
  authenticate,
  requireWorkspace(),
  async (req: AuthRequest, res: Response) => {
    const memberRole = req.workspaceMember?.role;
    if (!['owner', 'admin'].includes(memberRole || '')) {
      return res.status(403).json({ error: 'Only workspace owners and admins can send invitations' });
    }
    const { email, role = 'agent' } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const workspace = await prisma.workspace.findUnique({
      where: { id: req.params.workspaceId },
      select: { id: true, name: true },
    });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    // Check if already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const isMember = await prisma.workspaceMember.findFirst({
        where: { workspaceId: workspace.id, userId: existingUser.id },
      });
      if (isMember) return res.status(400).json({ error: 'This user is already a member of this workspace' });
    }

    const payload: InvitePayload = {
      type: 'workspace_invitation',
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      email: email.toLowerCase().trim(),
      role,
      invitedById: req.user!.id,
      invitedByName: req.user!.name,
    };

    const token = signInvite(payload);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteUrl = `${frontendUrl}/invite/${token}`;

    const emailSent = await sendInviteEmail(email, payload, inviteUrl);

    res.json({
      ok: true,
      inviteUrl,
      emailSent,
      message: emailSent
        ? `Invitation email sent to ${email}`
        : `SMTP not configured — share this link manually`,
    });
  }
);

// Validate token (public — no auth required)
router.get('/invitations/:token', async (req: Request, res: Response) => {
  const payload = verifyInvite(req.params.token);
  if (!payload) return res.status(400).json({ error: 'Invalid or expired invitation link' });

  // Check workspace still exists
  const workspace = await prisma.workspace.findUnique({
    where: { id: payload.workspaceId },
    select: { id: true, name: true },
  });
  if (!workspace) return res.status(404).json({ error: 'Workspace no longer exists' });

  res.json({
    workspaceId: payload.workspaceId,
    workspaceName: payload.workspaceName,
    email: payload.email,
    role: payload.role,
    invitedByName: payload.invitedByName,
  });
});

// Accept invitation (must be logged in)
router.post('/invitations/:token/accept', authenticate, async (req: AuthRequest, res: Response) => {
  const payload = verifyInvite(req.params.token);
  if (!payload) return res.status(400).json({ error: 'Invalid or expired invitation link' });

  // Verify email matches (optional strict check)
  const currentUser = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, name: true },
  });
  if (!currentUser) return res.status(404).json({ error: 'User not found' });

  if (currentUser.email.toLowerCase() !== payload.email.toLowerCase()) {
    return res.status(403).json({
      error: `This invitation was sent to ${payload.email}. You are logged in as ${currentUser.email}. Please log in with the correct account or ask for a new invite.`,
    });
  }

  // Already a member?
  const existing = await prisma.workspaceMember.findFirst({
    where: { workspaceId: payload.workspaceId, userId: currentUser.id },
  });
  if (existing) return res.status(400).json({ error: 'You are already a member of this workspace' });

  // Add to workspace
  const member = await prisma.workspaceMember.create({
    data: { workspaceId: payload.workspaceId, userId: currentUser.id, role: payload.role },
  });

  const workspace = await prisma.workspace.findUnique({
    where: { id: payload.workspaceId },
    select: { id: true, name: true, slug: true },
  });

  res.json({ ok: true, member, workspace });
});

export default router;
