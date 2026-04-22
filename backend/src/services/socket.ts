import { Server as HTTPServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

let io: SocketServer;

export function initSocket(server: HTTPServer) {
  io = new SocketServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) return next(new Error('User not found'));
      (socket as any).user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    console.log(`Socket connected: ${user.email}`);

    socket.on('join_workspace', async (workspaceId: string) => {
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId: user.id },
      });
      if (member) {
        socket.join(`workspace:${workspaceId}`);
        console.log(`${user.email} joined workspace:${workspaceId}`);
      }
    });

    socket.on('leave_workspace', (workspaceId: string) => {
      socket.leave(`workspace:${workspaceId}`);
    });

    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('typing', ({ conversationId, isTyping }: any) => {
      socket.to(`conversation:${conversationId}`).emit('typing', {
        userId: user.id,
        userName: user.name,
        isTyping,
      });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${user.email}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
