import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (name: string, email: string, password: string, workspaceName?: string) =>
    api.post('/auth/register', { name, email, password, workspaceName }),
  me: () => api.get('/auth/me'),
  updateMe: (data: any) => api.patch('/auth/me', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Workspaces
export const workspacesApi = {
  list: () => api.get('/workspaces'),
  create: (name: string, description?: string) => api.post('/workspaces', { name, description }),
  get: (id: string) => api.get(`/workspaces/${id}`),
  update: (id: string, data: any) => api.patch(`/workspaces/${id}`, data),
  delete: (id: string) => api.delete(`/workspaces/${id}`),
  addMember: (id: string, email: string, role: string) =>
    api.post(`/workspaces/${id}/members`, { email, role }),
  removeMember: (id: string, userId: string) => api.delete(`/workspaces/${id}/members/${userId}`),
};

// Channels
export const channelsApi = {
  list: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/channels`),
  create: (workspaceId: string, data: any) => api.post(`/workspaces/${workspaceId}/channels`, data),
  get: (workspaceId: string, channelId: string) =>
    api.get(`/workspaces/${workspaceId}/channels/${channelId}`),
  update: (workspaceId: string, channelId: string, data: any) =>
    api.patch(`/workspaces/${workspaceId}/channels/${channelId}`, data),
  delete: (workspaceId: string, channelId: string) =>
    api.delete(`/workspaces/${workspaceId}/channels/${channelId}`),
  test: (workspaceId: string, channelId: string) =>
    api.post(`/workspaces/${workspaceId}/channels/${channelId}/test`),
};

// Contacts
export const contactsApi = {
  list: (workspaceId: string, params?: any) =>
    api.get(`/workspaces/${workspaceId}/contacts`, { params }),
  create: (workspaceId: string, data: any) => api.post(`/workspaces/${workspaceId}/contacts`, data),
  get: (workspaceId: string, contactId: string) =>
    api.get(`/workspaces/${workspaceId}/contacts/${contactId}`),
  update: (workspaceId: string, contactId: string, data: any) =>
    api.patch(`/workspaces/${workspaceId}/contacts/${contactId}`, data),
  delete: (workspaceId: string, contactId: string) =>
    api.delete(`/workspaces/${workspaceId}/contacts/${contactId}`),
};

// Conversations
export const conversationsApi = {
  list: (workspaceId: string, params?: any) =>
    api.get(`/workspaces/${workspaceId}/conversations`, { params }),
  create: (workspaceId: string, data: any) =>
    api.post(`/workspaces/${workspaceId}/conversations`, data),
  get: (workspaceId: string, conversationId: string) =>
    api.get(`/workspaces/${workspaceId}/conversations/${conversationId}`),
  update: (workspaceId: string, conversationId: string, data: any) =>
    api.patch(`/workspaces/${workspaceId}/conversations/${conversationId}`, data),
};

// Messages
export const messagesApi = {
  list: (workspaceId: string, conversationId: string, params?: any) =>
    api.get(`/workspaces/${workspaceId}/conversations/${conversationId}/messages`, { params }),
  send: (workspaceId: string, conversationId: string, content: string, type?: string, isNote?: boolean) =>
    api.post(`/workspaces/${workspaceId}/conversations/${conversationId}/messages`, { content, type, isNote }),
};

// Search
export const searchApi = {
  search: (workspaceId: string, q: string) =>
    api.get(`/workspaces/${workspaceId}/search`, { params: { q } }),
};

// Tags
export const tagsApi = {
  list: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/tags`),
  create: (workspaceId: string, name: string, color: string) =>
    api.post(`/workspaces/${workspaceId}/tags`, { name, color }),
  update: (workspaceId: string, tagId: string, data: any) =>
    api.patch(`/workspaces/${workspaceId}/tags/${tagId}`, data),
  delete: (workspaceId: string, tagId: string) =>
    api.delete(`/workspaces/${workspaceId}/tags/${tagId}`),
};

// Saved Responses
export const savedResponsesApi = {
  list: (workspaceId: string, params?: any) =>
    api.get(`/workspaces/${workspaceId}/saved-responses`, { params }),
  create: (workspaceId: string, data: any) =>
    api.post(`/workspaces/${workspaceId}/saved-responses`, data),
  update: (workspaceId: string, id: string, data: any) =>
    api.patch(`/workspaces/${workspaceId}/saved-responses/${id}`, data),
  delete: (workspaceId: string, id: string) =>
    api.delete(`/workspaces/${workspaceId}/saved-responses/${id}`),
};

// Contact Activity
export const contactActivityApi = {
  list: (workspaceId: string, contactId: string) =>
    api.get(`/workspaces/${workspaceId}/contacts/${contactId}/activity`),
  add: (workspaceId: string, contactId: string, data: any) =>
    api.post(`/workspaces/${workspaceId}/contacts/${contactId}/activity`, data),
};

// Reactions
export const reactionsApi = {
  toggle: (workspaceId: string, conversationId: string, messageId: string, emoji: string) =>
    api.post(`/workspaces/${workspaceId}/conversations/${conversationId}/messages/${messageId}/reactions`, { emoji }),
};

// Custom Fields
export const customFieldsApi = {
  list: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/custom-fields`),
  create: (workspaceId: string, data: any) => api.post(`/workspaces/${workspaceId}/custom-fields`, data),
  update: (workspaceId: string, fieldId: string, data: any) => api.patch(`/workspaces/${workspaceId}/custom-fields/${fieldId}`, data),
  delete: (workspaceId: string, fieldId: string) => api.delete(`/workspaces/${workspaceId}/custom-fields/${fieldId}`),
  getValues: (workspaceId: string, contactId: string) => api.get(`/workspaces/${workspaceId}/custom-fields/values/${contactId}`),
  setValue: (workspaceId: string, contactId: string, fieldId: string, value: string) =>
    api.put(`/workspaces/${workspaceId}/custom-fields/values/${contactId}/${fieldId}`, { value }),
};

// Templates
export const templatesApi = {
  list: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/templates`),
  create: (workspaceId: string, data: any) => api.post(`/workspaces/${workspaceId}/templates`, data),
  update: (workspaceId: string, id: string, data: any) => api.patch(`/workspaces/${workspaceId}/templates/${id}`, data),
  delete: (workspaceId: string, id: string) => api.delete(`/workspaces/${workspaceId}/templates/${id}`),
};

// Outbound Webhooks
export const outboundWebhooksApi = {
  list: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/outbound-webhooks`),
  create: (workspaceId: string, data: any) => api.post(`/workspaces/${workspaceId}/outbound-webhooks`, data),
  update: (workspaceId: string, id: string, data: any) => api.patch(`/workspaces/${workspaceId}/outbound-webhooks/${id}`, data),
  delete: (workspaceId: string, id: string) => api.delete(`/workspaces/${workspaceId}/outbound-webhooks/${id}`),
};

// Dashboard
export const dashboardApi = {
  get: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/dashboard`),
};

// Inbox Views
export const inboxViewsApi = {
  list: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/inbox-views`),
  create: (workspaceId: string, name: string, filters: any) =>
    api.post(`/workspaces/${workspaceId}/inbox-views`, { name, filters }),
  delete: (workspaceId: string, viewId: string) =>
    api.delete(`/workspaces/${workspaceId}/inbox-views/${viewId}`),
};

// API Keys
export const apiKeysApi = {
  list: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/api-keys`),
  create: (workspaceId: string, name: string, expiresAt?: string) =>
    api.post(`/workspaces/${workspaceId}/api-keys`, { name, expiresAt }),
  delete: (workspaceId: string, keyId: string) =>
    api.delete(`/workspaces/${workspaceId}/api-keys/${keyId}`),
};

// Audit Log
export const auditLogApi = {
  list: (workspaceId: string, params?: any) =>
    api.get(`/workspaces/${workspaceId}/audit-log`, { params }),
};

// Auto-assign Rules
export const autoAssignApi = {
  list: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/auto-assign-rules`),
  create: (workspaceId: string, data: any) =>
    api.post(`/workspaces/${workspaceId}/auto-assign-rules`, data),
  update: (workspaceId: string, id: string, data: any) =>
    api.patch(`/workspaces/${workspaceId}/auto-assign-rules/${id}`, data),
  delete: (workspaceId: string, id: string) =>
    api.delete(`/workspaces/${workspaceId}/auto-assign-rules/${id}`),
};

// CSAT
export const csatApi = {
  get: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/csat`),
  submit: (conversationId: string, score: number, comment?: string) =>
    api.post(`/csat/submit`, { conversationId, score, comment }),
  send: (workspaceId: string, conversationId: string) =>
    api.post(`/workspaces/${workspaceId}/csat/send/${conversationId}`),
};

// Reports
export const reportsApi = {
  lifecycle: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/reports/lifecycle`),
  conversations: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/reports/conversations`),
  leaderboard: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/reports/leaderboard`),
  tags: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/reports/tags`),
  exportContacts: async (workspaceId: string) => {
    const res = await api.get(`/workspaces/${workspaceId}/reports/export/contacts`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = 'contacts.csv'; a.click(); URL.revokeObjectURL(url);
  },
  exportConversations: async (workspaceId: string) => {
    const res = await api.get(`/workspaces/${workspaceId}/reports/export/conversations`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data); const a = document.createElement('a'); a.href = url; a.download = 'conversations.csv'; a.click(); URL.revokeObjectURL(url);
  },
};

// Knowledge Base
export const knowledgeBaseApi = {
  list: (workspaceId: string, q?: string) => api.get(`/workspaces/${workspaceId}/knowledge-base`, { params: q ? { q } : {} }),
  create: (workspaceId: string, data: any) => api.post(`/workspaces/${workspaceId}/knowledge-base`, data),
  update: (workspaceId: string, id: string, data: any) => api.patch(`/workspaces/${workspaceId}/knowledge-base/${id}`, data),
  delete: (workspaceId: string, id: string) => api.delete(`/workspaces/${workspaceId}/knowledge-base/${id}`),
  aiSearch: (workspaceId: string, query: string) => api.post(`/workspaces/${workspaceId}/knowledge-base/ai-search`, { query }),
};

// Scheduled Messages
export const scheduledMessagesApi = {
  list: (workspaceId: string, conversationId: string) =>
    api.get(`/workspaces/${workspaceId}/conversations/${conversationId}/scheduled`),
  create: (workspaceId: string, conversationId: string, data: any) =>
    api.post(`/workspaces/${workspaceId}/conversations/${conversationId}/scheduled`, data),
  delete: (workspaceId: string, conversationId: string, id: string) =>
    api.delete(`/workspaces/${workspaceId}/conversations/${conversationId}/scheduled/${id}`),
};

// Shopify
export const shopifyApi = {
  get: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/shopify`),
  save: (workspaceId: string, data: any) => api.post(`/workspaces/${workspaceId}/shopify`, data),
  toggle: (workspaceId: string, enabled: boolean) => api.patch(`/workspaces/${workspaceId}/shopify`, { enabled }),
  delete: (workspaceId: string) => api.delete(`/workspaces/${workspaceId}/shopify`),
  getOrders: (workspaceId: string, contactId: string) => api.get(`/workspaces/${workspaceId}/shopify/orders/${contactId}`),
};

// Branding + Business Hours + Usage
export const brandingApi = {
  get: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/`),
  updateBranding: (workspaceId: string, data: any) => api.patch(`/workspaces/${workspaceId}/branding`, data),
  updateBusinessHours: (workspaceId: string, data: any) => api.patch(`/workspaces/${workspaceId}/business-hours`, data),
  getUsage: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/usage`),
};

// Custom Reports
export const customReportsApi = {
  build: (workspaceId: string, params: any) => api.post(`/workspaces/${workspaceId}/custom-reports/build`, params),
};

// AI helpers
export const aiApi = {
  suggestions: (workspaceId: string, conversationId: string) =>
    api.get(`/workspaces/${workspaceId}/conversations/${conversationId}/ai-suggestions`),
  summary: (workspaceId: string, conversationId: string) =>
    api.get(`/workspaces/${workspaceId}/conversations/${conversationId}/ai-summary`),
};

// Snooze
export const snoozeApi = {
  snooze: (workspaceId: string, conversationId: string, until: string) =>
    api.post(`/workspaces/${workspaceId}/conversations/${conversationId}/snooze`, { until }),
  unsnooze: (workspaceId: string, conversationId: string) =>
    api.post(`/workspaces/${workspaceId}/conversations/${conversationId}/unsnooze`),
};

// Contact Import
export const importApi = {
  csv: (workspaceId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/workspaces/${workspaceId}/contacts/import`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Automation Rules
export const automationApi = {
  list: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/automation-rules`),
  create: (workspaceId: string, data: any) => api.post(`/workspaces/${workspaceId}/automation-rules`, data),
  update: (workspaceId: string, id: string, data: any) => api.patch(`/workspaces/${workspaceId}/automation-rules/${id}`, data),
  delete: (workspaceId: string, id: string) => api.delete(`/workspaces/${workspaceId}/automation-rules/${id}`),
};

// Contact Segments
export const segmentsApi = {
  list: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/contact-segments`),
  create: (workspaceId: string, data: any) => api.post(`/workspaces/${workspaceId}/contact-segments`, data),
  update: (workspaceId: string, id: string, data: any) => api.patch(`/workspaces/${workspaceId}/contact-segments/${id}`, data),
  delete: (workspaceId: string, id: string) => api.delete(`/workspaces/${workspaceId}/contact-segments/${id}`),
  preview: (workspaceId: string, filters: any[]) =>
    api.post(`/workspaces/${workspaceId}/contact-segments/preview`, { filters }),
  getContacts: (workspaceId: string, id: string) =>
    api.get(`/workspaces/${workspaceId}/contact-segments/${id}/contacts`),
};

// Onboarding
export const onboardingApi = {
  get: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/onboarding`),
  update: (workspaceId: string, data: any) => api.patch(`/workspaces/${workspaceId}/onboarding`, data),
};

// 2FA
export const twoFactorApi = {
  status: () => api.get('/2fa/status'),
  setup: () => api.post('/2fa/setup'),
  verify: (token: string) => api.post('/2fa/verify', { token }),
  disable: (token: string) => api.post('/2fa/disable', { token }),
};

// Email Channel
export const emailChannelApi = {
  test: (workspaceId: string, channelId: string, config: any) =>
    api.post(`/workspaces/${workspaceId}/email/test`, { channelId, ...config }),
  send: (workspaceId: string, data: any) =>
    api.post(`/workspaces/${workspaceId}/email/send`, data),
};

export default api;
