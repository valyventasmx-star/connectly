import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { initSocket } from './services/socket';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspaces';
import channelRoutes from './routes/channels';
import contactRoutes from './routes/contacts';
import conversationRoutes from './routes/conversations';
import messageRoutes from './routes/messages';
import tagRoutes from './routes/tags';
import webhookRoutes from './routes/webhooks';
import billingRoutes from './routes/billing';
import aiRoutes from './routes/ai';
import analyticsRoutes from './routes/analytics';
import adminRoutes from './routes/admin';
import broadcastRoutes from './routes/broadcasts';
import reportsRoutes from './routes/reports';
import savedResponsesRoutes from './routes/savedResponses';
import contactActivityRoutes from './routes/contactActivity';

const app = express();
const httpServer = createServer(app);

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(null, true); // permissive for now
    }
  },
  credentials: true,
}));

// Stripe webhook needs raw body
app.use('/api/billing/stripe-webhook', express.raw({ type: 'application/json' }));
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
app.use('/api/workspaces/:workspaceId', analyticsRoutes);
app.use('/api/workspaces/:workspaceId', aiRoutes);
app.use('/api/workspaces/:workspaceId/broadcasts', broadcastRoutes);
app.use('/api/workspaces/:workspaceId/reports', reportsRoutes);
app.use('/api/workspaces/:workspaceId/saved-responses', savedResponsesRoutes);
app.use('/api/workspaces/:workspaceId/contacts', contactActivityRoutes);
app.use('/api/workspaces', billingRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

initSocket(httpServer);

const PORT = parseInt(process.env.PORT || '3001');
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Connectly backend running on http://0.0.0.0:${PORT}`);
  console.log(`📡 WebSocket server ready\n`);
});
