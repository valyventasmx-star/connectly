import { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import { useWorkspaceStore } from '../store/workspace';
import api from '../api/client';
import {
  ChevronLeftIcon, ChevronRightIcon, PlusIcon,
  XMarkIcon, TrashIcon, CalendarIcon,
} from '@heroicons/react/24/outline';

interface CalEvent {
  id: string;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  allDay: boolean;
  color: string;
}

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

export default function CalendarPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const [today] = useState(new Date());
  const [current, setCurrent] = useState(new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const [form, setForm] = useState({
    title: '', description: '', startAt: '', endAt: '', allDay: false, color: '#6366f1',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const year = current.getFullYear();
  const month = current.getMonth();

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const load = () => {
    if (!currentWorkspace) return;
    const from = new Date(year, month, 1).toISOString();
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    api.get(`/workspaces/${currentWorkspace.id}/calendar?from=${from}&to=${to}`)
      .then(r => setEvents(r.data))
      .catch(console.error);
  };

  useEffect(() => { load(); }, [currentWorkspace?.id, year, month]);

  const eventsForDay = (day: number) => {
    const d = new Date(year, month, day);
    return events.filter(e => isSameDay(new Date(e.startAt), d));
  };

  const openNew = (day?: Date) => {
    const d = day || new Date();
    const dateStr = d.toISOString().slice(0, 16);
    setForm({ title: '', description: '', startAt: dateStr, endAt: '', allDay: false, color: '#6366f1' });
    setEditing(null);
    setShowModal(true);
    setError('');
  };

  const openEdit = (e: CalEvent) => {
    setForm({
      title: e.title,
      description: e.description || '',
      startAt: e.startAt.slice(0, 16),
      endAt: e.endAt ? e.endAt.slice(0, 16) : '',
      allDay: e.allDay,
      color: e.color,
    });
    setEditing(e);
    setShowModal(true);
    setError('');
  };

  const save = async () => {
    if (!currentWorkspace || !form.title || !form.startAt) { setError('Title and start date are required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        startAt: form.startAt,
        endAt: form.endAt || undefined,
        allDay: form.allDay,
        color: form.color,
      };
      if (editing) {
        await api.patch(`/workspaces/${currentWorkspace.id}/calendar/${editing.id}`, payload);
      } else {
        await api.post(`/workspaces/${currentWorkspace.id}/calendar`, payload);
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteEvent = async (id: string) => {
    if (!currentWorkspace || !confirm('Delete this event?')) return;
    await api.delete(`/workspaces/${currentWorkspace.id}/calendar/${id}`);
    setShowModal(false);
    load();
  };

  // Export to .ics
  const exportIcs = () => {
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Connectly//Calendar//EN',
      ...events.map(e => [
        'BEGIN:VEVENT',
        `UID:${e.id}@connectly`,
        `SUMMARY:${e.title}`,
        `DTSTART:${new Date(e.startAt).toISOString().replace(/[-:]/g,'').split('.')[0]}Z`,
        e.endAt ? `DTEND:${new Date(e.endAt).toISOString().replace(/[-:]/g,'').split('.')[0]}Z` : '',
        e.description ? `DESCRIPTION:${e.description}` : '',
        'END:VEVENT',
      ].filter(Boolean).join('\r\n')),
      'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'connectly-calendar.ics'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Calendar</h1>
            <p className="text-sm text-gray-500">Schedule events and follow-ups for your workspace</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportIcs} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              Export .ics
            </button>
            <button onClick={() => openNew()} className="flex items-center gap-1.5 bg-primary-600 text-white px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-primary-700">
              <PlusIcon className="w-4 h-4" /> New Event
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-base font-semibold text-gray-900">{MONTHS[month]} {year}</h2>
            <button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ChevronRightIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Grid */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAYS.map(d => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400">{d}</div>
              ))}
            </div>
            {/* Cells */}
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                const isToday = day !== null && isSameDay(new Date(year, month, day!), today);
                const dayEvents = day ? eventsForDay(day) : [];
                return (
                  <div
                    key={idx}
                    onClick={() => day && openNew(new Date(year, month, day))}
                    className={`min-h-[80px] p-1.5 border-b border-r border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${
                      !day ? 'bg-gray-50/50' : ''
                    }`}
                  >
                    {day && (
                      <>
                        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full mb-1 ${
                          isToday ? 'bg-primary-600 text-white' : 'text-gray-700'
                        }`}>{day}</span>
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 3).map(e => (
                            <div
                              key={e.id}
                              onClick={ev => { ev.stopPropagation(); openEdit(e); }}
                              className="text-[10px] px-1.5 py-0.5 rounded font-medium truncate cursor-pointer hover:opacity-80"
                              style={{ backgroundColor: e.color + '25', color: e.color }}
                            >{e.title}</div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 3} more</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming events list */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">This month's events ({events.length})</h3>
            {events.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No events this month — click any day to add one
              </div>
            ) : (
              <div className="space-y-2">
                {events.map(e => (
                  <div key={e.id} onClick={() => openEdit(e)}
                    className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl cursor-pointer hover:border-gray-200 transition-colors">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
                      {e.description && <p className="text-xs text-gray-500 truncate">{e.description}</p>}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(e.startAt).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">{editing ? 'Edit Event' : 'New Event'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Event title" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  rows={2} placeholder="Optional notes" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start *</label>
                  <input type="datetime-local" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={form.startAt} onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End</label>
                  <input type="datetime-local" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={form.endAt} onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Color</label>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex items-center justify-between pt-2">
                {editing ? (
                  <button onClick={() => deleteEvent(editing.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                    <TrashIcon className="w-3.5 h-3.5" /> Delete
                  </button>
                ) : <div />}
                <div className="flex gap-2">
                  <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
                  <button onClick={save} disabled={saving}
                    className="px-4 py-2 text-sm bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50">
                    {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
