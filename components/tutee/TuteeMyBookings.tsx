import React, { useEffect, useState } from 'react';
import { Bell, Calendar, Clock, User, BookOpen, RefreshCw, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
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

  const getStatusDisplay = (status: string) => {
    const normalized = status.toLowerCase();
    switch (normalized) {
      case 'pending':
        return {
          color: 'bg-yellow-50 text-yellow-800 border-yellow-300',
          icon: <AlertCircle className="h-4 w-4" />,
          text: 'Pending'
        };
      case 'confirmed':
        return {
          color: 'bg-green-50 text-green-800 border-green-300',
          icon: <CheckCircle2 className="h-4 w-4" />,
          text: 'Confirmed'
        };
      case 'completed':
        return {
          color: 'bg-blue-50 text-blue-800 border-blue-300',
          icon: <CheckCircle2 className="h-4 w-4" />,
          text: 'Completed'
        };
      case 'cancelled':
        return {
          color: 'bg-red-50 text-red-800 border-red-300',
          icon: <XCircle className="h-4 w-4" />,
          text: 'Cancelled'
        };
      default:
        return {
          color: 'bg-slate-50 text-slate-800 border-slate-300',
          icon: <AlertCircle className="h-4 w-4" />,
          text: status
        };
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 flex-shrink-0" />
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">My Bookings</h1>
          </div>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 p-4 sm:p-6 -mx-2 sm:-mx-3 md:mx-0">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 flex-shrink-0" />
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">My Bookings</h1>
          </div>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border-2 border-red-200 p-4 sm:p-6 -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl">
            <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 flex-shrink-0" />
            <p className="text-sm sm:text-base text-red-800 font-medium">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <ToastContainer />
      {/* Modern Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 md:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 flex-shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">My Bookings</h1>
              <p className="text-[10px] sm:text-xs md:text-sm text-blue-100 mt-0.5 sm:mt-1">
                View and manage your tutoring session bookings
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              toast.info('Refreshing bookings...');
              fetchBookingRequests();
            }}
            className="mt-2 sm:mt-0 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 active:text-blue-800 bg-white hover:bg-blue-50 active:bg-blue-100 rounded-lg sm:rounded-xl transition-all shadow-md hover:shadow-lg w-full sm:w-auto touch-manipulation flex items-center justify-center gap-2"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 overflow-hidden -mx-2 sm:-mx-3 md:mx-0">
        {bookings.length === 0 ? (
          <div className="text-center py-12 sm:py-16 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl mb-4 sm:mb-6">
              <Bell className="h-8 w-8 sm:h-10 sm:w-10 text-blue-600" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">No bookings yet</h3>
            <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto">
              When you book a session with a tutor, it will appear here.
            </p>
          </div>
        ) : (
          <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
            {bookings.map((booking) => {
              const statusDisplay = getStatusDisplay(booking.status);
              const bookingDate = new Date(booking.date);
              const isUpcoming = bookingDate >= new Date(new Date().toISOString().split('T')[0]);
              
              return (
                <div
                  key={booking.id}
                  className="group relative bg-gradient-to-br from-white to-blue-50/30 rounded-xl sm:rounded-2xl border-2 border-slate-200 hover:border-blue-300 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
                >
                  {/* Decorative gradient bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${
                    booking.status.toLowerCase() === 'confirmed' || booking.status.toLowerCase() === 'completed'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                    booking.status.toLowerCase() === 'cancelled'
                      ? 'bg-gradient-to-r from-red-500 to-rose-500' :
                    booking.status.toLowerCase() === 'pending'
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                    'bg-gradient-to-r from-blue-500 to-indigo-500'
                  }`} />
                  
                  <div className="p-4 sm:p-5 md:p-6">
                    {/* Header Section */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                          <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
                            <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 mb-1 break-words">
                              {booking.subject}
                            </h3>
                            <div className="flex items-center gap-2 text-sm sm:text-base text-slate-600">
                              <User className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                              <span className="truncate">with {booking.tutor?.user?.name || 'Unknown Tutor'}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Status Badge */}
                        <div className="flex items-center gap-2 sm:gap-3 mb-4">
                          <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 border-2 shadow-md ${statusDisplay.color}`}>
                            {statusDisplay.icon}
                            <span className="whitespace-nowrap">{statusDisplay.text}</span>
                          </div>
                          {isUpcoming && (
                            <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs sm:text-sm font-semibold border border-blue-200">
                              Upcoming
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
                      <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] sm:text-xs text-slate-500 font-medium mb-0.5">Date</p>
                          <p className="text-sm sm:text-base font-semibold text-slate-900">
                            {bookingDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <div className="p-1.5 sm:p-2 bg-indigo-100 rounded-lg flex-shrink-0">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] sm:text-xs text-slate-500 font-medium mb-0.5">Time</p>
                          <p className="text-sm sm:text-base font-semibold text-slate-900">{booking.time}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] sm:text-xs text-slate-500 font-medium mb-0.5">Duration</p>
                          <p className="text-sm sm:text-base font-semibold text-slate-900">
                            {booking.duration} {booking.duration === 1 ? 'hour' : 'hours'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Notes Section */}
                    {booking.student_notes && (
                      <div className="mt-4 p-3 sm:p-4 bg-gradient-to-br from-slate-50 to-blue-50/50 border-2 border-slate-200 rounded-xl">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="p-1.5 bg-indigo-100 rounded-lg flex-shrink-0">
                            <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">Notes</p>
                            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                              {booking.student_notes}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TuteeMyBookings;