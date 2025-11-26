import React, { useEffect, useState } from 'react';
import apiClient from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { CheckCircle, History, Clock, Calendar, User, Upload, FileText, Star, DollarSign, TrendingUp } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
  status: string;
  created_at: string;
  student_notes?: string;
  rating?: number;
  rating_comment?: string;
  session_rate_per_hour?: number;
}

const SessionHistory: React.FC = () => {
  const [sessions, setSessions] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofTarget, setProofTarget] = useState<BookingRequest | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [sessionRate, setSessionRate] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Rerender every minute
    return () => clearInterval(timer);
  }, []);

  const parseSessionStart = (dateStr: string, timeStr: string): Date | null => {
    if (!dateStr || !timeStr) {
      return null;
    }
    let sessionDate = new Date(`${dateStr.split('T')[0]}T${timeStr}`);
    if (!isNaN(sessionDate.getTime())) {
      return sessionDate;
    }
    sessionDate = new Date(dateStr);
    if (isNaN(sessionDate.getTime())) {
      return null;
    }
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3];
      if (ampm && ampm.toLowerCase() === 'pm' && hours < 12) {
        hours += 12;
      }
      if (ampm && ampm.toLowerCase() === 'am' && hours === 12) {
        hours = 0;
      }
      sessionDate.setHours(hours, minutes, 0, 0);
      return sessionDate;
    }
    return null;
  };

  const fetchHistory = async () => {
    if (!user?.user_id) {
      setSessions([]);
      return;
    }
    setLoading(true);
    try {
      const tutorRes = await apiClient.get(`/tutors/by-user/${user.user_id}/tutor-id`);
      const fetchedTutorId = tutorRes.data?.tutor_id;

      if (!fetchedTutorId) {
        setSessions([]);
        return;
      }

      setTutorId(fetchedTutorId);

      // Fetch tutor profile to get session rate
      try {
        const profileRes = await apiClient.get(`/tutors/${fetchedTutorId}/profile`);
        setSessionRate(profileRes.data.session_rate_per_hour || null);
      } catch (err) {
        console.warn('Failed to fetch tutor profile for session rate:', err);
      }

      // Fetch booking requests
      const res = await apiClient.get(`/tutors/${fetchedTutorId}/booking-requests`);
      
      let allBookings = [];
      if (Array.isArray(res.data)) {
        allBookings = res.data;
      } else if (Array.isArray(res.data?.data)) {
        allBookings = res.data.data;
      } else if (res.data?.bookings && Array.isArray(res.data.bookings)) {
        allBookings = res.data.bookings;
      }
      
      // Fetch ratings for each booking
      const sessionsWithRatings = await Promise.all(
        allBookings.map(async (b: any) => {
          let rating = null;
          let ratingComment = null;
          
          // Try to get rating from booking data first (check multiple possible field names)
          if (b.rating !== undefined && b.rating !== null) {
            rating = b.rating;
            ratingComment = b.rating_comment || b.comment || b.tutee_comment || null;
          } else if (b.tutee_rating !== undefined && b.tutee_rating !== null) {
            rating = b.tutee_rating;
            ratingComment = b.tutee_comment || b.comment || null;
          } else {
            // Try to fetch rating from API
            try {
              const ratingRes = await apiClient.get(`/bookings/${b.id}/rating`).catch(() => null);
              if (ratingRes?.data?.rating) {
                rating = ratingRes.data.rating;
                ratingComment = ratingRes.data.comment || null;
              }
            } catch (err) {
              // Rating endpoint might not exist, that's okay
            }
          }
          
          return {
            ...b,
            rating: rating,
            rating_comment: ratingComment,
            session_rate_per_hour: b.session_rate_per_hour || b.tutor?.session_rate_per_hour || null
          };
        })
      );
      
      const historySessions = sessionsWithRatings.filter((b: BookingRequest) => {
        // Always show completed or awaiting_confirmation sessions
        if (b.status === 'completed' || b.status === 'awaiting_confirmation') {
          return true;
        }
        
        // For other statuses, check if the session has ended (past its scheduled end time)
        const start = parseSessionStart(b.date, b.time);
        if (!start) {
          // If we can't parse the date/time, only show if status is completed or awaiting_confirmation
          return false;
        }
        
        // Check if session is scheduled for today (same date as current date)
        const currentDate = new Date();
        const sessionDate = new Date(start);
        const isToday = currentDate.getFullYear() === sessionDate.getFullYear() &&
                       currentDate.getMonth() === sessionDate.getMonth() &&
                       currentDate.getDate() === sessionDate.getDate();
        
        // If session is scheduled for today, show it in history
        if (isToday) {
          return true;
        }
        
        // Otherwise, check if the session has ended (past its scheduled end time)
        const durationHours = b.duration || 1.0;
        const endTime = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
        const currentTime = new Date();
        
        // Show session if it has ended (current time is past the scheduled end time)
        // This includes sessions from any past date, not just today
        return currentTime.getTime() > endTime.getTime();
      });
      setSessions(historySessions);
    } catch (err) {
      console.error("Failed to fetch session history:", err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user, now]);

  // Calculate payment received after 13% deduction
  const calculatePaymentReceived = (session: BookingRequest): number => {
    const rate = session.session_rate_per_hour || sessionRate || 0;
    const duration = session.duration || 0;
    const totalAmount = rate * duration;
    // Deduct 13% platform fee
    return totalAmount * 0.87;
  };

  // Render stars for rating
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-slate-300'
        }`}
      />
    ));
  };

  // Get completed sessions with ratings for the table
  const completedSessionsWithData = sessions.filter(s => 
    s.status === 'completed' || s.status === 'awaiting_confirmation'
  );

  const handleMarkDone = async () => {
    if (!proofTarget || !proofFile) {
      toast.error('Please select a proof image to upload.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', proofFile);
      formData.append('status', 'awaiting_confirmation'); // Explicitly set status in form data

      const res = await apiClient.post(
        `/tutors/booking-requests/${proofTarget.id}/complete`, 
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (res.data?.success) {
        toast.success('Session marked, awaiting tutee confirmation.');
        setProofModalOpen(false);
        setProofTarget(null);
        setProofFile(null);
        await fetchHistory();
      } else {
        throw new Error(res.data?.message || 'Failed to mark session');
      }
    } catch (err: any) {
      console.error('Failed to mark session for confirmation', err);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to mark session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 pb-6 sm:pb-8 md:pb-10">
      <ToastContainer aria-label="Notification messages" />
      
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 text-white shadow-2xl relative overflow-hidden -mx-2 sm:-mx-3 md:mx-0">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-20 -mt-20 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -ml-16 -mb-16 blur-2xl"></div>
        </div>
        <div className="relative flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 drop-shadow-lg flex items-center gap-2 sm:gap-3">
              <History className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 flex-shrink-0" />
              <span className="truncate">Session History</span>
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-white/90 leading-tight">
              View and manage your completed sessions
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="p-6 sm:p-8 -mx-2 sm:-mx-3 md:mx-0">
          <div className="animate-pulse space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 bg-slate-100 rounded-lg" />
            ))}
          </div>
        </Card>
      ) : sessions.length === 0 ? (
        <Card className="p-6 sm:p-8 text-center bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 -mx-2 sm:-mx-3 md:mx-0">
          <div className="p-3 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 flex items-center justify-center">
            <History className="h-10 w-10 sm:h-12 sm:w-12 text-primary-600" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">No Session History</h3>
          <p className="text-sm sm:text-base text-slate-600">
            Your completed sessions will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {sessions.map(session => {
            const isCompleted = session.status === 'completed';
            const isAwaitingConfirmation = session.status === 'awaiting_confirmation';
            
            return (
              <Card 
                key={session.id} 
                className="group relative bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border-2 border-slate-200/50 hover:border-primary-300 p-4 sm:p-5 md:p-6 -mx-2 sm:-mx-3 md:mx-0 transition-all duration-300 overflow-hidden hover:shadow-2xl"
              >
                {/* Decorative gradient bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  isCompleted 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                  isAwaitingConfirmation
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                    'bg-gradient-to-r from-primary-500 to-primary-700'
                }`} />
                
                <div className="flex flex-col gap-4 sm:gap-5">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 mb-2 sm:mb-3 break-words">
                        {session.subject}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                          <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-600" />
                          {session.student?.name || 'Student'}
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </Calendar>
                          {new Date(session.date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </Clock>
                          {session.time}
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </Clock>
                          {session.duration} {session.duration === 1 ? 'hour' : 'hours'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                      {isCompleted ? (
                        <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 shadow-md text-green-700 bg-green-50 border-2 border-green-400">
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                          <span className="whitespace-nowrap">Completed</span>
                        </div>
                      ) : isAwaitingConfirmation ? (
                        <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 shadow-md text-yellow-700 bg-yellow-50 border-2 border-yellow-400">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                          <span className="whitespace-nowrap">Pending Confirmation</span>
                        </div>
                      ) : (
                        <Button
                          onClick={() => { setProofTarget(session); setProofModalOpen(true); }}
                          disabled={loading}
                          className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 active:from-primary-800 active:to-primary-900 text-white rounded-lg sm:rounded-xl px-4 sm:px-5 py-2 sm:py-2.5 shadow-lg hover:shadow-xl transition-all text-xs sm:text-sm md:text-base font-semibold flex items-center gap-2 touch-manipulation"
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span>Mark as Done</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Session Details */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-r from-primary-50 via-primary-100/50 to-primary-50 rounded-xl border-2 border-primary-200/50 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-slate-700">Created:</span>
                      <span className="text-xs sm:text-sm md:text-base font-medium text-slate-900">
                        {new Date(session.created_at).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </span>
                    </div>
                  </div>
                  
                  {/* Student Notes */}
                  {session.student_notes && (
                    <div className="p-3 sm:p-4 bg-gradient-to-br from-slate-50 via-primary-50/50 to-slate-50 rounded-xl border-2 border-slate-200/50 shadow-sm">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="p-2 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg flex-shrink-0 mt-0.5">
                          <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm md:text-base font-semibold text-slate-800 mb-1.5 sm:mb-2 flex items-center gap-2">
                            Student Notes
                          </h4>
                          <p className="text-xs sm:text-sm md:text-base text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                            {session.student_notes}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Ratings and Earnings Table */}
      {completedSessionsWithData.length > 0 && (
        <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center gap-3 mb-4 sm:mb-5">
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Session Ratings & Earnings
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-primary-50 via-primary-100/50 to-primary-50 border-b-2 border-primary-200">
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Subject
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Student
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Rating
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Duration
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Payment Received
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {completedSessionsWithData.map((session, index) => {
                  const paymentReceived = calculatePaymentReceived(session);
                  const rate = session.session_rate_per_hour || sessionRate || 0;
                  const totalBeforeDeduction = rate * (session.duration || 0);
                  
                  return (
                    <tr
                      key={session.id}
                      className={`border-b border-slate-200 hover:bg-primary-50/50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <span className="text-xs sm:text-sm md:text-base font-semibold text-slate-800">
                          {session.subject}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary-600 flex-shrink-0" />
                          <span className="text-xs sm:text-sm md:text-base text-slate-700">
                            {session.student?.name || 'Student'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 text-center">
                        {session.rating ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-0.5">
                              {renderStars(session.rating)}
                            </div>
                            <span className="text-xs sm:text-sm font-semibold text-slate-700">
                              {session.rating.toFixed(1)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs sm:text-sm text-slate-400 italic">
                            No rating
                          </span>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="h-4 w-4 text-primary-600" />
                          <span className="text-xs sm:text-sm md:text-base font-medium text-slate-700">
                            {session.duration} {session.duration === 1 ? 'hr' : 'hrs'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 text-right">
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="text-xs sm:text-sm md:text-base font-bold text-green-700">
                              ₱{paymentReceived.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          {totalBeforeDeduction > 0 && (
                            <span className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
                              (₱{totalBeforeDeduction.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - 13%)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-primary-600 flex-shrink-0" />
                          <span className="text-xs sm:text-sm text-slate-600">
                            {new Date(session.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-r from-primary-50 via-primary-100/50 to-primary-50 border-t-2 border-primary-200">
                  <td colSpan={3} className="px-3 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-bold text-slate-700">
                    Total
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 text-center">
                    <span className="text-xs sm:text-sm md:text-base font-bold text-slate-800">
                      {completedSessionsWithData.reduce((sum, s) => sum + (s.duration || 0), 0).toFixed(1)} hrs
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                      <span className="text-sm sm:text-base md:text-lg font-bold text-green-700">
                        ₱{completedSessionsWithData.reduce((sum, s) => sum + calculatePaymentReceived(s), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-4 p-3 sm:p-4 bg-gradient-to-br from-primary-50 to-primary-100/50 border-2 border-primary-200/50 rounded-xl shadow-sm">
            <p className="text-xs sm:text-sm text-primary-800 flex items-start gap-2">
              <span className="font-bold">Note:</span>
              <span>
                Payment received is calculated as (Session Rate × Duration) minus 13% platform fee. 
                Ratings are provided by students after session completion.
              </span>
            </p>
          </div>
        </Card>
      )}

      {proofModalOpen && proofTarget && (
        <Modal
          isOpen={true}
          onClose={() => { setProofModalOpen(false); setProofTarget(null); setProofFile(null); }}
          title="Upload Session Proof"
          footer={<>
            <Button 
              onClick={handleMarkDone} 
              disabled={loading || !proofFile}
              className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-lg hover:shadow-xl"
            >
              {loading ? 'Uploading...' : 'Confirm'}
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => { setProofModalOpen(false); setProofTarget(null); setProofFile(null); }}
            >
              Cancel
            </Button>
          </>}
        >
          <div className="space-y-4">
            <p className="text-sm sm:text-base text-slate-700">
              Please upload a screenshot or image as proof that the session was conducted.
            </p>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800">
                Select Image
              </label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => setProofFile(e.target.files ? e.target.files[0] : null)}
                className="w-full text-xs sm:text-sm md:text-base file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 transition-colors"
              />
              {proofFile && (
                <div className="flex items-center gap-2 p-2.5 sm:p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-green-700 truncate flex-1">{proofFile.name}</span>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SessionHistory;
