import React, { useEffect, useState } from 'react';
import apiClient from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { CheckCircle, History, Clock, Calendar, User, Upload, FileText, Star, TrendingUp, BookOpen, Info, X } from 'lucide-react';
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

interface Payment {
  payment_id: number;
  booking_request_id?: number;
  student_id?: number;
  tutor_id?: number;
  amount: number;
  sender?: string;
  status?: string;
  student?: {
    student_id?: number;
    user?: {
      user_id?: number;
    };
  };
}

const SessionHistory: React.FC = () => {
  const [sessions, setSessions] = useState<BookingRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
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

  // Helper: Check if a session duration has completed (past its scheduled end time)
  const hasSessionDurationCompleted = (b: BookingRequest): boolean => {
    const start = parseSessionStart(b.date, b.time);
    if (!start) return false;
    
    const durationHours = b.duration || 1.0;
    const endTime = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    
    // Use the 'now' state variable that updates every minute for accurate time checks
    return now.getTime() > endTime.getTime();
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

      // Fetch booking requests and all payments (to filter for admin payments)
      const [res, allPaymentsRes] = await Promise.all([
        apiClient.get(`/tutors/${fetchedTutorId}/booking-requests`),
        apiClient.get('/payments').catch(() => ({ data: [] }))
      ]);
      
      // Filter payments for this tutor with sender='admin'
      const tutorPayments = (allPaymentsRes.data || []).filter((p: any) => 
        p.tutor_id === fetchedTutorId && p.sender === 'admin'
      );
      setPayments(tutorPayments);
      
      let allBookings = [];
      if (Array.isArray(res.data)) {
        allBookings = res.data;
      } else if (Array.isArray(res.data?.data)) {
        allBookings = res.data.data;
      } else if (res.data?.bookings && Array.isArray(res.data.bookings)) {
        allBookings = res.data.bookings;
      }
      
      const sessionsWithRatings = allBookings.map((b: any) => {
        // Prefer rating info baked into the booking payload to avoid hitting legacy endpoints
        const ratingSources = [
          { value: b.rating, comment: b.rating_comment ?? b.comment ?? b.tutee_comment },
          { value: b.tutee_rating, comment: b.tutee_comment ?? b.comment },
          { value: b.feedback?.rating, comment: b.feedback?.comment },
          { value: b.review?.rating, comment: b.review?.comment }
        ];

        let rating: number | null = null;
        let ratingComment: string | null = null;
        for (const source of ratingSources) {
          const rawValue = source.value;
          const parsedValue =
            typeof rawValue === 'number'
              ? rawValue
              : typeof rawValue === 'string'
              ? Number(rawValue)
              : null;

          if (parsedValue !== null && !Number.isNaN(parsedValue)) {
            rating = parsedValue;
            ratingComment = source.comment ?? null;
            break;
          }
        }

        return {
          ...b,
          rating,
          rating_comment: ratingComment,
          session_rate_per_hour: b.session_rate_per_hour || b.tutor?.session_rate_per_hour || null
        };
      });
      
      const historySessions = sessionsWithRatings.filter((b: BookingRequest) => {
        // Show sessions with status "upcoming" (for marking as done)
        // Also show "awaiting_confirmation" sessions (after tutor has marked as done with proof, waiting for tutee confirmation)
        // Also show "completed" sessions (after tutee has confirmed and left feedback)
        // Also show "admin_payment_pending" sessions (after tutee feedback, waiting for admin payment)
        return b.status === 'upcoming' || b.status === 'awaiting_confirmation' || b.status === 'completed' || b.status === 'admin_payment_pending';
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

  // Calculate payment received from payments table (sender='admin', matched by booking_request_id and student_id)
  const calculatePaymentReceived = (session: BookingRequest): number => {
    // Find payment with sender='admin', matching booking_request_id
    // Match by booking_request_id and student (via user_id from student.user or direct student_id)
    const sessionStudentUserId = session.student?.user_id;
    
    const payment = payments.find(p => {
      // Must have sender='admin' and matching booking_request_id
      if (p.sender !== 'admin' || p.booking_request_id !== session.id) {
        return false;
      }
      
      // Match by student.user.user_id if available (payment includes student relation)
      const paymentStudentUserId = (p as any).student?.user?.user_id;
      if (paymentStudentUserId && sessionStudentUserId && paymentStudentUserId === sessionStudentUserId) {
        return true;
      }
      
      // If payment doesn't have student relation loaded, we can't match by student_id
      // So we'll match only by booking_request_id and sender (assuming one payment per booking)
      // This is a fallback - ideally payments should include student relations
      return true;
    });
    
    if (payment && payment.amount) {
      // Deduct 13% platform fee from the payment amount
      return Number(payment.amount) * 0.87;
    }
    
    // Return 0 if no payment found (don't fallback to calculated amount)
    return 0;
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

  // Get upcoming sessions for the table (only show "upcoming" status sessions)
  const upcomingSessionsWithData = sessions.filter(s => 
    s.status === 'upcoming'
  );

  const totalUpcomingHours = upcomingSessionsWithData.reduce((sum, s) => {
    const duration = Number(s.duration ?? 0);
    return sum + (Number.isNaN(duration) ? 0 : duration);
  }, 0);

  const totalUpcomingEarnings = upcomingSessionsWithData.reduce((sum, s) => {
    // Calculate expected earnings for upcoming sessions (after 13% service fee deduction)
    const ratePerHour = s.session_rate_per_hour || sessionRate || 0;
    const duration = Number(s.duration ?? 0);
    const grossEarnings = ratePerHour * duration;
    const expectedEarnings = grossEarnings * 0.87; // Deduct 13% service fee
    return sum + (Number.isNaN(expectedEarnings) ? 0 : expectedEarnings);
  }, 0);

  // Helper: Check if a session is eligible for "Mark as done" button
  const isSessionEligibleForMarkAsDone = (r: BookingRequest) => {
    // Only show button for 'upcoming' status sessions (explicitly exclude declined, cancelled, completed)
    if (r.status !== 'upcoming') return false;

    const start = parseSessionStart(r.date, r.time);
    if (!start) return false;

    const durationHours = r.duration || 1.0;
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

    // Use the 'now' state variable that updates every minute for accurate time checks
    // Show button only if session duration has completed (end time has passed)
    return now >= end;
  };

  const handleMarkDoneSimple = (session: BookingRequest) => {
    // Open the proof upload modal instead of directly marking as done
    setProofTarget(session);
    setProofModalOpen(true);
  };

  const handleMarkDone = async () => {
    if (!proofTarget || !proofFile) {
      toast.error('Please select a proof image to upload.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', proofFile);
      formData.append('status', 'awaiting_confirmation'); // Set status to awaiting_confirmation after proof upload (waiting for tutee to confirm)

      const res = await apiClient.post(
        `/tutors/booking-requests/${proofTarget.id}/complete`, 
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (res.data?.success) {
        toast.success('Session proof uploaded. Waiting for tutee confirmation.');
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
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">No Upcoming Sessions</h3>
          <p className="text-sm sm:text-base text-slate-600">
            Your upcoming sessions will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {sessions.map(session => {
            const isUpcoming = session.status === 'upcoming';
            const isAwaitingConfirmation = session.status === 'awaiting_confirmation';
            const isCompleted = session.status === 'completed';
            const isAdminPaymentPending = session.status === 'admin_payment_pending';
            
            return (
              <Card 
                key={session.id} 
                className="group relative bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border-2 border-slate-200/50 hover:border-primary-300 p-4 sm:p-5 md:p-6 -mx-2 sm:-mx-3 md:mx-0 transition-all duration-300 overflow-hidden hover:shadow-2xl"
              >
                {/* Decorative gradient bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  isCompleted || isAdminPaymentPending
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                  isAwaitingConfirmation
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                  isUpcoming
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500' :
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
                      {isCompleted && (
                        <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 shadow-md text-green-700 bg-green-50 border-2 border-green-400">
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="whitespace-nowrap">Completed</span>
                        </div>
                      )}
                      {isAdminPaymentPending && (
                        <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 shadow-md text-indigo-700 bg-indigo-50 border-2 border-indigo-400">
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="whitespace-nowrap">Payment Pending</span>
                        </div>
                      )}
                      {isAwaitingConfirmation && (
                        <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 shadow-md text-yellow-700 bg-yellow-50 border-2 border-yellow-400">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="whitespace-nowrap">Awaiting Confirmation</span>
                        </div>
                      )}
                      {isUpcoming && !isSessionEligibleForMarkAsDone(session) && (
                        <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 shadow-md text-blue-700 bg-blue-50 border-2 border-blue-400">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                          <span className="whitespace-nowrap">Upcoming</span>
                        </div>
                      )}
                      {isSessionEligibleForMarkAsDone(session) && (
                        <Button
                          onClick={() => handleMarkDoneSimple(session)}
                          disabled={loading}
                          className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 active:from-primary-800 active:to-primary-900 text-white rounded-xl px-4 sm:px-5 py-2 sm:py-2.5 shadow-md hover:shadow-lg transition-all text-xs sm:text-sm md:text-base font-semibold flex items-center justify-center gap-2 w-full sm:w-auto touch-manipulation min-h-[44px]"
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                          <span>Mark as done</span>
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
                  
                  {/* Tutee Rating */}
                  {session.rating && (
                    <div className="p-3 sm:p-4 bg-gradient-to-br from-yellow-50 via-amber-50/50 to-yellow-50 border-2 border-yellow-200 rounded-xl shadow-sm">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="p-2 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-lg flex-shrink-0 mt-0.5">
                          <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 fill-current" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm md:text-base font-semibold text-slate-800 mb-1.5 sm:mb-2 flex items-center gap-2">
                            Student Rating
                          </h4>
                          <div className="flex items-center gap-2 mb-2">
                            {renderStars(session.rating)}
                          </div>
                          {session.rating_comment && (
                            <p className="text-xs sm:text-sm md:text-base text-slate-700 leading-relaxed whitespace-pre-wrap break-words italic">
                              "{session.rating_comment}"
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
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

      {/* Upcoming Sessions Table */}
      {upcomingSessionsWithData.length > 0 && (
        <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white via-primary-50/20 to-white rounded-xl sm:rounded-2xl shadow-xl border-2 border-primary-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-6 pb-4 border-b-2 border-primary-200/50">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-3 sm:p-3.5 bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 rounded-xl shadow-lg ring-2 ring-primary-200/50">
                <TrendingUp className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800">
                  Upcoming Sessions
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  {upcomingSessionsWithData.length} {upcomingSessionsWithData.length === 1 ? 'session' : 'sessions'} scheduled
                </p>
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto -mx-3 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden rounded-xl border-2 border-slate-200/60 shadow-inner">
                <table className="min-w-full divide-y divide-slate-200/60">
                  <thead className="bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700">
                    <tr>
                      <th scope="col" className="px-4 py-3.5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        Subject
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        Student
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Duration
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right text-xs font-bold text-white uppercase tracking-wider">
                        Expected Earnings (After 13% Fee)
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        Student Notes
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200/60">
                    {upcomingSessionsWithData.map((session, index) => {
                      // Calculate expected earnings for upcoming session (after 13% service fee deduction)
                      const ratePerHour = session.session_rate_per_hour || sessionRate || 0;
                      const duration = Number(session.duration ?? 0);
                      const grossEarnings = ratePerHour * duration;
                      const expectedEarnings = grossEarnings * 0.87; // Deduct 13% service fee
                      
                      return (
                        <tr
                          key={session.id}
                          className={`hover:bg-gradient-to-r hover:from-primary-50/50 hover:to-slate-50/50 transition-all duration-200 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                          }`}
                        >
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="p-1.5 bg-primary-100 rounded-lg mr-2">
                                <BookOpen className="h-3.5 w-3.5 text-primary-700" />
                              </div>
                              <span className="text-sm font-semibold text-slate-800">
                                {session.subject}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="p-1 bg-primary-100 rounded-full">
                                <User className="h-3.5 w-3.5 text-primary-700" />
                              </div>
                              <span className="text-sm font-medium text-slate-700">
                                {session.student?.name || 'Student'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg">
                              <Clock className="h-3.5 w-3.5 text-primary-600" />
                              <span className="text-sm font-semibold text-slate-700">
                                {session.duration} {session.duration === 1 ? 'hr' : 'hrs'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            <div className="flex flex-col items-end">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-blue-700">
                                  ₱{expectedEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              {ratePerHour > 0 && (
                                <div className="flex flex-col items-end mt-0.5">
                                  <span className="text-[10px] text-slate-500">
                                    (₱{ratePerHour.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/hr)
                                  </span>
                                  <span className="text-[9px] text-amber-600 font-medium mt-0.5">
                                    After 13% service fee
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {session.student_notes ? (
                              <div className="max-w-xs">
                                <p className="text-xs text-slate-700 line-clamp-2 break-words bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                  {session.student_notes}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No notes</span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-primary-600" />
                              <span className="text-xs text-slate-600">
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
                  <tfoot className="bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700">
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-sm font-bold text-white">
                        Total
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-bold text-white bg-white/20 px-3 py-1 rounded-lg">
                          {totalUpcomingHours.toFixed(1)} hrs
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-base font-bold text-white">
                              ₱{totalUpcomingEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <span className="text-[10px] text-white/80 font-medium">
                            After 13% service fee
                          </span>
                        </div>
                      </td>
                      <td colSpan={1} className="px-4 py-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Mobile/Tablet Card View */}
          <div className="lg:hidden space-y-3 sm:space-y-4">
            {upcomingSessionsWithData.map((session, index) => {
              // Calculate expected earnings for upcoming session (after 13% service fee deduction)
              const ratePerHour = session.session_rate_per_hour || sessionRate || 0;
              const duration = Number(session.duration ?? 0);
              const grossEarnings = ratePerHour * duration;
              const expectedEarnings = grossEarnings * 0.87; // Deduct 13% service fee
              
              return (
                <div
                  key={session.id}
                  className="bg-gradient-to-br from-white to-slate-50/50 rounded-xl border-2 border-slate-200/60 shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white/20 rounded-lg">
                          <BookOpen className="h-4 w-4 text-white" />
                        </div>
                        <h3 className="text-sm font-bold text-white truncate">{session.subject}</h3>
                      </div>
                      <div className="px-2 py-1 bg-white/20 rounded-lg">
                        <span className="text-xs font-bold text-white">Upcoming</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    {/* Student & Date Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <User className="h-4 w-4 text-primary-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-500 font-medium">Student</p>
                          <p className="text-xs font-semibold text-slate-800 truncate">{session.student?.name || 'Student'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <Calendar className="h-4 w-4 text-primary-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-500 font-medium">Date</p>
                          <p className="text-xs font-semibold text-slate-800">
                            {new Date(session.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Duration & Expected Earnings Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <Clock className="h-4 w-4 text-primary-600 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-500 font-medium">Duration</p>
                          <p className="text-xs font-semibold text-slate-800">
                            {session.duration} {session.duration === 1 ? 'hr' : 'hrs'}
                          </p>
                        </div>
                      </div>
                      <div className="p-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                        <p className="text-[10px] text-blue-600 font-medium mb-0.5">Expected Earnings</p>
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-bold text-blue-700">
                            ₱{expectedEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        {ratePerHour > 0 && (
                          <div className="mt-0.5">
                            <p className="text-[9px] text-blue-600">
                              (₱{ratePerHour.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/hr)
                            </p>
                            <p className="text-[9px] text-amber-600 font-medium mt-0.5">
                              After 13% service fee
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Student Notes */}
                    {session.student_notes && (
                      <div className="p-3 bg-gradient-to-br from-primary-50/50 to-slate-50 rounded-lg border border-primary-200/50">
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-primary-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-primary-700 font-semibold mb-1 uppercase tracking-wide">Student Notes</p>
                            <p className="text-xs text-slate-700 leading-relaxed break-words">{session.student_notes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Mobile Summary Card */}
            <div className="bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 rounded-xl p-4 shadow-lg border-2 border-primary-400">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white">Total Summary</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/20 rounded-lg p-2.5">
                  <p className="text-[10px] text-white/80 font-medium mb-1">Total Hours</p>
                  <p className="text-base font-bold text-white">{totalUpcomingHours.toFixed(1)} hrs</p>
                </div>
                <div className="bg-white/20 rounded-lg p-2.5">
                  <p className="text-[10px] text-white/80 font-medium mb-1">Expected Earnings</p>
                  <div className="flex flex-col">
                    <p className="text-base font-bold text-white">
                      ₱{totalUpcomingEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[9px] text-white/90 font-medium mt-0.5">
                      After 13% service fee
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info Note */}
          <div className="mt-4 sm:mt-5 p-3 sm:p-4 bg-gradient-to-br from-primary-50 via-amber-50/50 to-primary-50 border-2 border-primary-200/60 rounded-xl shadow-sm">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-primary-100 rounded-lg flex-shrink-0">
                <Info className="h-4 w-4 sm:h-5 sm:w-5 text-primary-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-primary-800 leading-relaxed">
                  <span className="font-bold">Note:</span> Expected earnings are calculated based on your session rate per hour multiplied by the session duration, with a 13% service fee deduction. Actual payment will be processed after session completion.
                </p>
              </div>
            </div>
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
