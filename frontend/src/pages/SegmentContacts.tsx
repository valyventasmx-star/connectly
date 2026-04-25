import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import { segmentsApi } from '../api/client';
import { ArrowLeftIcon, UserGroupIcon } from '@heroicons/react/24/outline';

export default function SegmentContacts() {
  const { segmentId } = useParams<{ segmentId: string }>();
  const { currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<any[]>([]);
  const [segment, setSegment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace || !segmentId) return;
    Promise.all([
      segmentsApi.list(currentWorkspace.id),
      segmentsApi.getContacts(currentWorkspace.id, segmentId),
    ]).then(([segsRes, contactsRes]) => {
      const seg = segsRes.data.find((s: any) => s.id === segmentId);
      setSegment(seg);
      setContacts(contactsRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [currentWorkspace, segmentId]);

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center gap-3">
          <button onClick={() => navigate('/segments')} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          {segment && (
            <>
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: segment.color }} />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{segment.name}</h1>
                {segment.description && <p className="text-sm text-gray-500">{segment.description}</p>}
              </div>
            </>
          )}
          {!loading && <span className="ml-auto text-sm text-gray-500">{contacts.length} contacts</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
                <UserGroupIcon className="w-8 h-8 text-primary-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">No contacts match</h3>
              <p className="text-sm text-gray-500">No contacts currently match this segment's filters.</p>
            </div>
          ) : (
            <div className="max-w-3xl">
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">Phone</th>
                      <th className="px-4 py-3 text-left font-medium">Email</th>
                      <th className="px-4 py-3 text-left font-medium">Company</th>
                      <th className="px-4 py-3 text-left font-medium">Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {contacts.map((c: any) => (
                      <tr key={c.id} className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/contacts/${c.id}`)}>
                        <td className="px-4 py-3 font-medium text-gray-900">{c.name || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{c.email || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{c.company || '—'}</td>
                        <td className="px-4 py-3">
                          {c.lifecycleStage ? (
                            <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full capitalize">
                              {c.lifecycleStage.replace(/_/g, ' ')}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
