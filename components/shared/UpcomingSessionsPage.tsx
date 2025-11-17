import React, { useEffect, useState } from 'react';
import apiClient from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Calendar } from 'lucide-react';
import Card from '../ui/Card';
import RescheduleModal from './RescheduleModal';

interface Upcoming {
  id: number;
  subject: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  tutor_name?: string;
  student_name?: string;
}

const UpcomingSessionsPage: React.FC = () => {
  const [items, setItems] = useState<Upcoming[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/users/upcoming-sessions/list');
        const data = res.data?.data || [];
        setItems(data);
        setError(null);
      } catch (e: any) {
        setError(e?.response?.data?.message || 'Failed to load upcoming sessions');
      } finally {
        setLoading(false);
      }
    };
    load();
    // No polling to avoid flicker; rely on navigation/focus to refresh
  }, []);

  const { user: authUser } = useAuth();
  const role = authUser?.role;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Calendar className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-800">Upcoming Sessions</h1>
        </div>
        <Card className="p-6">
          <div className="animate-pulse space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded" />)}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 md:gap-0">
          <div className="flex items-center space-x-2 sm:space-x-2.5 md:space-x-3 flex-1 min-w-0">
            <Calendar className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white flex-shrink-0" />
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white truncate">Upcoming Sessions</h1>
          </div>
          <button
            onClick={async () => {
              try {
                setLoading(true);
                const res = await apiClient.get('/users/upcoming-sessions/list');
                setItems(res.data?.data || []);
              } finally {
                setLoading(false);
              }
            }}
            className="w-full sm:w-auto mt-1 sm:mt-0 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 active:bg-blue-100 rounded-lg sm:rounded-xl transition-colors shadow-sm touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <Card className="p-6 sm:p-8 text-center">
          <Calendar className="h-10 w-10 sm:h-12 sm:w-12 text-slate-300 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-1">No Upcoming Sessions</h3>
          <p className="text-sm sm:text-base text-slate-600">Approved and scheduled sessions in the next 30 days will appear here.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id} className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-800 break-words">{item.subject}</h3>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {new Date(item.date).toLocaleDateString()} at {item.time} • {item.duration}h
                  </p>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 break-words">
                    {role === 'tutor'
                      ? item.student_name ? `Student: ${item.student_name}` : ''
                      : item.tutor_name ? `Tutor: ${item.tutor_name}` : item.student_name ? `Student: ${item.student_name}` : ''}
                  </p>
                </div>
                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto">
                  <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                    {item.status.replace('_', ' ')}
                  </span>
                  <div className="ml-auto sm:ml-0">
                    <button
                      onClick={() => { setSelectedBooking(item.id); setModalOpen(true); }}
                      className="px-3 py-1 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded w-full sm:w-auto"
                    >
                      Reschedule
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <RescheduleModal
        open={modalOpen}
        bookingId={selectedBooking ?? 0}
        onClose={() => { setModalOpen(false); setSelectedBooking(null); }}
        onSuccess={async () => {
          // refresh list
          try {
            setLoading(true);
            const res = await apiClient.get('/users/upcoming-sessions/list');
            setItems(res.data?.data || []);
          } finally {
            setLoading(false);
          }
        }}
      />
    </div>
  );
};

export default UpcomingSessionsPage;

