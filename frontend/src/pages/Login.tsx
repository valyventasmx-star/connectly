import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { authApi, workspacesApi } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useWorkspaceStore } from '../store/workspace';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const { setWorkspaces, setCurrentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.login(email, password);
      setAuth(data.user, data.token);

      const { data: workspaces } = await workspacesApi.list();
      setWorkspaces(workspaces);
      if (workspaces.length > 0) setCurrentWorkspace(workspaces[0]);

      navigate('/inbox');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left branding panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-900 flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <ChatBubbleLeftRightIcon className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold">Connectly</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Manage all your customer conversations in one place
          </h1>
          <p className="text-primary-200 text-lg">
            Connect WhatsApp, manage multiple clients, and deliver exceptional customer experiences at scale.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-6">
            {[['∞', 'Unlimited contacts'], ['🔗', 'Multi-channel'], ['⚡', 'Real-time']].map(([icon, label]) => (
              <div key={label} className="bg-white/10 rounded-2xl p-4 text-center">
                <div className="text-2xl mb-1">{icon}</div>
                <div className="text-sm text-primary-200">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-primary-300 text-sm">© 2024 Connectly. All rights reserved.</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Connectly</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 mt-1">Sign in to your account to continue</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full justify-center" loading={loading} size="lg">
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">
              Create one free
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
