import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { authApi, workspacesApi } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useWorkspaceStore } from '../store/workspace';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', workspaceName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const { setWorkspaces, setCurrentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      setError('Please fill in all required fields');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.register(form.name, form.email, form.password, form.workspaceName);
      setAuth(data.user, data.token);
      if (data.workspace) {
        setWorkspaces([{ ...data.workspace, role: 'owner' }]);
        setCurrentWorkspace({ ...data.workspace, role: 'owner' });
      }
      navigate('/inbox');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
            <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">Connectly</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
            <p className="text-gray-500 text-sm mt-1">Start managing your conversations today</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Full name *" type="text" placeholder="John Smith" value={form.name} onChange={set('name')} required autoFocus />
            <Input label="Email address *" type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} required />
            <Input label="Password *" type="password" placeholder="Min. 6 characters" value={form.password} onChange={set('password')} required />
            <Input label="Workspace name (optional)" type="text" placeholder="My Company" value={form.workspaceName} onChange={set('workspaceName')} />
            <Button type="submit" className="w-full justify-center" loading={loading} size="lg">
              Create account
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
