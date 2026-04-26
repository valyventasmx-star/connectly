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
import searchRoutes from './routes/search';
import customFieldsRoutes from './routes/customFields';
import reactionsRoutes from './routes/reactions';
import outboundWebhooksRoutes from './routes/outboundWebhooks';
import templatesRoutes from './routes/templates';
import dashboardRoutes from './routes/dashboard';
import inboxViewsRoutes from './routes/inboxViews';
import apiKeysRoutes from './routes/apiKeys';
import auditLogRoutes from './routes/auditLog';
import autoAssignRoutes from './routes/autoAssign';
import csatRoutes from './routes/csat';
import automationRulesRoutes from './routes/automationRules';
import emailChannelRoutes from './routes/emailChannel';
import contactSegmentsRoutes from './routes/contactSegments';
import twoFactorRoutes from './routes/twoFactor';
import onboardingRoutes from './routes/onboarding';
import knowledgeBaseRoutes from './routes/knowledgeBase';
import scheduledMessagesRoutes from './routes/scheduledMessages';
import shopifyRoutes from './routes/shopify';
import importContactsRoutes from './routes/importContacts';
import brandingRoutes from './routes/branding';
import customReportsRoutes from './routes/customReports';
import notificationsRoutes from './routes/notifications';
import mediaUploadRoutes from './routes/mediaUpload';
import flowBotsRoutes from './routes/flowBots';
import liveChatRoutes from './routes/liveChat';
import instagramWebhookRoutes from './routes/instagramWebhook';
import telegramWebhookRoutes from './routes/telegramWebhook';
import smsWebhookRoutes from './routes/smsWebhook';
import sandboxBridgeRoutes from './routes/sandboxBridge';
import aiTrainingRoutes from './routes/aiTraining';
import leaderboardRoutes from './routes/leaderboard';
import rolesRoutes from './routes/roles';
import hubspotRoutes from './routes/hubspot';
import { startCronJobs, startDailyDigest } from './services/cron';
import path from 'path';

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
app.use('/api/workspaces/:workspaceId/search', searchRoutes);
app.use('/api/workspaces/:workspaceId/custom-fields', customFieldsRoutes);
app.use('/api/workspaces/:workspaceId/conversations', reactionsRoutes);
app.use('/api/workspaces/:workspaceId/outbound-webhooks', outboundWebhooksRoutes);
app.use('/api/workspaces/:workspaceId/templates', templatesRoutes);
app.use('/api/workspaces/:workspaceId/dashboard', dashboardRoutes);
app.use('/api/workspaces/:workspaceId/inbox-views', inboxViewsRoutes);
app.use('/api/workspaces/:workspaceId/api-keys', apiKeysRoutes);
app.use('/api/workspaces/:workspaceId/audit-log', auditLogRoutes);
app.use('/api/workspaces/:workspaceId/auto-assign-rules', autoAssignRoutes);
app.use('/api/workspaces/:workspaceId/csat', csatRoutes);
app.use('/api/csat', csatRoutes);
app.use('/api/workspaces/:workspaceId/automation-rules', automationRulesRoutes);
app.use('/api/workspaces/:workspaceId/contact-segments', contactSegmentsRoutes);
app.use('/api/workspaces/:workspaceId/onboarding', onboardingRoutes);
app.use('/api/workspaces/:workspaceId/knowledge-base', knowledgeBaseRoutes);
app.use('/api/workspaces/:workspaceId/conversations', scheduledMessagesRoutes);
app.use('/api/workspaces/:workspaceId/shopify', shopifyRoutes);
app.use('/api/workspaces/:workspaceId/contacts', importContactsRoutes);
app.use('/api/workspaces/:workspaceId', brandingRoutes);
app.use('/api/workspaces/:workspaceId/custom-reports', customReportsRoutes);
app.use('/api/workspaces/:workspaceId/notifications', notificationsRoutes);
app.use('/api/workspaces/:workspaceId/flow-bots', flowBotsRoutes);
app.use('/api/media', mediaUploadRoutes);
app.use('/api/workspaces/:workspaceId/live-chat', liveChatRoutes);
app.use('/api/live-chat', liveChatRoutes); // public endpoints (widget config + conversation)
// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/workspaces/:workspaceId/email', emailChannelRoutes);
app.use('/api/email/inbound', emailChannelRoutes); // public inbound
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/workspaces', billingRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/webhooks/instagram', instagramWebhookRoutes);
app.use('/api/webhooks/messenger', instagramWebhookRoutes); // same handler, different Meta object type
app.use('/api/webhooks/telegram', telegramWebhookRoutes);
app.use('/api/workspaces/:workspaceId/ai-training', aiTrainingRoutes);
app.use('/api/workspaces/:workspaceId/leaderboard', leaderboardRoutes);
app.use('/api/workspaces/:workspaceId/members', rolesRoutes);
app.use('/api/workspaces/:workspaceId/hubspot', hubspotRoutes);
app.use('/api/webhooks/sms', express.urlencoded({ extended: false }), smsWebhookRoutes);
// Server-to-server bridge: WhatsApp bot → Connectly DB persistence
app.use('/api/sandbox', sandboxBridgeRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

initSocket(httpServer);
startCronJobs();
startDailyDigest();

const PORT = parseInt(process.env.PORT || '3001');
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Connectly backend running on http://0.0.0.0:${PORT}`);
  console.log(`📡 WebSocket server ready\n`);
});
