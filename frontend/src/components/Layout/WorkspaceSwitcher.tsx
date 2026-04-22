import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useWorkspaceStore } from '../../store/workspace';
import { workspacesApi } from '../../api/client';
import Avatar from '../ui/Avatar';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';

export default function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, setCurrentWorkspace, addWorkspace } = useWorkspaceStore();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const switchWorkspace = (ws: any) => {
    setCurrentWorkspace(ws);
    navigate('/inbox');
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data } = await workspacesApi.create(name);
      addWorkspace(data);
      setCurrentWorkspace(data);
      setShowCreate(false);
      setName('');
      navigate('/inbox');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="w-56 bg-[#12151f] flex flex-col border-r border-[#1e2535]">
        <div className="px-4 py-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Workspaces</p>
          <div className="space-y-1">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => switchWorkspace(ws)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group ${
                  currentWorkspace?.id === ws.id
                    ? 'bg-primary-600/20 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <Avatar name={ws.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ws.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{ws.role || 'member'}</p>
                </div>
                {currentWorkspace?.id === ws.id && (
                  <CheckIcon className="w-4 h-4 text-primary-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 mt-auto pb-5">
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all text-sm"
          >
            <PlusIcon className="w-4 h-4" />
            Add workspace
          </button>
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Workspace"
        footer={<><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={handleCreate} loading={loading}>Create</Button></>}
      >
        <Input label="Workspace name" placeholder="My Company" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} autoFocus />
      </Modal>
    </>
  );
}
