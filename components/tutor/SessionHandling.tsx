import React, { useState, useEffect } from 'react';
import apiClient, { getFileUrl } from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, Clock, CheckCircle, X, Eye, AlertCircle } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import ErrorBoundary from '../ErrorBoundary';

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
  status: 'pending' | 'accepted' | 'declined' | 'awaiting_payment' | 'confirmed' | 'completed' | 'cancelled';
  payment_proof?: string;
  student_notes?: string;
  created_at: string;
}

const SessionHandlingContent: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingTutor, setResolvingTutor] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'awaiting_payment' | 'confirmed'>('all');
  const [isMounted, setIsMounted] = useState(true);
  const [tuteeProfile, setTuteeProfile] = useState<any | null>(null);
  const [tuteeProfileLoading, setTuteeProfileLoading] = useState(false);
  const [isTuteeModalOpen, setIsTuteeModalOpen] = useState(false);
  const [acceptConfirmOpen, setAcceptConfirmOpen] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<BookingRequest | null>(null);

  // Determine if there is any unreviewed payment proof awaiting tutor action
  const hasUnreviewedPaymentProof = bookingRequests.some(
    (r) => r.status === 'awaiting_payment' && !!r.payment_proof
  );

  // Determine if there are unreviewed bookings (pending bookings that need tutor action)
  const hasUnreviewedBookings = bookingRequests.some(
    (r) => r.status === 'pending'
  );

  const resolveTutorIdAndFetch = async () => {
    if (!user?.user_id) {
      setResolveError('User information not found. Please log in again.');
      toast.error('Session missing or expired. Redirecting to login...');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
      return;
    }
    setResolvingTutor(true);
    setResolveError(null);
    try {
      console.log('Attempting to resolve tutor_id for user:', user.user_id);
      // First get the tutor_id
      const tutorRes = await apiClient.get(`/tutors/by-user/${user.user_id}/tutor-id`);
      console.log('Tutor ID response:', tutorRes.data);
      
      if (!tutorRes.data?.tutor_id) {
        throw new Error('⚠️ Access Restricted: Your tutor profile is not yet created. Please complete your tutor application first.');
      }

      // Try to get tutor status by user_id first; if that fails, fall back to tutor_id endpoint
      let statusRes;
      let rawStatus: any = null;
      try {
        statusRes = await apiClient.get(`/tutors/by-user/${user.user_id}/status`);
        rawStatus = statusRes.data?.status;
        console.log('Status (by-user) response:', statusRes.data);
      } catch (e) {
        console.warn('Failed to fetch status by user, will try tutor endpoint. Error:', e);
      }

      // If by-user returned nothing or a non-string, try the tutor endpoint
      if (!rawStatus && tutorRes.data?.tutor_id) {
        try {
          const alt = await apiClient.get(`/tutors/${tutorRes.data.tutor_id}/status`);
          console.log('Status (by-tutor) response:', alt.data);
          rawStatus = rawStatus || alt.data?.status;
          statusRes = statusRes || alt;
        } catch (e) {
          console.warn('Failed to fetch status by tutor id as fallback. Error:', e);
        }
      }

      // Normalize and check status
      const currentStatus = String(rawStatus || '').toLowerCase().trim();
      console.log('Resolved tutor status:', { rawStatus, currentStatus });

      if (currentStatus !== 'approved') {
        const errorMessage = '⚠️ Access Restricted: Your tutor profile is not yet approved. Click on "Application & Verification" in the sidebar menu to check your status and complete any pending requirements.';
        console.error('Access restricted:', { status: rawStatus, message: errorMessage });
        throw new Error(errorMessage);
      }

      console.log('Successfully resolved tutor_id:', tutorRes.data.tutor_id);
      if (isMounted) {
        setTutorId(tutorRes.data.tutor_id);
      }
      await fetchBookingRequests(tutorRes.data.tutor_id);
    } catch (err: any) {
      console.error('Failed to resolve tutor id for user', user.user_id, err);
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message || err?.message;
      
      if (status === 401) {
        toast.error('Session expired. Redirecting to login...');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      // Handle case where tutor profile doesn't exist or isn't approved
      if (status === 404 || (serverMessage && serverMessage.includes('Tutor not found'))) {
        const message = '⚠️ Access Restricted: To manage tutoring sessions, you need to:';
        const details = [
          '1. Complete your tutor profile application',
          '2. Submit required documents',
          '3. Receive admin approval'
        ].join('\n');
        const guidance = 'Go to "Application & Verification" in the sidebar menu to check your status or complete these steps.';
        
        if (isMounted) {
          setResolveError(`${message}\n\n${details}\n\n${guidance}`);
        }
        toast.error(message, {
          autoClose: 7000 // Show longer to ensure readability
        });
        return;
      }

      // Generic error handling for other cases
      const friendly = serverMessage || 'Failed to load tutor information. Please try refreshing the page.';
      if (isMounted) {
        setResolveError(friendly.toString());
      }
      toast.error(friendly.toString());
    } finally {
      if (isMounted) {
        setResolvingTutor(false);
      }
    }
  };

  useEffect(() => {
    setIsMounted(true);
    resolveTutorIdAndFetch();
    return () => {
      setIsMounted(false);
    };
  }, [user]);

  const fetchBookingRequests = async (overrideTutorId?: number) => {
    const idToUse = overrideTutorId || tutorId;
    if (!idToUse) {
      console.warn('No tutor ID available for fetching bookings');
      return;
    }
    try {
      console.log('Fetching booking requests for tutor:', idToUse);
      const response = await apiClient.get(`/tutors/${idToUse}/booking-requests`);
      
      // Log raw response for debugging
      console.log('Raw booking response:', response.data);
      console.log('Response type:', Array.isArray(response.data) ? 'Array' : typeof response.data);
      console.log('Response length:', Array.isArray(response.data) ? response.data.length : 'N/A');

      // Handle different response formats
      let bookings = [];
      if (Array.isArray(response.data)) {
        bookings = response.data;
      } else if (Array.isArray(response.data?.data)) {
        bookings = response.data.data;
      } else if (response.data?.bookings && Array.isArray(response.data.bookings)) {
        bookings = response.data.bookings;
      }

      if (bookings.length === 0 && !Array.isArray(response.data)) {
        console.warn('Unexpected response format:', response.data);
      }
      
      console.log('Processed bookings:', bookings);
      
      // Map backend booking entity shape to the UI-friendly shape expected below
      const mapped = bookings.map(b => ({
        id: b.id,
        student: {
          user_id: b.student?.user_id || b.student?.user?.user_id,
          name: b.student?.user?.name || b.student?.name || 'Student',
          email: b.student?.user?.email || b.student?.email || '',
        },
        subject: b.subject,
        date: b.date,
        time: b.time,
        duration: b.duration,
        status: b.status,
        payment_proof: b.payment_proof ? (b.payment_proof.startsWith('http') ? b.payment_proof : b.payment_proof) : undefined,
        student_notes: b.student_notes,
        created_at: b.created_at,
      })) as BookingRequest[];
      console.log('Mapped booking-requests:', mapped);
      if (isMounted) {
        setBookingRequests(mapped);
      }
    } catch (error: any) {
      console.error('Failed to fetch booking requests:', error);
      toast.error('Failed to load booking requests. Please check your connection and try again.');
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      }
      if (error?.response?.status === 401) {
        toast.error('Session expired. Redirecting to login...');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }
    }
  };

  const handleBookingAction = async (bookingId: number, action: 'accept' | 'decline') => {
    setLoading(true);
    try {
      const response = await apiClient.post(`/tutors/booking-requests/${bookingId}/${action}`);
      
      if (response.data.success) {
        toast.success(`Booking ${action}ed successfully!`);
        await fetchBookingRequests();
      } else {
        throw new Error('Failed to update booking status');
      }
    } catch (error) {
      console.error(`Failed to ${action} booking:`, error);
      toast.error(`Failed to ${action} booking. Please try again.`);
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentAction = async (bookingId: number, action: 'approve' | 'reject') => {
    setLoading(true);
    try {
      const response = await apiClient.post(`/tutors/booking-requests/${bookingId}/payment-${action}`);
      
      if (response.data.success) {
        toast.success(`Payment ${action}d successfully!`);
        await fetchBookingRequests();
      } else {
        throw new Error('Failed to update payment status');
      }
    } catch (error) {
      console.error(`Failed to ${action} payment:`, error);
      toast.error(`Failed to ${action} payment. Please check your connection and try again.`);
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'accepted': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'declined': return 'text-red-600 bg-red-50 border-red-200';
      case 'awaiting_payment': return 'text-orange-600 bg-orange-50 border-orange-200';
  case 'payment_approved': return 'text-blue-700 bg-blue-50 border-blue-200';
  case 'confirmed': return 'text-green-600 bg-green-50 border-green-200';
      case 'completed': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'cancelled': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'accepted': return <CheckCircle className="h-4 w-4" />;
      case 'declined': return <X className="h-4 w-4" />;
      case 'awaiting_payment': return <AlertCircle className="h-4 w-4" />;
  case 'payment_approved': return <CheckCircle className="h-4 w-4" />;
  case 'confirmed': return <CheckCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Sort: 1) awaiting_payment with proof, 2) awaiting_payment without proof, 3) others
  // Tie-breaker: most recent first
  const priorityFor = (r: BookingRequest) => {
    if (r.status === 'awaiting_payment' && r.payment_proof) return 0;
    if (r.status === 'awaiting_payment') return 1;
    return 2;
  };
  const sortedRequests = [...bookingRequests].sort((a, b) => {
    const pa = priorityFor(a);
    const pb = priorityFor(b);
    if (pa !== pb) return pa - pb;
    const aCreated = new Date(a.created_at).getTime();
    const bCreated = new Date(b.created_at).getTime();
    return bCreated - aCreated;
  });

  const filteredRequests = sortedRequests.filter(request => {
    if (filter === 'all') {
      // In "All Requests", show only items needing tutor action (pending)
      return request.status === 'pending';
    }
    return request.status === filter;
  });

  const stats = {
    total: bookingRequests.length,
    pending: bookingRequests.filter(r => r.status === 'pending').length,
    awaiting_payment: bookingRequests.filter(r => r.status === 'awaiting_payment').length,
    confirmed: bookingRequests.filter(r => r.status === 'confirmed').length,
  };

  return (
    <div className="space-y-6">
      <ToastContainer />
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
              <MessageSquare className="h-8 w-8" />
              Session Handling
            </h1>
            <p className="text-blue-100">Manage booking requests and payment confirmations</p>
          </div>
        </div>
      </div>

    

  {/* Stats Cards */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 shadow">
          <div className="flex items-center">
            <div className="p-2.5 bg-blue-100 rounded-lg mr-3">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Requests</p>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 shadow">
          <div className="flex items-center">
            <div className="p-2.5 bg-yellow-100 rounded-lg mr-3">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Pending</p>
              <p className="text-2xl font-bold text-slate-800">{stats.pending}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 shadow">
          <div className="flex items-center">
            <div className="p-2.5 bg-orange-100 rounded-lg mr-3">
              <AlertCircle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Awaiting Payment</p>
              <p className="text-2xl font-bold text-slate-800">{stats.awaiting_payment}</p>
            </div>
          </div>
        </Card>

        {/* Upcoming widget removed from Session Handling — upcoming sessions live in the dedicated Upcoming Sessions sidebar page. */}
      </div>

      {/* Filter Tabs */}
      <Card className="p-4">
        <div className="flex space-x-1">
          {[
            { key: 'all', label: 'All Requests' },
            { key: 'pending', label: 'Pending' },
            { key: 'awaiting_payment', label: 'Awaiting Payment' },
            { key: 'confirmed', label: 'Confirmed' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="inline-flex items-center space-x-2">
                <span>{tab.label}</span>
                {tab.key === 'pending' && hasUnreviewedBookings && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                    {stats.pending}
                  </span>
                )}
                {tab.key === 'awaiting_payment' && hasUnreviewedPaymentProof && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                    New
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Booking Requests */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <Card className="p-8 text-center">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No booking requests</h3>
            <p className="text-gray-500">
              {filter === 'all' 
                ? "You haven't received any booking requests yet."
                : `No ${filter.replace('_', ' ')} requests found.`
              }
            </p>
          </Card>
        ) : (
          filteredRequests.map(request => (
            <Card key={request.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-800">
                          {request.student.name}
                        </h3>
                        <button
                          onClick={async () => {
                            // Open tutee profile modal
                            const sid = request.student.user_id;
                            if (!sid) {
                              toast.error('Student ID not available');
                              return;
                            }
                            setTuteeProfileLoading(true);
                            // Seed the modal with minimal student info so name and avatar
                            // appear immediately while we fetch the full profile.
                            setTuteeProfile({ user_id: sid, name: request.student.name, email: request.student.email, profile_image_url: (request.student as any)?.profile_image_url || (request.student as any)?.profile_image || '' });
                            setIsTuteeModalOpen(true);
                            try {
                              // Try a few endpoints for full profile: /users/:id/profile, then /users/:id
                              let profileData: any = null;
                              try {
                                const pRes = await apiClient.get(`/users/${sid}/profile`);
                                profileData = pRes.data;
                              } catch (e) {
                                try {
                                  const r = await apiClient.get(`/users/${sid}`);
                                  profileData = r.data;
                                } catch (e2) {
                                  console.warn('No detailed profile endpoints available, will use booking student info', e2);
                                  profileData = { user_id: sid, ...request.student };
                                }
                              }

                              // Try to fetch booking history count for the student (best-effort)
                              try {
                                const bRes = await apiClient.get(`/users/${sid}/bookings`);
                                const bookingsArr = Array.isArray(bRes.data) ? bRes.data : (Array.isArray(bRes.data?.data) ? bRes.data.data : (Array.isArray(bRes.data?.bookings) ? bRes.data.bookings : []));
                                profileData._bookingsCount = bookingsArr.length;
                              } catch (e) {
                                // ignore booking fetch errors
                              }

                              setTuteeProfile(profileData || { user_id: sid, ...request.student });
                            } catch (err) {
                              console.warn('Failed to fetch full tutee profile, falling back to minimal data', err);
                              setTuteeProfile({ user_id: sid, ...request.student });
                            } finally {
                              setTuteeProfileLoading(false);
                            }
                          }}
                          className="inline-flex items-center justify-center p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600"
                          title="View tutee profile"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(request.status)}
                        <span>{request.status.replace('_', ' ').charAt(0).toUpperCase() + request.status.replace('_', ' ').slice(1)}</span>
                      </div>
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
                    <div>
                      <p><strong>Subject:</strong> {request.subject}</p>
                      <p><strong>Date:</strong> {new Date(request.date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p><strong>Time:</strong> {request.time}</p>
                      <p><strong>Duration:</strong> {request.duration} hours</p>
                    </div>
                  </div>
                  
                  {request.student_notes && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-700">
                        <strong>Student Notes:</strong> {request.student_notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment proof review moved to admin. Tutors cannot view or approve payment proofs. */}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div className="text-xs text-slate-500">
                  Requested on {new Date(request.created_at).toLocaleDateString()}
                </div>
                
                <div className="flex space-x-2">
                  {request.status === 'pending' && (
                    <>
                      <Button
                        onClick={() => { setAcceptTarget(request); setAcceptConfirmOpen(true); }}
                        disabled={loading}
                        className="flex items-center space-x-1"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Accept</span>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleBookingAction(request.id, 'decline')}
                        disabled={loading}
                        className="flex items-center space-x-1"
                      >
                        <X className="h-4 w-4" />
                        <span>Decline</span>
                      </Button>
                    </>
                  )}
                  
                  {/* No payment confirmation actions in Session Handling */}
      
              {/* Tutee Profile Modal */}
              {isTuteeModalOpen && (
                <Modal
                  isOpen={true}
                  onClose={() => { setIsTuteeModalOpen(false); setTuteeProfile(null); }}
                  title="Tutee Profile"
                  footer={<Button onClick={() => { setIsTuteeModalOpen(false); setTuteeProfile(null); }}>Close</Button>}
                >
                  {tuteeProfileLoading ? (
                    <div className="text-slate-600">Loading profile...</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="h-20 w-20 rounded-full overflow-hidden border">
                          <img src={getFileUrl(tuteeProfile?.profile_image_url || tuteeProfile?.profile_image || '')} alt={tuteeProfile?.name || 'Tutee'} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(tuteeProfile?.name || 'Tutee')}`; }} />
                        </div>
                        <div className="flex-1">
                          <div className="text-xl font-semibold">{tuteeProfile?.name || tuteeProfile?.email}</div>
                          <div className="text-sm text-slate-600">{tuteeProfile?.email}</div>
                          {tuteeProfile?.university_name || tuteeProfile?.university_id ? (
                            <div className="text-sm text-slate-500 mt-1">{tuteeProfile?.university_name || ''}</div>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-sm text-slate-500">Joined: {tuteeProfile?.created_at ? new Date(tuteeProfile.created_at).toLocaleDateString() : '—'}</div>
                          <div className="text-sm text-slate-500">Bookings: {tuteeProfile?._bookingsCount ?? '—'}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          {tuteeProfile?.course_name || tuteeProfile?.course_id ? (
                            <div><strong>Course:</strong> {tuteeProfile?.course_name || ''}</div>
                          ) : null}
                          {tuteeProfile?.year_level ? (
                            <div><strong>Year level:</strong> {tuteeProfile.year_level}</div>
                          ) : null}
                          {tuteeProfile?.phone || tuteeProfile?.contact_number ? (
                            <div><strong>Phone:</strong> {tuteeProfile.phone || tuteeProfile.contact_number} <button onClick={async () => { try { await navigator.clipboard.writeText(tuteeProfile.phone || tuteeProfile.contact_number); toast.success('Phone copied'); } catch { toast.error('Unable to copy'); } }} className="ml-2 text-xs text-blue-600">Copy</button></div>
                          ) : null}
                          {tuteeProfile?.city || tuteeProfile?.country ? (
                            <div><strong>Location:</strong> {[tuteeProfile.city, tuteeProfile.country].filter(Boolean).join(', ')}</div>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          {tuteeProfile?.bio && (
                            <div>
                              <strong>Bio</strong>
                              <p className="text-sm text-slate-700 mt-1">{tuteeProfile.bio}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {tuteeProfile?.email && (
                              <a href={`mailto:${tuteeProfile.email}`} className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm">Send email</a>
                            )}
                            {tuteeProfile?.phone && (
                              <button onClick={async () => { try { await navigator.clipboard.writeText(tuteeProfile.phone); toast.success('Phone copied'); } catch { toast.error('Unable to copy'); } }} className="px-3 py-1 border rounded-md text-sm">Copy phone</button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Modal>
              )}
              {/* Accept Confirmation Modal for tutors */}
              {acceptConfirmOpen && acceptTarget && (
                <Modal
                  isOpen={true}
                  onClose={() => { setAcceptConfirmOpen(false); setAcceptTarget(null); }}
                  title="Confirm Accept Booking"
                  footer={
                    <>
                      <button
                        onClick={async () => {
                          // call the existing handler which updates server and refreshes list
                          await handleBookingAction(acceptTarget.id, 'accept');
                          setAcceptConfirmOpen(false);
                          setAcceptTarget(null);
                        }}
                        disabled={loading}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-md"
                      >
                        {loading ? 'Accepting...' : 'Confirm Accept'}
                      </button>
                      <button
                        onClick={() => { setAcceptConfirmOpen(false); setAcceptTarget(null); }}
                        className="px-4 py-2 border rounded-md hover:bg-gray-100 ml-2"
                      >
                        Cancel
                      </button>
                    </>
                  }
                >
                  <div className="space-y-4">
                    <div className="rounded-lg overflow-hidden shadow-sm">
                      <div className="bg-gradient-to-r from-green-600 to-emerald-500 p-4 text-white flex items-center gap-4">
                        <div className="h-14 w-14 rounded-full overflow-hidden flex-shrink-0 border-2 border-white">
                          <img src={getFileUrl((acceptTarget.student as any)?.profile_image_url || '') || `https://ui-avatars.com/api/?name=${encodeURIComponent(acceptTarget.student.name)}`} alt={acceptTarget.student.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(acceptTarget.student.name)}`; }} />
                        </div>
                        <div>
                          <div className="font-semibold text-lg">Accept booking from {acceptTarget.student.name}</div>
                          <div className="text-sm opacity-90">{acceptTarget.student.email}</div>
                        </div>
                        <div className="ml-auto text-sm inline-flex items-center bg-white/20 px-2 py-1 rounded text-white">
                          {acceptTarget.duration} hr{acceptTarget.duration !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="p-4 bg-white">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="text-sm">
                            <div className="font-medium">Subject</div>
                            <div className="text-slate-700">{acceptTarget.subject}</div>
                          </div>
                          <div className="text-sm">
                            <div className="font-medium">When</div>
                            <div className="text-slate-700">{new Date(acceptTarget.date).toLocaleDateString()} · {acceptTarget.time}</div>
                          </div>
                          <div className="text-sm sm:col-span-2">
                            <div className="font-medium">Notes</div>
                            <div className="text-slate-700">{acceptTarget.student_notes || 'No notes'}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-slate-500">Accepting will notify the student that their booking is approved. You can still cancel later if needed.</div>
                      </div>
                    </div>
                  </div>
                </Modal>
              )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
      {/* Tutor resolution status */}
      {resolvingTutor && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-slate-800">Loading tutor information…</h3>
              <p className="text-sm text-slate-500">Resolving your tutor profile. This may take a moment.</p>
            </div>
            <div className="text-sm text-slate-500">Please wait…</div>
          </div>
        </Card>
      )}

      {resolveError && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-medium text-red-800">Failed to load tutor information</h3>
              <p className="text-sm text-red-700 mt-2">{resolveError}</p>
              <p className="text-sm text-slate-500 mt-2">Possible causes: backend not running, expired session, or missing tutor profile.</p>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <Button onClick={() => resolveTutorIdAndFetch()} className="px-3 py-1">Retry</Button>
              <Button variant="secondary" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); }}>Sign in again</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

const SessionHandling: React.FC = () => {
  return (
    <ErrorBoundary>
      <SessionHandlingContent />
    </ErrorBoundary>
  );
};

export default SessionHandling;