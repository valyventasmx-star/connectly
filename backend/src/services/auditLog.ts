import prisma from '../lib/prisma';

export async function logAudit(
  workspaceId: string,
  userId: string,
  userName: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: any
) {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        userName,
        action,
        entityType,
        entityId,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (e) {
    console.error('AuditLog error:', e);
  }
}
