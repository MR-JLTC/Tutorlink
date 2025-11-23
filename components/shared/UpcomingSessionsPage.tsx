import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { MessageSquare, Clock, CheckCircle, X, AlertCircle } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import RescheduleModal from './RescheduleModal';

interface Student {
  user_id: number;
  name: string;
  email: string;
}

interface BookingRequest {
  id: number;
  student: Student;
  subject: string;
  date: string;
  time: string;
  duration: number;
  status: 'pending' | 'accepted' | 'declined' | 'awaiting_payment' | 'confirmed' | 'completed' | 'cancelled' | 'upcoming';
  payment_proof?: string;
  student_notes?: string;
  created_at: string;
}

const UpcomingSessionsPage: React.FC = () => {
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingRequest | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const parseSessionStart = (dateStr: string, timeStr: string): Date | null => {
    if (!dateStr || !timeStr) return null;
    let sessionDate = new Date(`${dateStr.split('T')[0]}T${timeStr}`);
    if (!isNaN(sessionDate.getTime())) return sessionDate;
    sessionDate = new Date(dateStr);
    if (isNaN(sessionDate.getTime())) return null;
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3];
      if (ampm && ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (ampm && ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
      sessionDate.setHours(hours, minutes, 0, 0);
    }
    return sessionDate;
  };

  const fetchUpcoming = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/users/upcoming-sessions/list');
      const allUpcoming = res.data?.data || [];
      const futureSessions = allUpcoming.filter((b: BookingRequest) => {
        const start = parseSessionStart(b.date, b.time);
        return start && start > now;
      });
      setBookingRequests(futureSessions);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load upcoming sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpcoming();
  }, [now]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'text-green-600 bg-green-50 border-green-200';
      case 'upcoming': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="h-4 w-4" />;
      case 'upcoming': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <ToastContainer />
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-0.5 sm:mb-1 flex items-center gap-2 sm:gap-2.5 md:gap-3">
              <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 flex-shrink-0" />
              <span className="truncate">Upcoming Sessions</span>
            </h1>
            <p className="text-[10px] sm:text-xs md:text-sm lg:text-base text-blue-100/90 leading-tight">Manage and mark your upcoming sessions</p>
          </div>
        </div>
      </div>
      <div className="space-y-3 sm:space-y-4">
        {bookingRequests.length === 0 ? (
          <Card className="p-6 sm:p-8 text-center">
            <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No upcoming sessions</h3>
            <p className="text-sm sm:text-base text-gray-500">You have no upcoming sessions scheduled.</p>
          </Card>
        ) : (
          <>
            {bookingRequests.map(request => (
              <Card key={request.id} className="p-3 sm:p-4 md:p-6 -mx-2 sm:-mx-3 md:mx-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 md:gap-0 mb-2.5 sm:mb-3 md:mb-4">
                  <div className="flex-1 min-w-0 w-full sm:w-auto">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 md:gap-3 mb-2">
                      <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800 break-words">{request.student?.name || 'Student'}</h3>
                      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium border flex-shrink-0 ${getStatusColor(request.status)}`}>
                        <div className="flex items-center space-x-0.5 sm:space-x-1">
                          {getStatusIcon(request.status)}
                          <span className="whitespace-nowrap">{request.status.replace('_', ' ').charAt(0).toUpperCase() + request.status.replace('_', ' ').slice(1)}</span>
                        </div>
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4 text-[10px] sm:text-xs md:text-sm text-slate-600 mt-2">
                      <div>
                        <p className="break-words"><strong>Subject:</strong> {request.subject}</p>
                        <p><strong>Date:</strong> {new Date(request.date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p><strong>Time:</strong> {request.time}</p>
                        <p><strong>Duration:</strong> {request.duration} hours</p>
                      </div>
                    </div>
                    {request.student_notes && (
                      <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-slate-50 rounded-lg">
                        <p className="text-[10px] sm:text-xs md:text-sm text-slate-700 break-words">
                          <strong>Student Notes:</strong> {request.student_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 pt-2.5 sm:pt-3 md:pt-4 border-t border-slate-200">
                  <div className="text-[10px] sm:text-xs text-slate-500">
                    Requested on {isNaN(new Date(request.created_at).getTime()) ? 'Unknown date' : new Date(request.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button
                      variant="secondary"
                      onClick={() => { setRescheduleTarget(request); setIsRescheduleModalOpen(true); }}
                      disabled={loading}
                      className="flex items-center justify-center space-x-1 w-full sm:w-auto text-xs sm:text-sm md:text-base py-1.5 sm:py-2"
                    >
                      <Clock className="h-4 w-4" />
                      <span>Reschedule</span>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
      {isRescheduleModalOpen && rescheduleTarget && (
        <RescheduleModal
          open={isRescheduleModalOpen}
          bookingId={rescheduleTarget.id}
          onClose={() => { setIsRescheduleModalOpen(false); setRescheduleTarget(null); }}
          onSuccess={() => {
            setIsRescheduleModalOpen(false);
            setRescheduleTarget(null);
            fetchUpcoming();
          }}
        />
      )}
    </div>
  );
}

export default UpcomingSessionsPage;
