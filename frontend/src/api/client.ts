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
  send: (workspaceId: string, conversationId: string, content: string, type?: string) =>
    api.post(`/workspaces/${workspaceId}/conversations/${conversationId}/messages`, { content, type }),
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

export default api;
