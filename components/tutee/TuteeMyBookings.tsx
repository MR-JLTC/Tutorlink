import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import apiClient from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

interface Booking {
  id: number;
  subject: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  student_notes?: string;
  tutor?: {
    user?: {
      name: string;
    };
  };
}

const TuteeMyBookings: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const init = async () => {
      await fetchBookingRequests();
    };
    init();
    // Auto-refresh more frequently and on window focus to reflect approvals quickly
    const interval = setInterval(fetchBookingRequests, 10000);
    const onFocus = () => fetchBookingRequests();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const fetchBookingRequests = async () => {
    try {
      setLoading(true);
      if (!user?.user_id) {
        throw new Error('User not found. Please log in again.');
      }

      const response = await apiClient.get('/users/me/bookings');
      
      // Validate response data
      if (!Array.isArray(response.data)) {
        console.error('Invalid response:', response.data);
        throw new Error('Invalid response format from server');
      }

      // Transform and validate each booking. We intentionally exclude scheduled/upcoming sessions
      // from this view — those are shown in the dedicated "Upcoming Sessions" page.
      const validBookings = response.data
        .filter((booking: any) => (booking.status || '').toLowerCase() !== 'upcoming')
        .map(booking => ({
        id: booking.id || 0,
        subject: booking.subject || 'Untitled Session',
        date: booking.date || new Date().toISOString(),
        time: booking.time || '00:00',
        duration: booking.duration || 1,
        status: booking.status || 'pending',
        student_notes: booking.student_notes || '',
        tutor: {
          user: {
            name: booking.tutor?.user?.name || 'Unknown Tutor'
          }
        }
      }));

      setBookings(validBookings);
      setError(null); // Clear any previous errors
    } catch (err: any) {
      console.error('Failed to fetch bookings:', err);
      const errorMessage = err.response?.data?.message || 
        err.message || 
        'Failed to load your bookings. Please check your connection and try again.';
      setError(errorMessage);
      toast.error(errorMessage);

      // If unauthorized, clear local storage and redirect to login
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/#/login';
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Bell className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-800">My Bookings</h1>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Bell className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-800">My Bookings</h1>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="text-red-500">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer />
      <div className="flex items-center space-x-3">
        <Bell className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-slate-800">My Bookings</h1>
        <button
          onClick={() => {
            toast.info('Refreshing bookings...');
            fetchBookingRequests();
          }}
          className="ml-auto px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="mb-4">
          <p className="text-slate-600">
            View and manage your tutoring session bookings, including upcoming and past sessions.
          </p>
        </div>
        {bookings.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No bookings yet</h3>
            <p className="text-slate-500">
              When you book a session with a tutor, it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-medium text-slate-900">{booking.subject}</h3>
                    <p className="text-sm text-slate-500">
                      with {booking.tutor?.user?.name || 'Unknown Tutor'}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(booking.status)}`}>
                    {booking.status}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Date:</span>{' '}
                    <span className="font-medium">{new Date(booking.date).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Time:</span>{' '}
                    <span className="font-medium">{booking.time}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Duration:</span>{' '}
                    <span className="font-medium">{booking.duration} hour{booking.duration !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                {booking.student_notes && (
                  <div className="mt-4 text-sm">
                    <span className="text-slate-500">Notes:</span>
                    <p className="mt-1 text-slate-700 bg-slate-50 p-2 rounded">
                      {booking.student_notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TuteeMyBookings;