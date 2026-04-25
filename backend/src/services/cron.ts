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
