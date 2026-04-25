import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';
import { getIO } from './socket';

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  smtpSecure?: boolean;
}

export function createTransporter(config: EmailConfig) {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure ?? (config.smtpPort === 465),
    auth: { user: config.smtpUser, pass: config.smtpPass },
  });
}

export async function testEmailConnection(config: EmailConfig): Promise<boolean> {
  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}

export async function sendEmail(
  channelId: string,
  to: string,
  subject: string,
  body: string,
  inReplyTo?: string
): Promise<{ messageId: string }> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel?.emailConfig) throw new Error('Email channel not configured');

  const config: EmailConfig = JSON.parse(channel.emailConfig);
  const transporter = createTransporter(config);

  const info = await transporter.sendMail({
    from: config.smtpFrom || config.smtpUser,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, '<br>'),
    ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}),
  });

  return { messageId: info.messageId };
}

/**
 * Process an inbound email (from Mailgun/SendGrid/Postmark webhook or IMAP poll)
 * and create/update a conversation.
 */
export async function processInboundEmail(payload: {
  workspaceId: string;
  channelId: string;
  from: string;
  fromName?: string;
  subject: string;
  body: string;
  messageId: string;
  inReplyTo?: string;
}) {
  const io = getIO();
  const { workspaceId, channelId, from, fromName, subject, body, messageId, inReplyTo } = payload;

  // Find or create contact
  let contact = await prisma.contact.findFirst({
    where: { workspaceId, email: from },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId,
        name: fromName || from.split('@')[0],
        email: from,
      },
    });
  }

  // Find existing conversation via thread (inReplyTo header)
  let conversation = null;
  if (inReplyTo) {
    const thread = await prisma.emailThread.findFirst({
      where: { messageId: inReplyTo, workspaceId },
    });
    if (thread) {
      conversation = await prisma.conversation.findUnique({
        where: { id: thread.conversationId },
      });
    }
  }

  // Or find open conversation with same contact on same channel
  if (!conversation) {
    conversation = await prisma.conversation.findFirst({
      where: { workspaceId, channelId, contactId: contact.id, status: 'open' },
    });
  }

  // Create conversation if none
  if (!conversation) {
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { slaHours: true } });
    conversation = await prisma.conversation.create({
      data: {
        workspaceId,
        channelId,
        contactId: contact.id,
        status: 'open',
        slaDueAt: new Date(Date.now() + (workspace?.slaHours || 24) * 3600000),
      },
    });
  }

  // Record email thread
  await prisma.emailThread.upsert({
    where: { messageId_workspaceId: { messageId, workspaceId } },
    create: { messageId, conversationId: conversation.id, workspaceId },
    update: {},
  });

  // Create the message
  const msg = await prisma.message.create({
    data: {
      content: `**${subject}**\n\n${body}`,
      type: 'email',
      direction: 'inbound',
      status: 'sent',
      conversationId: conversation.id,
      senderName: fromName || from,
    },
    include: { reactions: true },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
  });

  io?.to(`workspace:${workspaceId}`).emit('new_message', {
    conversationId: conversation.id,
    message: msg,
  });

  return { conversation, message: msg, contact };
}
