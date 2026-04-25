import prisma from '../lib/prisma';

/**
 * Try to auto-assign a new conversation based on workspace rules
 */
export async function tryAutoAssign(conversationId: string, workspaceId: string, channelId: string): Promise<string | null> {
  const rules = await prisma.autoAssignRule.findMany({
    where: { workspaceId, active: true },
    orderBy: { createdAt: 'asc' },
  });

  for (const rule of rules) {
    // Check channel filter
    if (rule.channelId && rule.channelId !== channelId) continue;

    const assigneeIds: string[] = JSON.parse(rule.assigneeIds);
    if (!assigneeIds.length) continue;

    let selectedId: string;

    if (rule.strategy === 'least_loaded') {
      // Pick agent with fewest open conversations
      const counts = await Promise.all(
        assigneeIds.map(async (id) => ({
          id,
          count: await prisma.conversation.count({ where: { workspaceId, assigneeId: id, status: 'open' } }),
        }))
      );
      counts.sort((a, b) => a.count - b.count);
      selectedId = counts[0].id;
    } else {
      // Round-robin: find last assigned, pick next
      const lastAssigned = await prisma.conversation.findFirst({
        where: { workspaceId, assigneeId: { in: assigneeIds } },
        orderBy: { createdAt: 'desc' },
        select: { assigneeId: true },
      });
      const lastIndex = lastAssigned ? assigneeIds.indexOf(lastAssigned.assigneeId!) : -1;
      selectedId = assigneeIds[(lastIndex + 1) % assigneeIds.length];
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { assigneeId: selectedId },
    });

    return selectedId;
  }

  return null;
}
