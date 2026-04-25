import cron from 'node-cron';
import prisma from '../lib/prisma';
import { getIO } from './socket';

// Run every minute: send scheduled messages + unsnooze conversations
export function startCronJobs() {
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    // --- Scheduled Messages ---
    try {
      const due = await prisma.scheduledMessage.findMany({
        where: { sent: false, scheduledAt: { lte: now } },
        take: 50,
      });
      for (const sm of due) {
        try {
          const message = await prisma.message.create({
            data: {
              content: sm.content,
              type: sm.type,
              direction: 'outbound',
              status: 'sent',
              conversationId: sm.conversationId,
              senderName: sm.senderName || 'Scheduled',
            },
          });
          await prisma.conversation.update({
            where: { id: sm.conversationId },
            data: { lastMessageAt: now },
          });
          await prisma.scheduledMessage.update({
            where: { id: sm.id },
            data: { sent: true, sentAt: now },
          });
          const io = getIO();
          const conv = await prisma.conversation.findUnique({ where: { id: sm.conversationId }, select: { workspaceId: true } });
          if (conv) io.to(`workspace:${conv.workspaceId}`).emit('new_message', { conversationId: sm.conversationId, message });
        } catch (e) {
          console.error('Failed to send scheduled message:', sm.id, e);
        }
      }
    } catch (e) {
      console.error('Scheduled messages cron error:', e);
    }

    // --- Unsnooze Conversations ---
    try {
      const toUnsnooze = await prisma.conversation.findMany({
        where: { status: 'snoozed', snoozedUntil: { lte: now } },
        select: { id: true, workspaceId: true },
        take: 100,
      });
      for (const conv of toUnsnooze) {
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { status: 'open', snoozedUntil: null },
        });
        const io = getIO();
        io.to(`workspace:${conv.workspaceId}`).emit('conversation_updated', { id: conv.id, status: 'open' });
      }
    } catch (e) {
      console.error('Unsnooze cron error:', e);
    }
  });

  console.log('⏰ Cron jobs started (scheduled messages + unsnooze)');
}

// Daily digest — runs every day at 7:00 AM
export function startDailyDigest() {
  cron.schedule('0 7 * * *', async () => {
    console.log('📧 Running daily email digest...');
    try {
      const workspaces = await prisma.workspace.findMany({
        include: { members: { include: { user: true } } },
      });

      for (const ws of workspaces) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [newConversations, openConversations, messagesSent, messagesReceived] = await Promise.all([
          prisma.conversation.count({ where: { workspaceId: ws.id, createdAt: { gte: yesterday, lt: today } } }),
          prisma.conversation.count({ where: { workspaceId: ws.id, status: 'open' } }),
          prisma.message.count({ where: { conversation: { workspaceId: ws.id }, direction: 'outbound', createdAt: { gte: yesterday, lt: today } } }),
          prisma.message.count({ where: { conversation: { workspaceId: ws.id }, direction: 'inbound', createdAt: { gte: yesterday, lt: today } } }),
        ]);

        // Only send if there's actual activity
        if (newConversations === 0 && messagesSent === 0 && messagesReceived === 0) continue;

        for (const member of ws.members) {
          if (!member.user.email) continue;
          console.log(`📧 Digest for ${member.user.email}: ${ws.name} — ${newConversations} new, ${openConversations} open, ${messagesSent} sent, ${messagesReceived} received`);
          // In production, integrate with SendGrid/Mailgun/Resend here
          // await sendEmail({ to: member.user.email, subject: `Daily Digest — ${ws.name}`, ... })
        }
      }
    } catch (e) {
      console.error('Daily digest cron error:', e);
    }
  });

  console.log('📧 Daily digest cron started (7:00 AM daily)');
}
