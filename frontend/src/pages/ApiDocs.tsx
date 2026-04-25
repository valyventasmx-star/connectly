import AppLayout from '../components/Layout/AppLayout';
import { useState } from 'react';
import { ClipboardDocumentIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const ENDPOINTS = [
  {
    group: 'Contacts',
    color: 'bg-blue-50 text-blue-700',
    items: [
      { method: 'GET',    path: '/api/workspaces/:id/contacts',           desc: 'List contacts',        params: 'page, limit, search, lifecycleStage' },
      { method: 'POST',   path: '/api/workspaces/:id/contacts',           desc: 'Create contact',       params: 'name, phone, email, company, notes, lifecycleStage' },
      { method: 'PATCH',  path: '/api/workspaces/:id/contacts/:contactId', desc: 'Update contact',       params: 'name, phone, email, company, lifecycleStage' },
      { method: 'DELETE', path: '/api/workspaces/:id/contacts/:contactId', desc: 'Delete contact',       params: '' },
      { method: 'POST',   path: '/api/workspaces/:id/contacts/import',    desc: 'Import CSV',           params: 'multipart/form-data: file (CSV)' },
    ],
  },
  {
    group: 'Conversations',
    color: 'bg-green-50 text-green-700',
    items: [
      { method: 'GET',  path: '/api/workspaces/:id/conversations',                    desc: 'List conversations',   params: 'status, channelId, assigneeId, search, page, limit' },
      { method: 'POST', path: '/api/workspaces/:id/conversations',                    desc: 'Create conversation',  params: 'contactId, channelId' },
      { method: 'PATCH',path: '/api/workspaces/:id/conversations/:cid',               desc: 'Update conversation',  params: 'status, assigneeId' },
      { method: 'POST', path: '/api/workspaces/:id/conversations/:cid/snooze',        desc: 'Snooze conversation',  params: 'until (ISO datetime)' },
      { method: 'POST', path: '/api/workspaces/:id/conversations/:cid/unsnooze',      desc: 'Un-snooze',            params: '' },
    ],
  },
  {
    group: 'Messages',
    color: 'bg-purple-50 text-purple-700',
    items: [
      { method: 'GET',  path: '/api/workspaces/:id/conversations/:cid/messages',      desc: 'List messages',        params: 'page, limit' },
      { method: 'POST', path: '/api/workspaces/:id/conversations/:cid/messages',      desc: 'Send message',         params: 'content, type, isNote' },
      { method: 'POST', path: '/api/workspaces/:id/conversations/:cid/scheduled',     desc: 'Schedule message',     params: 'content, scheduledAt (ISO), type' },
    ],
  },
  {
    group: 'AI',
    color: 'bg-indigo-50 text-indigo-700',
    items: [
      { method: 'GET',  path: '/api/workspaces/:id/conversations/:cid/ai-suggestions', desc: 'Get 3 reply suggestions', params: '' },
      { method: 'GET',  path: '/api/workspaces/:id/conversations/:cid/ai-summary',     desc: 'Summarize conversation',  params: '' },
      { method: 'POST', path: '/api/workspaces/:id/conversations/:cid/ai-reply',       desc: 'Auto-send AI reply',      params: '' },
    ],
  },
  {
    group: 'Broadcasts',
    color: 'bg-orange-50 text-orange-700',
    items: [
      { method: 'GET',  path: '/api/workspaces/:id/broadcasts',           desc: 'List broadcasts',      params: '' },
      { method: 'POST', path: '/api/workspaces/:id/broadcasts',           desc: 'Create broadcast',     params: 'name, message, channelId, contactIds, scheduledAt' },
    ],
  },
  {
    group: 'Segments',
    color: 'bg-pink-50 text-pink-700',
    items: [
      { method: 'GET',  path: '/api/workspaces/:id/contact-segments',                   desc: 'List segments',         params: '' },
      { method: 'POST', path: '/api/workspaces/:id/contact-segments',                   desc: 'Create segment',        params: 'name, filters, color' },
      { method: 'POST', path: '/api/workspaces/:id/contact-segments/preview',            desc: 'Preview count',         params: 'filters' },
      { method: 'GET',  path: '/api/workspaces/:id/contact-segments/:sid/contacts',      desc: 'Segment contacts',      params: '' },
    ],
  },
  {
    group: 'Knowledge Base',
    color: 'bg-teal-50 text-teal-700',
    items: [
      { method: 'GET',  path: '/api/workspaces/:id/knowledge-base',       desc: 'List articles',        params: 'q (search query)' },
      { method: 'POST', path: '/api/workspaces/:id/knowledge-base',       desc: 'Create article',       params: 'title, content, category' },
      { method: 'POST', path: '/api/workspaces/:id/knowledge-base/ai-search', desc: 'AI semantic search', params: 'query' },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-blue-100 text-blue-700',
  POST:   'bg-green-100 text-green-700',
  PATCH:  'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
  PUT:    'bg-purple-100 text-purple-700',
};

export default function ApiDocs() {
  const [copied, setCopied] = useState('');

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const baseUrl = window.location.origin;

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">API Documentation</h1>
          <p className="text-sm text-gray-500">REST API reference — authenticate with your API key</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl space-y-6">
            {/* Auth info */}
            <div className="bg-gray-900 text-gray-100 rounded-2xl p-5">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-3">Authentication</p>
              <p className="text-sm mb-3">All requests require an <code className="text-green-400">Authorization</code> header with your API key:</p>
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-3">
                <code className="text-sm text-green-400 flex-1">Authorization: Bearer cnk_your_api_key_here</code>
                <button onClick={() => copy('Authorization: Bearer cnk_your_api_key_here', 'auth')} className="text-gray-400 hover:text-white">
                  {copied === 'auth' ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Generate API keys in Settings → API Keys</p>
            </div>

            {/* Base URL */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Base URL</p>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2.5">
                <code className="text-sm text-gray-800 flex-1">{baseUrl}</code>
                <button onClick={() => copy(baseUrl, 'base')} className="text-gray-400 hover:text-gray-600">
                  {copied === 'base' ? <CheckCircleIcon className="w-4 h-4 text-green-500" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Endpoints */}
            {ENDPOINTS.map(group => (
              <div key={group.group} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className={`px-5 py-3 ${group.color} border-b border-black/5`}>
                  <h3 className="text-sm font-semibold">{group.group}</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {group.items.map((ep, i) => (
                    <div key={i} className="px-5 py-3 flex items-start gap-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 mt-0.5 ${METHOD_COLORS[ep.method]}`}>{ep.method}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-gray-700 truncate">{ep.path}</code>
                          <button onClick={() => copy(ep.path, ep.path)} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
                            {copied === ep.path ? <CheckCircleIcon className="w-3 h-3 text-green-500" /> : <ClipboardDocumentIcon className="w-3 h-3" />}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{ep.desc}</p>
                        {ep.params && <p className="text-xs text-gray-400 mt-0.5"><span className="font-medium">Params:</span> {ep.params}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-700">
              <p className="font-semibold mb-1">Rate Limits</p>
              <p>Free: 100 req/min · Starter: 500 req/min · Pro: 2,000 req/min · Agency: 10,000 req/min</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
