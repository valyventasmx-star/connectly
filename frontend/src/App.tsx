import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import Login from './pages/Login';
import Register from './pages/Register';
import Inbox from './pages/Inbox';
import Contacts from './pages/Contacts';
import Channels from './pages/Channels';
import Workspaces from './pages/Workspaces';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import Billing from './pages/Billing';
import AISettings from './pages/AISettings';
import Admin from './pages/Admin';
import Legal from './pages/Legal';
import Broadcasts from './pages/Broadcasts';
import Reports from './pages/Reports';
import Dashboard from './pages/Dashboard';
import ContactDetail from './pages/ContactDetail';
import Automation from './pages/Automation';
import Segments from './pages/Segments';
import SegmentContacts from './pages/SegmentContacts';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/inbox" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
        <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
        <Route path="/channels" element={<ProtectedRoute><Channels /></ProtectedRoute>} />
        <Route path="/workspaces" element={<ProtectedRoute><Workspaces /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
        <Route path="/ai-settings" element={<ProtectedRoute><AISettings /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="/broadcasts" element={<ProtectedRoute><Broadcasts /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/contacts/:contactId" element={<ProtectedRoute><ContactDetail /></ProtectedRoute>} />
        <Route path="/automation" element={<ProtectedRoute><Automation /></ProtectedRoute>} />
        <Route path="/segments" element={<ProtectedRoute><Segments /></ProtectedRoute>} />
        <Route path="/segments/:segmentId" element={<ProtectedRoute><SegmentContacts /></ProtectedRoute>} />
        <Route path="/legal" element={<Legal />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
