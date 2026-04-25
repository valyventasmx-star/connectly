import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import api from '../api/client';
import {
  PlusIcon, TrashIcon, DocumentTextIcon, GlobeAltIcon,
  ArrowUpTrayIcon, CheckIcon, XMarkIcon, SparklesIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

interface TrainingDoc {
  id: string;
  title: string;
  fileType: string;
  tokens: number;
  active: boolean;
  createdAt: string;
}

const FILE_TYPE_ICONS: Record<string, string> = {
  manual: '✍️', pdf: '📄', txt: '📝', md: '📋', url: '🌐', csv: '📊',
};

export default function AITraining() {
  const { currentWorkspace } = useWorkspaceStore();
  const [docs, setDocs] = useState<TrainingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddText, setShowAddText] = useState(false);
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [testQ, setTestQ] = useState('');
  const [testA, setTestA] = useState('');
  const [testing, setTesting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    if (!currentWorkspace) return;
    setLoading(true);
    api.get(`/workspaces/${currentWorkspace.id}/ai-training`)
      .then(r => setDocs(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [currentWorkspace]);

  const addText = async () => {
    if (!currentWorkspace || !title || !content) return;
    setSaving(true);
    try {
      const r = await api.post(`/workspaces/${currentWorkspace.id}/ai-training/text`, { title, content });
      setDocs(prev => [r.data, ...prev]);
      setTitle(''); setContent(''); setShowAddText(false);
    } finally { setSaving(false); }
  };

  const addUrl = async () => {
    if (!currentWorkspace || !url) return;
    setSaving(true);
    try {
      const r = await api.post(`/workspaces/${currentWorkspace.id}/ai-training/url`, { url });
      setDocs(prev => [r.data, ...prev]);
      setUrl(''); setShowAddUrl(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to fetch URL');
    } finally { setSaving(false); }
  };

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentWorkspace) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await api.post(`/workspaces/${currentWorkspace.id}/ai-training/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDocs(prev => [r.data, ...prev]);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleActive = async (doc: TrainingDoc) => {
    if (!currentWorkspace) return;
    await api.patch(`/workspaces/${currentWorkspace.id}/ai-training/${doc.id}`, { active: !doc.active });
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, active: !d.active } : d));
  };

  const deleteDoc = async (id: string) => {
    if (!currentWorkspace || !confirm('Delete this training document?')) return;
    await api.delete(`/workspaces/${currentWorkspace.id}/ai-training/${id}`);
    setDocs(prev => prev.filter(d => d.id !== id));
  };

  const testAI = async () => {
    if (!currentWorkspace || !testQ) return;
    setTesting(true);
    setTestA('');
    try {
      const r = await api.post(`/workspaces/${currentWorkspace.id}/ai-training/test`, { question: testQ });
      setTestA(r.data.answer);
    } catch (err: any) {
      setTestA('Error: ' + (err.response?.data?.error || err.message));
    } finally { setTesting(false); }
  };

  const totalTokens = docs.filter(d => d.active).reduce((s, d) => s + d.tokens, 0);

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-primary-500" /> AI Training
              </h1>
              <p className="text-sm text-text-secondary mt-0.5">
                Teach your AI assistant about your business. {docs.filter(d => d.active).length} active docs · ~{totalTokens.toLocaleString()} words
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" className="hidden" accept=".txt,.md,.csv,.pdf" onChange={uploadFile} />
              <button onClick={() => fileRef.current?.click()} disabled={saving} className="btn-secondary flex items-center gap-2 text-sm">
                <ArrowUpTrayIcon className="w-4 h-4" /> Upload File
              </button>
              <button onClick={() => setShowAddUrl(true)} className="btn-secondary flex items-center gap-2 text-sm">
                <GlobeAltIcon className="w-4 h-4" /> From URL
              </button>
              <button onClick={() => setShowAddText(true)} className="btn-primary flex items-center gap-2 text-sm">
                <PlusIcon className="w-4 h-4" /> Add Text
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 gap-6 p-6 overflow-hidden">
          {/* Doc list */}
          <div className="flex-1 overflow-y-auto space-y-3">
            {/* How it works banner */}
            <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-4 flex gap-3">
              <LightBulbIcon className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-primary-700 dark:text-primary-300">
                <strong>How it works:</strong> When the AI responds to customers, it searches your active training documents and injects the most relevant sections as context. No fine-tuning needed — just add your FAQs, product docs, pricing, or policies.
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-text-secondary">Loading…</div>
            ) : docs.length === 0 ? (
              <div className="text-center py-20">
                <DocumentTextIcon className="w-12 h-12 text-text-secondary mx-auto mb-3 opacity-40" />
                <h3 className="font-semibold mb-1">No training data yet</h3>
                <p className="text-sm text-text-secondary mb-4">Add documents, FAQs, or product info to make your AI smarter</p>
                <button onClick={() => setShowAddText(true)} className="btn-primary">Add First Document</button>
              </div>
            ) : (
              docs.map(doc => (
                <div key={doc.id} className={`bg-content-bg border rounded-xl p-4 flex items-center gap-4 ${doc.active ? 'border-sidebar-border' : 'border-sidebar-border opacity-60'}`}>
                  <div className="text-2xl flex-shrink-0">{FILE_TYPE_ICONS[doc.fileType] || '📄'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {doc.fileType.toUpperCase()} · ~{doc.tokens.toLocaleString()} words · added {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleActive(doc)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${doc.active ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}>
                      {doc.active ? '✓ Active' : 'Inactive'}
                    </button>
                    <button onClick={() => deleteDoc(doc.id)} className="p-1.5 text-text-secondary hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Test panel */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-content-bg border border-sidebar-border rounded-xl p-5 sticky top-0">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-primary-500" /> Test AI Knowledge
              </h3>
              <p className="text-xs text-text-secondary mb-3">Ask a question to see how the AI responds using your training data</p>
              <textarea
                className="input w-full text-sm mb-2"
                rows={3}
                placeholder="e.g. What is your return policy?"
                value={testQ}
                onChange={e => setTestQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), testAI())}
              />
              <button onClick={testAI} disabled={!testQ || testing} className="btn-primary w-full text-sm mb-3">
                {testing ? 'Thinking…' : 'Test Answer'}
              </button>
              {testA && (
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3 text-sm text-text-primary border border-primary-100 dark:border-primary-800 whitespace-pre-wrap">
                  {testA}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-sidebar-border">
                <p className="text-xs font-semibold text-text-secondary mb-2">TIPS</p>
                <ul className="text-xs text-text-secondary space-y-1">
                  <li>• Add your FAQ as a manual document</li>
                  <li>• Import product pages via URL</li>
                  <li>• Upload .txt or .md files</li>
                  <li>• Toggle docs off/on to A/B test</li>
                  <li>• Max 5 docs used per response</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add text modal */}
      {showAddText && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-content-bg rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Add Training Document</h3>
              <button onClick={() => setShowAddText(false)}><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Title *</label>
                <input className="input w-full" placeholder="e.g. Return Policy, Product FAQ..." value={title} onChange={e => setTitle(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="label">Content *</label>
                <textarea className="input w-full" rows={8} placeholder="Paste your FAQ, policy, product description, pricing..." value={content} onChange={e => setContent(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAddText(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={addText} disabled={!title || !content || saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : 'Add Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add URL modal */}
      {showAddUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-content-bg rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Import from URL</h3>
              <button onClick={() => setShowAddUrl(false)}><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-text-secondary mb-3">Connectly will fetch the page and extract the text content automatically.</p>
            <input className="input w-full mb-4" placeholder="https://yoursite.com/faq" value={url} onChange={e => setUrl(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setShowAddUrl(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={addUrl} disabled={!url || saving} className="btn-primary flex-1">
                {saving ? 'Fetching…' : 'Import Page'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
