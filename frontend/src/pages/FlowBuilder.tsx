import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  TrashIcon,
  ArrowLeftIcon,
  PlayIcon,
  PauseIcon,
  CheckIcon,
  ChatBubbleLeftIcon,
  QuestionMarkCircleIcon,
  ClockIcon,
  TagIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { flowBotsApi } from '../api/client';
import { useWorkspaceStore } from '../store/workspace';
import AppLayout from '../components/Layout/AppLayout';
const Layout = AppLayout;

interface FlowNode {
  id: string;
  type: 'send_message' | 'ask_question' | 'delay' | 'add_tag' | 'end';
  position: { x: number; y: number };
  data: {
    message?: string;
    question?: string;
    variable?: string;
    delay?: number;
    unit?: string;
    tag?: string;
  };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const NODE_TYPES = [
  { type: 'send_message', label: 'Send Message', icon: ChatBubbleLeftIcon, color: 'bg-blue-500' },
  { type: 'ask_question', label: 'Ask Question', icon: QuestionMarkCircleIcon, color: 'bg-purple-500' },
  { type: 'delay', label: 'Wait / Delay', icon: ClockIcon, color: 'bg-amber-500' },
  { type: 'add_tag', label: 'Add Tag', icon: TagIcon, color: 'bg-green-500' },
  { type: 'end', label: 'End Flow', icon: CheckIcon, color: 'bg-gray-500' },
] as const;

const TRIGGER_TYPES = [
  { value: 'any_message', label: 'Any inbound message' },
  { value: 'first_message', label: 'First message from contact' },
  { value: 'keyword', label: 'Keyword match' },
];

function NodeCard({
  node,
  selected,
  onClick,
  onDelete,
  onPositionChange,
}: {
  node: FlowNode;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onPositionChange: (id: string, pos: { x: number; y: number }) => void;
}) {
  const def = NODE_TYPES.find((t) => t.type === node.type) || NODE_TYPES[0];
  const Icon = def.icon;
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragging.current = true;
    offset.current = { x: e.clientX - node.position.x, y: e.clientY - node.position.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      onPositionChange(node.id, { x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    };
    const onMouseUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [node.id, onPositionChange]);

  return (
    <div
      className={`absolute w-52 rounded-xl shadow-lg border-2 cursor-move select-none ${
        selected ? 'border-primary-500 shadow-primary-200' : 'border-sidebar-border'
      } bg-content-bg`}
      style={{ left: node.position.x, top: node.position.y }}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <div className={`${def.color} rounded-t-lg px-3 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-white" />
          <span className="text-white text-xs font-semibold">{def.label}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-white/70 hover:text-white"
        >
          <XMarkIcon className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="px-3 py-2 text-xs text-text-secondary">
        {node.type === 'send_message' && (node.data.message || <span className="italic">No message yet</span>)}
        {node.type === 'ask_question' && (node.data.question || <span className="italic">No question yet</span>)}
        {node.type === 'delay' && `Wait ${node.data.delay || 1} ${node.data.unit || 'minutes'}`}
        {node.type === 'add_tag' && (node.data.tag || <span className="italic">No tag yet</span>)}
        {node.type === 'end' && <span className="text-gray-400">End of flow</span>}
      </div>
    </div>
  );
}

function NodeEditor({ node, onChange, onClose }: { node: FlowNode; onChange: (n: FlowNode) => void; onClose: () => void }) {
  const [data, setData] = useState(node.data);
  const save = () => { onChange({ ...node, data }); onClose(); };

  return (
    <div className="absolute right-4 top-4 w-72 bg-content-bg border border-sidebar-border rounded-xl shadow-2xl z-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{NODE_TYPES.find(t => t.type === node.type)?.label}</h3>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><XMarkIcon className="w-4 h-4" /></button>
      </div>
      {node.type === 'send_message' && (
        <textarea
          className="input w-full text-sm"
          rows={4}
          placeholder="Message to send..."
          value={data.message || ''}
          onChange={e => setData({ ...data, message: e.target.value })}
        />
      )}
      {node.type === 'ask_question' && (
        <>
          <textarea
            className="input w-full text-sm mb-2"
            rows={3}
            placeholder="Question to ask..."
            value={data.question || ''}
            onChange={e => setData({ ...data, question: e.target.value })}
          />
          <input
            className="input w-full text-sm"
            placeholder="Save answer as variable (e.g. user_name)"
            value={data.variable || ''}
            onChange={e => setData({ ...data, variable: e.target.value })}
          />
        </>
      )}
      {node.type === 'delay' && (
        <div className="flex gap-2">
          <input
            type="number"
            className="input flex-1 text-sm"
            min={1}
            value={data.delay || 1}
            onChange={e => setData({ ...data, delay: parseInt(e.target.value) })}
          />
          <select
            className="input flex-1 text-sm"
            value={data.unit || 'minutes'}
            onChange={e => setData({ ...data, unit: e.target.value })}
          >
            <option value="seconds">seconds</option>
            <option value="minutes">minutes</option>
            <option value="hours">hours</option>
          </select>
        </div>
      )}
      {node.type === 'add_tag' && (
        <input
          className="input w-full text-sm"
          placeholder="Tag name..."
          value={data.tag || ''}
          onChange={e => setData({ ...data, tag: e.target.value })}
        />
      )}
      <button className="btn-primary w-full mt-3 text-sm" onClick={save}>Save</button>
    </div>
  );
}

export default function FlowBuilder() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  const [botName, setBotName] = useState('New Flow');
  const [trigger, setTrigger] = useState({ type: 'any_message', keywords: [] as string[] });
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [editingNode, setEditingNode] = useState<FlowNode | null>(null);
  const [active, setActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');

  useEffect(() => {
    if (id && currentWorkspace) {
      flowBotsApi.get(currentWorkspace.id, id).then(r => {
        const bot = r.data;
        setBotName(bot.name);
        setTrigger(JSON.parse(bot.trigger));
        setNodes(JSON.parse(bot.nodes));
        setEdges(JSON.parse(bot.edges));
        setActive(bot.active);
      }).catch(console.error);
    }
  }, [id, currentWorkspace]);

  const addNode = (type: FlowNode['type']) => {
    const newNode: FlowNode = {
      id: `node-${Date.now()}`,
      type,
      position: { x: 100 + nodes.length * 60, y: 100 + nodes.length * 40 },
      data: {},
    };
    setNodes(prev => [...prev, newNode]);
  };

  const deleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode?.id === nodeId) setSelectedNode(null);
    if (editingNode?.id === nodeId) setEditingNode(null);
  };

  const updateNodePosition = useCallback((id: string, pos: { x: number; y: number }) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, position: pos } : n));
  }, []);

  const updateNodeData = (updatedNode: FlowNode) => {
    setNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
    setEditingNode(null);
  };

  const save = async () => {
    if (!currentWorkspace) return;
    setSaving(true);
    try {
      const data = { name: botName, trigger, nodes, edges };
      if (id) {
        await flowBotsApi.update(currentWorkspace.id, id, data);
      } else {
        const r = await flowBotsApi.create(currentWorkspace.id, data);
        navigate(`/flow-builder/${r.data.id}`, { replace: true });
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!currentWorkspace || !id) return;
    const r = await flowBotsApi.toggle(currentWorkspace.id, id);
    setActive(r.data.active);
  };

  const addKeyword = () => {
    if (!keywordInput.trim()) return;
    setTrigger(prev => ({ ...prev, keywords: [...prev.keywords, keywordInput.trim()] }));
    setKeywordInput('');
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-sidebar-border bg-content-bg flex-shrink-0">
          <button onClick={() => navigate('/flow-builder')} className="p-1.5 rounded-lg hover:bg-hover-bg text-text-secondary">
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <input
            className="font-semibold text-sm bg-transparent outline-none text-text-primary flex-1"
            value={botName}
            onChange={e => setBotName(e.target.value)}
            placeholder="Flow name..."
          />
          <div className="flex items-center gap-2 ml-auto">
            {id && (
              <button
                onClick={toggleActive}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  active ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                         : 'bg-content-bg text-text-secondary border-sidebar-border'
                }`}
              >
                {active ? <><PlayIcon className="w-3.5 h-3.5" />Active</> : <><PauseIcon className="w-3.5 h-3.5" />Inactive</>}
              </button>
            )}
            <button onClick={save} disabled={saving} className="btn-primary text-xs px-4 py-2">
              {saving ? 'Saving…' : 'Save Flow'}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: node palette + trigger */}
          <div className="w-56 bg-sidebar-bg border-r border-sidebar-border flex flex-col p-3 gap-4 overflow-y-auto flex-shrink-0">
            {/* Trigger config */}
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Trigger</p>
              <select
                className="input w-full text-xs mb-2"
                value={trigger.type}
                onChange={e => setTrigger({ ...trigger, type: e.target.value })}
              >
                {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {trigger.type === 'keyword' && (
                <div>
                  <div className="flex gap-1 mb-1">
                    <input
                      className="input flex-1 text-xs"
                      placeholder="Add keyword..."
                      value={keywordInput}
                      onChange={e => setKeywordInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addKeyword()}
                    />
                    <button onClick={addKeyword} className="btn-primary text-xs px-2 py-1"><PlusIcon className="w-3 h-3" /></button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {trigger.keywords.map((kw, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 text-xs rounded-full px-2 py-0.5 dark:bg-primary-900/30 dark:text-primary-300">
                        {kw}
                        <button onClick={() => setTrigger(prev => ({ ...prev, keywords: prev.keywords.filter((_, j) => j !== i) }))}>
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Node palette */}
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Add Node</p>
              <div className="flex flex-col gap-1">
                {NODE_TYPES.map(({ type, label, icon: Icon, color }) => (
                  <button
                    key={type}
                    onClick={() => addNode(type as FlowNode['type'])}
                    className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-hover-bg text-sm text-left"
                  >
                    <span className={`${color} rounded p-1`}><Icon className="w-3.5 h-3.5 text-white" /></span>
                    <span className="text-xs">{label}</span>
                    <PlusIcon className="w-3 h-3 ml-auto text-text-secondary" />
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="mt-auto text-xs text-text-secondary bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
              💡 Drag nodes to position them. Click a node to edit its content.
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 relative overflow-hidden bg-gray-50 dark:bg-gray-900/50"
            style={{ backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          >
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-text-secondary text-sm">
                Add nodes from the left panel to build your flow
              </div>
            )}
            {nodes.map(node => (
              <NodeCard
                key={node.id}
                node={node}
                selected={selectedNode?.id === node.id}
                onClick={() => {
                  setSelectedNode(node);
                  setEditingNode(node);
                }}
                onDelete={() => deleteNode(node.id)}
                onPositionChange={updateNodePosition}
              />
            ))}

            {/* Node editor panel */}
            {editingNode && (
              <NodeEditor
                node={editingNode}
                onChange={updateNodeData}
                onClose={() => setEditingNode(null)}
              />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

// Flow Bots list page
export function FlowBuilderList() {
  const { currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace) return;
    flowBotsApi.list(currentWorkspace.id).then(r => setBots(r.data)).finally(() => setLoading(false));
  }, [currentWorkspace]);

  const toggle = async (bot: any) => {
    if (!currentWorkspace) return;
    const r = await flowBotsApi.toggle(currentWorkspace.id, bot.id);
    setBots(prev => prev.map(b => b.id === bot.id ? { ...b, active: r.data.active } : b));
  };

  const deleteBot = async (id: string) => {
    if (!currentWorkspace || !confirm('Delete this flow bot?')) return;
    await flowBotsApi.delete(currentWorkspace.id, id);
    setBots(prev => prev.filter(b => b.id !== id));
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sidebar-border">
          <div>
            <h1 className="text-xl font-bold">Flow Builder</h1>
            <p className="text-sm text-text-secondary">Build automated conversation flows</p>
          </div>
          <button onClick={() => navigate('/flow-builder/new')} className="btn-primary flex items-center gap-2">
            <PlusIcon className="w-4 h-4" /> New Flow
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-text-secondary py-12">Loading…</div>
          ) : bots.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <ChatBubbleLeftIcon className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className="font-semibold mb-1">No flows yet</h3>
              <p className="text-sm text-text-secondary mb-4">Create your first automated conversation flow</p>
              <button onClick={() => navigate('/flow-builder/new')} className="btn-primary">Create Flow</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {bots.map(bot => {
                const trig = (() => { try { return JSON.parse(bot.trigger); } catch { return {}; } })();
                return (
                  <div key={bot.id} className="bg-content-bg border border-sidebar-border rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold">{bot.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        bot.active ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                   : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {bot.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {bot.description && <p className="text-xs text-text-secondary mb-3">{bot.description}</p>}
                    <div className="text-xs text-text-secondary mb-4">
                      Trigger: <span className="font-medium">{TRIGGER_TYPES.find(t => t.value === trig.type)?.label || trig.type}</span>
                      {' · '}{bot.runCount} runs
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/flow-builder/${bot.id}`)} className="btn-secondary text-xs flex-1">Edit</button>
                      <button onClick={() => toggle(bot)} className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${bot.active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                        {bot.active ? 'Pause' : 'Activate'}
                      </button>
                      <button onClick={() => deleteBot(bot.id)} className="p-1.5 text-text-secondary hover:text-red-500">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
