import React, { useEffect, useState } from 'react';
import { Star, Calendar, Clock, User, BookOpen, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import apiClient from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

interface Session {
  id: number;
  subject: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  tutee_rating?: number | null;
  tutee_comment?: string | null;
  student_notes?: string;
  tutor?: {
    user?: {
      name: string;
    };
  };
}

const TuteeAfterSession: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<Session | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [now, setNow] = useState(new Date());
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmTargetSession, setConfirmTargetSession] = useState<Session | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user?.user_id) {
      fetchSessions();
    }
  }, [user, now]);

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

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/users/me/bookings');
      
      if (!Array.isArray(response.data)) {
        throw new Error('Invalid response format from server');
      }

      const afterSessions = response.data
        .filter((booking: any) => {
          const status = (booking.status || '').toLowerCase();
          if (status === 'completed' || status === 'awaiting_confirmation') {
            return true;
          }
          const eligibleOverdueStatuses = ['upcoming', 'confirmed'];
          if (eligibleOverdueStatuses.includes(status)) {
            const start = parseSessionStart(booking.date, booking.time);
            if (!start) return false;
            const end = new Date(start.getTime() + (booking.duration || 0) * 60 * 60 * 1000);
            return now.getTime() > end.getTime();
          }
          return false;
        })
        .map((booking: any) => ({
          id: booking.id || 0,
          subject: booking.subject || 'Untitled Session',
          date: booking.date || new Date().toISOString(),
          time: booking.time || '00:00',
          duration: booking.duration || 1,
          status: (booking.status || '').toLowerCase(),
          tutee_rating: booking.tutee_rating ?? null,
          tutee_comment: booking.tutee_comment ?? null,
          student_notes: booking.student_notes || '',
          tutor: {
            user: {
              name: booking.tutor?.user?.name || 'Unknown Tutor'
            }
          }
        }));

      setSessions(afterSessions);
      setError(null);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load sessions.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSecondaryConfirm = async () => {
    if (!confirmTargetSession) {
      console.log('handleSecondaryConfirm called but no confirmTargetSession');
      return;
    }
    console.log('handleSecondaryConfirm called for session ID:', confirmTargetSession.id);
    try {
      const res = await apiClient.post(`/users/bookings/${confirmTargetSession.id}/confirm-completion`);
      console.log('API response received:', res);
      if (res.data?.success) {
        console.log('API call successful, showing success toast.');
        toast.success('Session confirmed!');
        setConfirmModalOpen(false);
        setConfirmTargetSession(null);
        await fetchSessions();
      } else {
        console.error('API call failed or did not return success:true. Response data:', res.data);
        throw new Error(res.data?.message || 'Failed to confirm session');
      }
    } catch (e: any) {
      console.error('Failed to confirm session', e);
      toast.error(e?.response?.data?.message || e?.message || 'Failed to confirm session');
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackTarget) return;
    try {
      await apiClient.post(`/users/bookings/${feedbackTarget.id}/feedback`, { rating, comment });
      toast.success('Feedback submitted successfully!');
      setFeedbackOpen(false);
      setFeedbackTarget(null);
      setRating(5);
      setComment('');
      await fetchSessions();
    } catch (e: any) {
      console.error('Failed to submit feedback', e);
      toast.error(e?.response?.data?.message || e?.message || 'Failed to submit feedback');
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-5 w-5 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <Star className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-yellow-300 flex-shrink-0" />
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">After Session</h1>
          </div>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 p-4 sm:p-6 -mx-2 sm:-mx-3 md:mx-0">
          <div className="animate-pulse space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <ToastContainer />
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <Star className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-yellow-300 flex-shrink-0" />
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">After Session</h1>
        </div>
        <p className="text-xs sm:text-sm md:text-base text-blue-100 mt-1">
          Leave feedback for your completed sessions.
        </p>
      </div>
      
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 overflow-hidden -mx-2 sm:-mx-3 md:mx-0">
        {error && (
          <div className="p-4 m-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
            <p>{error}</p>
          </div>
        )}
        {sessions.length === 0 && !loading ? (
          <div className="text-center py-12 sm:py-16 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl mb-4 sm:mb-6">
              <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-blue-600" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">No Sessions Found</h3>
            <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto">
              When a session is finished or overdue, it will appear here.
            </p>
          </div>
        ) : (
          <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-800">{session.subject}</h3>
                    <div className="flex items-center text-sm text-slate-500 mt-1">
                      <User className="h-4 w-4 mr-2" />
                      <span>with {session.tutor?.user?.name}</span>
                    </div>
                    <div className="flex items-center text-sm text-slate-500 mt-1">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>{new Date(session.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end justify-between gap-2">
                    {session.status === 'completed' ? (
                      session.tutee_rating ? (
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-600 mb-1">Your Rating</p>
                          {renderStars(session.tutee_rating)}
                        </div>
                      ) : (
                        <Button onClick={() => { setFeedbackTarget(session); setFeedbackOpen(true); }} className="bg-blue-500 text-white hover:bg-blue-600">
                          Leave Feedback
                        </Button>
                      )
                    ) : session.status === 'awaiting_confirmation' ? (
                      <Button onClick={() => { setConfirmTargetSession(session); setConfirmModalOpen(true); }} className="bg-green-500 text-white hover:bg-green-600">
                        Confirm Session
                      </Button>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                        Completed
                      </span>
                    )}
                  </div>
                </div>
                {session.tutee_comment && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-sm font-semibold text-slate-700 mb-1">Your Comment:</p>
                    <p className="text-sm text-slate-600 italic">"{session.tutee_comment}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {feedbackOpen && feedbackTarget && (
        <Modal
          isOpen={true}
          onClose={() => { setFeedbackOpen(false); setFeedbackTarget(null); setRating(5); setComment(''); }}
          title={`Leave Feedback for ${feedbackTarget.subject}`}
          footer={<>
            <Button onClick={handleFeedbackSubmit} disabled={loading}>Submit Feedback</Button>
            <Button variant="secondary" onClick={() => { setFeedbackOpen(false); setFeedbackTarget(null); setRating(5); setComment(''); }}>Cancel</Button>
          </>}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Rating</label>
              <div className="flex justify-center space-x-2">
                {[5, 4, 3, 2, 1].map(r => (
                  <button key={r} onClick={() => setRating(r)} className="focus:outline-none">
                    <Star className={`h-8 w-8 transition-colors ${rating >= r ? 'text-yellow-400' : 'text-slate-300 hover:text-yellow-300'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Comment (optional)</label>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" rows={4} />
            </div>
          </div>
        </Modal>
      )}

      {confirmModalOpen && confirmTargetSession && (
        <Modal
          isOpen={true}
          onClose={() => { setConfirmModalOpen(false); setConfirmTargetSession(null); }}
          title="Confirm Session Completion"
          footer={<>
            <Button onClick={handleSecondaryConfirm} disabled={loading}>Confirm</Button>
            <Button variant="secondary" onClick={() => { setConfirmModalOpen(false); setConfirmTargetSession(null); }}>Cancel</Button>
          </>}
        >
          <p>Are you sure you want to confirm the completion of the session for "{confirmTargetSession.subject}"?</p>
          <p className="text-sm text-gray-600 mt-2">Once confirmed, you will be able to leave feedback for your tutor.</p>
        </Modal>
      )}
    </div>
  );
};

export default TuteeAfterSession;