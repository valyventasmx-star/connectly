import prisma from '../lib/prisma';
import { getIO } from './socket';

/**
 * Core automation engine — called after every trigger event.
 * Event types: conversation.created | message.received | conversation.resolved |
 *              contact.created | contact.updated | conversation.assigned
 */
export async function runAutomations(
  workspaceId: string,
  event: string,
  payload: Record<string, any>
) {
  try {
    const rules = await prisma.automationRule.findMany({
      where: { workspaceId, active: true },
    });

    for (const rule of rules) {
      const trigger = JSON.parse(rule.trigger);
      const actions = JSON.parse(rule.actions);

      if (trigger.event !== event) continue;
      if (!matchConditions(trigger.conditions || [], payload)) continue;

      // Execute each action in order
      for (const action of actions) {
        await executeAction(workspaceId, action, payload, rule.id);
      }

      // Increment run count
      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { runCount: { increment: 1 } },
      });
    }
  } catch (e) {
    console.error('Automation engine error:', e);
  }
}

function matchConditions(conditions: any[], payload: Record<string, any>): boolean {
  if (!conditions.length) return true;
  return conditions.every(cond => {
    const value = getNestedValue(payload, cond.field);
    switch (cond.operator) {
      case 'equals': return String(value) === String(cond.value);
      case 'not_equals': return String(value) !== String(cond.value);
      case 'contains': return String(value || '').toLowerCase().includes(String(cond.value).toLowerCase());
      case 'not_contains': return !String(value || '').toLowerCase().includes(String(cond.value).toLowerCase());
      case 'is_set': return value !== null && value !== undefined && value !== '';
      case 'is_not_set': return !value;
      default: return true;
    }
  });
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

async function executeAction(workspaceId: string, action: any, payload: any, ruleId: string) {
  const io = getIO();

  switch (action.type) {
    case 'assign_agent': {
      if (!payload.conversationId) break;
      await prisma.conversation.update({
        where: { id: payload.conversationId },
        data: { assigneeId: action.agentId },
      });
      io?.to(`workspace:${workspaceId}`).emit('conversation_updated', { conversationId: payload.conversationId });
      break;
    }

    case 'add_tag': {
      if (!payload.conversationId || !action.tagId) break;
      await prisma.conversationTag.upsert({
        where: { conversationId_tagId: { conversationId: payload.conversationId, tagId: action.tagId } },
        create: { conversationId: payload.conversationId, tagId: action.tagId },
        update: {},
      });
      io?.to(`workspace:${workspaceId}`).emit('conversation_updated', { conversationId: payload.conversationId });
      break;
    }

    case 'remove_tag': {
      if (!payload.conversationId || !action.tagId) break;
      await prisma.conversationTag.deleteMany({
        where: { conversationId: payload.conversationId, tagId: action.tagId },
      });
      break;
    }

    case 'set_status': {
      if (!payload.conversationId) break;
      await prisma.conversation.update({
        where: { id: payload.conversationId },
        data: { status: action.status },
      });
      io?.to(`workspace:${workspaceId}`).emit('conversation_updated', { conversationId: payload.conversationId });
      break;
    }

    case 'set_lifecycle': {
      const contactId = payload.contactId || payload.contact?.id;
      if (!contactId) break;
      await prisma.contact.update({
        where: { id: contactId },
        data: { lifecycleStage: action.stage },
      });
      break;
    }

    case 'send_message': {
      if (!payload.conversationId || !action.message) break;
      const conv = await prisma.conversation.findUnique({
        where: { id: payload.conversationId },
        include: { channel: true },
      });
      if (!conv) break;
      const msg = await prisma.message.create({
        data: {
          content: action.message,
          direction: 'outbound',
          type: 'text',
          conversationId: payload.conversationId,
          senderName: 'Automation',
          status: 'sent',
        },
      });
      await prisma.conversation.update({
        where: { id: payload.conversationId },
        data: { lastMessageAt: new Date() },
      });
      io?.to(`workspace:${workspaceId}`).emit('new_message', {
        conversationId: payload.conversationId,
        message: msg,
      });
      break;
    }

    case 'send_webhook': {
      if (!action.url) break;
      const https = action.url.startsWith('https') ? require('https') : require('http');
      const body = JSON.stringify({ event: 'automation', ruleId, payload });
      const url = new URL(action.url);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      };
      const req = https.request(options);
      req.write(body);
      req.end();
      break;
    }

    case 'add_note': {
      if (!payload.conversationId || !action.note) break;
      const note = await prisma.message.create({
        data: {
          content: action.note,
          direction: 'outbound',
          type: 'text',
          isNote: true,
          conversationId: payload.conversationId,
          senderName: 'Automation',
          status: 'sent',
        },
      });
      io?.to(`workspace:${workspaceId}`).emit('new_message', {
        conversationId: payload.conversationId,
        message: note,
      });
      break;
    }

    default:
      console.warn('Unknown automation action:', action.type);
  }
}
