import React, { useEffect, useState } from 'react';
import apiClient from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Calendar } from 'lucide-react';
import Card from '../ui/Card';

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
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Calendar className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-slate-800">Upcoming Sessions</h1>
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
          className="ml-auto px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <Card className="p-8 text-center">
          <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No Upcoming Sessions</h3>
          <p className="text-slate-600">Approved and scheduled sessions in the next 30 days will appear here.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{item.subject}</h3>
                  <p className="text-sm text-slate-600">
                    {new Date(item.date).toLocaleDateString()} at {item.time} • {item.duration}h
                  </p>
                  <p className="text-sm text-slate-600 mt-1">
                    {role === 'tutor'
                      ? item.student_name ? `Student: ${item.student_name}` : ''
                      : item.tutor_name ? `Tutor: ${item.tutor_name}` : item.student_name ? `Student: ${item.student_name}` : ''}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  {item.status.replace('_', ' ')}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default UpcomingSessionsPage;

