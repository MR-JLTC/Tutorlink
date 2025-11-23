import React, { useEffect, useState } from 'react';
import apiClient from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { CheckCircle, History, Clock, Calendar, User, Upload, FileText } from 'lucide-react';
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
}

const SessionHistory: React.FC = () => {
  const [sessions, setSessions] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofTarget, setProofTarget] = useState<BookingRequest | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);

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
      const tutorId = tutorRes.data?.tutor_id;

      if (!tutorId) {
        setSessions([]);
        return;
      }

      const res = await apiClient.get(`/tutors/${tutorId}/booking-requests`);
      
      let allBookings = [];
      if (Array.isArray(res.data)) {
        allBookings = res.data;
      } else if (Array.isArray(res.data?.data)) {
        allBookings = res.data.data;
      } else if (res.data?.bookings && Array.isArray(res.data.bookings)) {
        allBookings = res.data.bookings;
      }
      
      const historySessions = allBookings.filter((b: BookingRequest) => {
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
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <ToastContainer aria-label="Notification messages" />
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-0.5 sm:mb-1 flex items-center gap-2 sm:gap-2.5 md:gap-3">
              <History className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 flex-shrink-0" />
              <span className="truncate">Session History</span>
            </h1>
            <p className="text-[10px] sm:text-xs md:text-sm lg:text-base text-blue-100/90 leading-tight">
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
        <Card className="p-6 sm:p-8 text-center -mx-2 sm:-mx-3 md:mx-0">
          <History className="h-10 w-10 sm:h-12 sm:w-12 text-slate-400 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-1">No Session History</h3>
          <p className="text-xs sm:text-sm md:text-base text-slate-600">
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
                className="group relative bg-gradient-to-br from-white to-blue-50/30 rounded-xl sm:rounded-2xl shadow-lg border-2 border-slate-200 hover:border-blue-300 p-4 sm:p-5 md:p-6 -mx-2 sm:-mx-3 md:mx-0 transition-all duration-300 overflow-hidden"
              >
                {/* Decorative gradient bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  isCompleted 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                  isAwaitingConfirmation
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                    'bg-gradient-to-r from-blue-500 to-indigo-500'
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
                          <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                          {session.student?.name || 'Student'}
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </Calendar>
                          {new Date(session.date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </Clock>
                          {session.time}
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 text-white rounded-lg sm:rounded-xl px-4 sm:px-5 py-2 sm:py-2.5 shadow-md hover:shadow-lg transition-all text-xs sm:text-sm md:text-base font-semibold flex items-center gap-2 touch-manipulation"
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span>Mark as Done</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Session Details */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 shadow-sm">
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
                    <div className="p-3 sm:p-4 bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-xl border-2 border-slate-200 shadow-sm">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0 mt-0.5">
                          <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
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

      {proofModalOpen && proofTarget && (
        <Modal
          isOpen={true}
          onClose={() => { setProofModalOpen(false); setProofTarget(null); setProofFile(null); }}
          title="Upload Session Proof"
          footer={<>
            <Button 
              onClick={handleMarkDone} 
              disabled={loading || !proofFile}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
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
                className="w-full text-xs sm:text-sm md:text-base file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
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
