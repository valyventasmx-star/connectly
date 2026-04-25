import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import { knowledgeBaseApi } from '../api/client';
import { PlusIcon, TrashIcon, PencilIcon, MagnifyingGlassIcon, BookOpenIcon, SparklesIcon } from '@heroicons/react/24/outline';

export default function KnowledgeBase() {
  const { currentWorkspace } = useWorkspaceStore();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', content: '', category: '' });
  const [saving, setSaving] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiSearching, setAiSearching] = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    load();
  }, [currentWorkspace]);

  const load = async (q?: string) => {
    if (!currentWorkspace) return;
    setLoading(true);
    knowledgeBaseApi.list(currentWorkspace.id, q).then(r => setArticles(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  const handleSearch = (v: string) => {
    setSearch(v);
    load(v || undefined);
  };

  const openCreate = () => { setEditing(null); setForm({ title: '', content: '', category: '' }); setShowForm(true); };
  const openEdit = (a: any) => { setEditing(a); setForm({ title: a.title, content: a.content, category: a.category || '' }); setShowForm(true); };

  const handleSave = async () => {
    if (!currentWorkspace || !form.title || !form.content) return;
    setSaving(true);
    try {
      if (editing) {
        const { data } = await knowledgeBaseApi.update(currentWorkspace.id, editing.id, form);
        setArticles(prev => prev.map(a => a.id === editing.id ? data : a));
      } else {
        const { data } = await knowledgeBaseApi.create(currentWorkspace.id, form);
        setArticles(prev => [data, ...prev]);
      }
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!currentWorkspace || !confirm('Delete this article?')) return;
    await knowledgeBaseApi.delete(currentWorkspace.id, id);
    setArticles(prev => prev.filter(a => a.id !== id));
  };

  const handleAiSearch = async () => {
    if (!currentWorkspace || !aiQuery.trim()) return;
    setAiSearching(true);
    setAiAnswer(null);
    try {
      const { data } = await knowledgeBaseApi.aiSearch(currentWorkspace.id, aiQuery);
      setAiAnswer(data.answer || 'No relevant answer found in the knowledge base.');
    } catch { setAiAnswer('AI search failed.'); }
    finally { setAiSearching(false); }
  };

  const categories = [...new Set(articles.map(a => a.category).filter(Boolean))];

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Knowledge Base</h1>
            <p className="text-sm text-gray-500">Articles your AI assistant uses to answer questions</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700">
            <PlusIcon className="w-4 h-4" /> New Article
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl space-y-4">
            {/* AI Search */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <SparklesIcon className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-semibold text-purple-900">AI Search</h3>
              </div>
              <div className="flex gap-3">
                <input
                  className="flex-1 border border-purple-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                  placeholder="Ask anything about your knowledge base..."
                  value={aiQuery}
                  onChange={e => setAiQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
                />
                <button onClick={handleAiSearch} disabled={aiSearching || !aiQuery.trim()}
                  className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                  {aiSearching ? 'Searching…' : 'Ask AI'}
                </button>
              </div>
              {aiAnswer && (
                <div className="mt-3 p-3 bg-white rounded-xl border border-purple-100 text-sm text-gray-700">{aiAnswer}</div>
              )}
            </div>

            {/* Search filter */}
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Search articles..."
                value={search}
                onChange={e => handleSearch(e.target.value)}
              />
            </div>

            {/* New/Edit Form */}
            {showForm && (
              <div className="bg-white border-2 border-primary-100 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-gray-900">{editing ? 'Edit Article' : 'New Article'}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Article title" autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g. Shipping, Returns" list="categories" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                    <datalist id="categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                  <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    rows={8} placeholder="Write your article content here..." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleSave} disabled={saving || !form.title || !form.content}
                    className="bg-primary-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                    {saving ? 'Saving…' : editing ? 'Update' : 'Create Article'}
                  </button>
                  <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl">Cancel</button>
                </div>
              </div>
            )}

            {/* Articles list */}
            {loading ? (
              <div className="flex justify-center py-16"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
            ) : articles.length === 0 && !showForm ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
                  <BookOpenIcon className="w-8 h-8 text-primary-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">No articles yet</h3>
                <p className="text-sm text-gray-500 mb-4 max-w-sm">Add articles so your AI assistant can answer customer questions accurately.</p>
                <button onClick={openCreate} className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700">Create first article</button>
              </div>
            ) : (
              <div className="space-y-3">
                {articles.map(a => (
                  <div key={a.id} className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-gray-900">{a.title}</h4>
                          {a.category && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.category}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{a.content}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(a)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"><PencilIcon className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(a.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
