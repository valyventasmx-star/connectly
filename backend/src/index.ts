import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { initSocket } from './services/socket';

import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspaces';
import channelRoutes from './routes/channels';
import contactRoutes from './routes/contacts';
import conversationRoutes from './routes/conversations';
import messageRoutes from './routes/messages';
import tagRoutes from './routes/tags';
import webhookRoutes from './routes/webhooks';

const app = express();
const httpServer = createServer(app);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/workspaces/:workspaceId/channels', channelRoutes);
app.use('/api/workspaces/:workspaceId/contacts', contactRoutes);
app.use('/api/workspaces/:workspaceId/conversations', conversationRoutes);
app.use('/api/workspaces/:workspaceId/conversations', messageRoutes);
app.use('/api/workspaces/:workspaceId/tags', tagRoutes);
app.use('/api/webhooks', webhookRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Init Socket.io
initSocket(httpServer);

const PORT = parseInt(process.env.PORT || '3001');
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Connectly backend running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🗄️  Database: SQLite (./prisma/dev.db)\n`);
});
