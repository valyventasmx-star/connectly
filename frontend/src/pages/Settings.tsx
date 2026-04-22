import { useState } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useAuthStore } from '../store/auth';
import { authApi } from '../api/client';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Avatar from '../components/ui/Avatar';

export default function Settings() {
  const { user, updateUser } = useAuthStore();
  const [profile, setProfile] = useState({ name: user?.name || '', avatar: user?.avatar || '' });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [tab, setTab] = useState<'profile' | 'password' | 'notifications'>('profile');

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileMsg('');
    try {
      const { data } = await authApi.updateMe(profile);
      updateUser(data);
      setProfileMsg('✅ Profile updated successfully');
    } catch (err: any) {
      setProfileMsg('❌ ' + (err.response?.data?.error || 'Failed to update profile'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      setPasswordMsg('❌ Passwords do not match');
      return;
    }
    if (passwords.new.length < 6) {
      setPasswordMsg('❌ Password must be at least 6 characters');
      return;
    }
    setSavingPassword(true);
    setPasswordMsg('');
    try {
      await authApi.changePassword(passwords.current, passwords.new);
      setPasswords({ current: '', new: '', confirm: '' });
      setPasswordMsg('✅ Password changed successfully');
    } catch (err: any) {
      setPasswordMsg('❌ ' + (err.response?.data?.error || 'Failed to change password'));
    } finally {
      setSavingPassword(false);
    }
  };

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'password', label: 'Password' },
    { key: 'notifications', label: 'Notifications' },
  ] as const;

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Manage your account preferences</p>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="w-56 border-r border-gray-100 bg-white p-4 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${tab === key ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8">
            {tab === 'profile' && (
              <div className="max-w-lg">
                <h2 className="text-base font-semibold text-gray-900 mb-6">Profile Information</h2>
                <div className="flex items-center gap-4 mb-6">
                  {user && <Avatar name={user.name} src={user.avatar} size="xl" />}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <Input
                    label="Full name"
                    value={profile.name}
                    onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  />
                  <Input
                    label="Avatar URL (optional)"
                    placeholder="https://example.com/avatar.jpg"
                    value={profile.avatar}
                    onChange={(e) => setProfile((p) => ({ ...p, avatar: e.target.value }))}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                    <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 bg-gray-50" value={user?.email || ''} disabled />
                    <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                  </div>
                  {profileMsg && (
                    <p className={`text-sm ${profileMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{profileMsg}</p>
                  )}
                  <Button onClick={handleSaveProfile} loading={savingProfile}>Save Profile</Button>
                </div>
              </div>
            )}

            {tab === 'password' && (
              <div className="max-w-lg">
                <h2 className="text-base font-semibold text-gray-900 mb-6">Change Password</h2>
                <div className="space-y-4">
                  <Input
                    label="Current password"
                    type="password"
                    placeholder="••••••••"
                    value={passwords.current}
                    onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
                  />
                  <Input
                    label="New password"
                    type="password"
                    placeholder="Min. 6 characters"
                    value={passwords.new}
                    onChange={(e) => setPasswords((p) => ({ ...p, new: e.target.value }))}
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    placeholder="Repeat your new password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                  />
                  {passwordMsg && (
                    <p className={`text-sm ${passwordMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{passwordMsg}</p>
                  )}
                  <Button onClick={handleChangePassword} loading={savingPassword}>Change Password</Button>
                </div>
              </div>
            )}

            {tab === 'notifications' && (
              <div className="max-w-lg">
                <h2 className="text-base font-semibold text-gray-900 mb-6">Notification Preferences</h2>
                <div className="space-y-4">
                  {[
                    { label: 'New message notifications', desc: 'Get notified when you receive a new message' },
                    { label: 'Conversation assignments', desc: 'Get notified when a conversation is assigned to you' },
                    { label: 'Browser notifications', desc: 'Show desktop browser notifications' },
                  ].map(({ label, desc }) => (
                    <div key={label} className="flex items-start justify-between p-4 bg-white border border-gray-100 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                      </div>
                      <button className="relative w-10 h-5 bg-primary-500 rounded-full flex-shrink-0 ml-4 mt-0.5">
                        <span className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" />
                      </button>
                    </div>
                  ))}
                  <Button>Save Preferences</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
