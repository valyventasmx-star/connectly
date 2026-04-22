import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; name: string };
  workspace?: any;
  workspaceMember?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireWorkspace = (paramName = 'workspaceId') => async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const workspaceId = req.params[paramName] || req.body.workspaceId || req.query.workspaceId as string;
  if (!workspaceId) return res.status(400).json({ error: 'Workspace ID required' });

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: req.user!.id },
    include: { workspace: true },
  });
  if (!member) return res.status(403).json({ error: 'Access denied to this workspace' });

  req.workspace = member.workspace;
  req.workspaceMember = member;
  next();
};
