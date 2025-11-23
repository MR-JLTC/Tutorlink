import React, { useState, useEffect } from 'react';
import apiClient, { getFileUrl } from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../ui/Modal';
import { DollarSign, TrendingUp, Clock, CheckCircle, Star, Calendar, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../ui/Toast';

interface Session {
  id: number;
  student_name: string;
  subject: string;
  date: string;
  duration: number;
  hourly_rate: number;
  total_amount: number;
  status: 'completed' | 'pending' | 'cancelled';
  payment_status: 'pending' | 'approved' | 'paid';
  created_at: string;
}

interface Payment {
  id: number;
  payment_id: number;
  session_id?: number;
  amount: number;
  subject?: string | null;
  status: 'pending' | 'admin_confirmed' | 'confirmed' | 'rejected' | 'refunded';
  payment_date?: string;
  created_at: string;
  student_name?: string;
  student_id?: number;
  tutor_id?: number;
  dispute_status?: string;
  dispute_proof_url?: string;
  admin_note?: string;
  admin_payment_proof_url?: string;
}

interface EarningsStats {
  total_earnings: number;
  pending_earnings: number;
  completed_sessions: number;
  average_rating: number;
  total_hours: number;
}

const EarningsHistory: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<EarningsStats>({
    total_earnings: 0,
    pending_earnings: 0,
    completed_sessions: 0,
    average_rating: 0,
    total_hours: 0
  });
  const [loading, setLoading] = useState(false);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);
  const [proofModalTitle, setProofModalTitle] = useState<string>('');
  const [viewedProofByPayment, setViewedProofByPayment] = useState<Record<number, boolean>>({});
  const [hiddenConfirm, setHiddenConfirm] = useState<Record<number, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [paymentsFilter, setPaymentsFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (user?.user_id) {
      // Fetch the actual tutor_id instead of using user_id
      const fetchTutorId = async () => {
        try {
          const response = await apiClient.get(`/tutors/by-user/${user.user_id}/tutor-id`);
          const actualTutorId = response.data.tutor_id;
          if (actualTutorId) {
            setTutorId(actualTutorId);
          } else {
            // Fallback to user_id if the endpoint fails (backend accepts user_id too)
            setTutorId(user.user_id);
          }
        } catch (error: any) {
          console.error('Failed to fetch tutor ID:', error);
          // Fallback to user_id if the endpoint fails (backend accepts user_id too)
          setTutorId(user.user_id);
        }
      };
      fetchTutorId();
    }
  }, [user]);

  useEffect(() => {
    if (tutorId) {
      const init = async () => {
        await fetchEarningsData(true);
        setInitialized(true);
      };
      init();
      // Background refresh every 10s to reflect approvals automatically
      const interval = setInterval(() => {
        fetchEarningsData(false);
      }, 10000);
      // Refresh when the window regains focus
      const onFocus = () => fetchEarningsData(false);
      window.addEventListener('focus', onFocus);
      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', onFocus);
      };
    }
  }, [tutorId]);

  const fetchEarningsData = async (isInitial: boolean = false) => {
    if (!tutorId) return;
    try {
      if (isInitial) setLoading(true);
      const [sessionsRes, paymentsRes, statsRes] = await Promise.all([
        apiClient.get(`/tutors/${tutorId}/sessions`),
        apiClient.get(`/tutors/${tutorId}/payments`),
        apiClient.get(`/tutors/${tutorId}/earnings-stats`)
      ]);
      
      setSessions(sessionsRes.data);
      setPayments(paymentsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch earnings data:', error);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'cancelled': return 'text-red-600 bg-red-50 border-red-200';
      case 'approved': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'confirmed': return 'text-green-600 bg-green-50 border-green-200';
      case 'rejected': return 'text-red-600 bg-red-50 border-red-200';
      case 'refunded': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'paid': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'confirmed': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <X className="h-4 w-4" />;
      case 'refunded': return <DollarSign className="h-4 w-4" />;
      case 'paid': return <DollarSign className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const filteredSessions = sessions.filter(session => {
    if (filter === 'all') return true;
    return session.status === filter;
  });

  const pendingPaymentsCount = payments.filter(p => p.status === 'pending').length;
  const approvedPaymentsCount = payments.filter(p => p.status === 'confirmed').length;
  const filteredPayments = payments.filter(p => {
    if (paymentsFilter === 'all') return true;
    if (paymentsFilter === 'approved') return p.status === 'confirmed';
    return p.status === paymentsFilter;
  });

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading earnings data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-0.5 sm:mb-1 flex items-center gap-2 sm:gap-2.5 md:gap-3">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 flex-shrink-0" />
              <span className="truncate">Earnings & History</span>
            </h1>
            <p className="text-[10px] sm:text-xs md:text-sm lg:text-base text-blue-100/90 leading-tight">Track your completed sessions and earnings</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4 lg:gap-6">
        <Card className="p-3 sm:p-4 md:p-6 shadow -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 md:p-3 bg-green-100 rounded-full mr-2 sm:mr-3 md:mr-4 flex-shrink-0">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-green-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-500">Total Earnings</p>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 truncate">
                ₱{stats.total_earnings.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Bottom action row: View all payments */}
          <div className="mt-2 sm:mt-3 flex justify-end">
            <Button variant="secondary" onClick={() => navigate('/tutor-dashboard/earnings/payments')} className="text-[10px] sm:text-xs md:text-sm py-1 sm:py-1.5">
              View all
            </Button>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 md:p-6 shadow -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 md:p-2 bg-yellow-100 rounded-full mr-2 sm:mr-3 md:mr-4 flex-shrink-0">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-yellow-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-500">Pending Earnings</p>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 truncate">
                ₱{stats.pending_earnings.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 md:p-6 shadow -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 md:p-2 bg-blue-100 rounded-full mr-2 sm:mr-3 md:mr-4 flex-shrink-0">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-500">Completed Sessions</p>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">{stats.completed_sessions}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 md:p-6 shadow -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 md:p-2 bg-purple-100 rounded-full mr-2 sm:mr-3 md:mr-4 flex-shrink-0">
              <Star className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-purple-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-500">Average Rating</p>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">
                {stats.average_rating > 0 ? stats.average_rating.toFixed(1) : 'N/A'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3 md:gap-4 lg:gap-6">
        <Card className="p-3 sm:p-4 md:p-6 -mx-2 sm:-mx-3 md:mx-0">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold mb-2.5 sm:mb-3 md:mb-4 flex items-center">
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 mr-1.5 sm:mr-2 text-blue-600 flex-shrink-0" />
            <span>Performance Overview</span>
          </h2>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs md:text-sm text-slate-600">Total Hours Tutored</span>
              <span className="text-xs sm:text-sm md:text-base font-semibold text-slate-800">{stats.total_hours} hours</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs md:text-sm text-slate-600">Average Session Duration</span>
              <span className="text-xs sm:text-sm md:text-base font-semibold text-slate-800">
                {stats.completed_sessions > 0 
                  ? (stats.total_hours / stats.completed_sessions).toFixed(1) 
                  : '0'
                } hours
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs md:text-sm text-slate-600">Average Hourly Rate</span>
              <span className="text-xs sm:text-sm md:text-base font-semibold text-slate-800">
                ₱{stats.total_hours > 0 
                  ? (stats.total_earnings / stats.total_hours).toFixed(0) 
                  : '0'
                }
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 md:p-6 -mx-2 sm:-mx-3 md:mx-0">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold mb-2.5 sm:mb-3 md:mb-4 flex items-center">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 mr-1.5 sm:mr-2 text-green-600 flex-shrink-0" />
            <span>Payments</span>
          </h2>
          <div className="flex justify-end mb-2 sm:mb-3">
            <Button variant="secondary" onClick={() => navigate('/tutor-dashboard/earnings/payments')} className="text-[10px] sm:text-xs md:text-sm py-1 sm:py-1.5">View all</Button>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-2 sm:mb-3">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-[10px] sm:text-xs md:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">Pending: {pendingPaymentsCount}</span>
              <span className="text-[10px] sm:text-xs md:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Approved: {approvedPaymentsCount}</span>
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {[
                { key: 'all', label: 'All' },
                { key: 'pending', label: 'Pending' },
                { key: 'approved', label: 'Approved' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setPaymentsFilter(tab.key as any)}
                  className={`px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-medium transition-colors touch-manipulation ${
                    paymentsFilter === tab.key
                      ? 'bg-green-100 text-green-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 sm:space-y-3 max-h-80 overflow-auto">
            {filteredPayments.slice(0, 5).map(payment => (
              <div key={payment.id || payment.payment_id} className="flex items-center justify-between p-2 sm:p-3 bg-slate-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 md:gap-3 mb-1">
                    <span className="text-xs sm:text-sm md:text-base font-medium text-slate-800 break-words">
                      {payment.student_name || 'Unknown Student'}
                    </span>
                    <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium border flex-shrink-0 ${getStatusColor(payment.status)}`}>
                      <div className="flex items-center space-x-0.5 sm:space-x-1">
                        {getStatusIcon(payment.status)}
                        <span className="whitespace-nowrap">{payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}</span>
                      </div>
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Payment ID: #{payment.payment_id || payment.id} • {new Date(payment.created_at).toLocaleDateString()}
                    {payment.subject && (
                      <span className="ml-2">• Subject: {payment.subject}</span>
                    )}
                    { (payment.status === 'confirmed' || payment.status === 'admin_confirmed') && payment.admin_note && (
                      <span className="ml-2 text-green-600">✓ Approved by Admin</span>
                    )}

                    {payment.admin_payment_proof_url && (
                      <div className="inline-flex items-center space-x-2 ml-2">
                        <Button
                          variant="secondary"
                          disabled={!payment.admin_payment_proof_url}
                          onClick={() => {
                            // Only allow tutors to view the admin-uploaded proof here.
                            if (!payment.admin_payment_proof_url) return;
                            const srcPath = payment.admin_payment_proof_url as string;
                            const url = getFileUrl(srcPath);
                            setProofModalUrl(url);
                            setProofModalTitle('Admin payment proof');
                            setProofModalOpen(true);
                            // mark as viewed so tutor can confirm after inspecting
                            setViewedProofByPayment(prev => ({ ...prev, [payment.payment_id]: true }));
                          }}
                        >
                          View admin proof
                        </Button>

                        {/* Always show a Confirm button for tutor action, but disable and explain why when necessary */}
                        {(() => {
                          const pid = payment.payment_id || payment.id;
                          if (hiddenConfirm[pid]) return null;
                          return (
                            <Button
                              className="ml-1"
                              onClick={async () => {
                                try {
                                  await apiClient.patch(`/payments/${payment.payment_id}/confirm`);
                                  // show a success toast so the tutor gets immediate feedback
                                  notify('Payment confirmed. Booking updated to Upcoming.', 'success', {
                                    label: 'Hide Confirm',
                                    onClick: () => setHiddenConfirm(prev => ({ ...prev, [pid]: true }))
                                  });
                                  await fetchEarningsData(false);
                                } catch (e) {
                                  console.error('Failed to confirm payment', e);
                                  notify('Failed to confirm payment. Please try again.', 'error');
                                }
                              }}
                              variant="primary"
                              disabled={
                                // disabled if already confirmed or no admin proof or tutor hasn't viewed the admin proof yet
                                payment.status === 'confirmed' ||
                                payment.status === 'rejected' ||
                                payment.status === 'refunded' ||
                                !payment.admin_payment_proof_url ||
                                !viewedProofByPayment[payment.payment_id]
                              }
                              title={
                                payment.status === 'confirmed'
                                  ? 'Already confirmed'
                                  : !payment.admin_payment_proof_url
                                    ? 'Waiting for admin to upload proof'
                                    : !viewedProofByPayment[payment.payment_id]
                                      ? 'Open the admin proof to enable Confirm'
                                      : 'Confirm payment (mark as received)'
                              }
                            >
                              Confirm
                            </Button>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
                <span className="font-semibold text-slate-800 ml-4">
                  ₱{Number(payment.amount).toLocaleString()}
                </span>
              </div>
            ))}
            {filteredPayments.length === 0 && (
              <p className="text-slate-500 text-center py-4">No payments found</p>
            )}
          </div>
        </Card>
      </div>

      {/* Session History
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-semibold">Session History</h2>
          <div className="flex flex-wrap gap-1 w-full sm:w-auto">
            {[
              { key: 'all', label: 'All Sessions' },
              { key: 'completed', label: 'Completed' },
              { key: 'pending', label: 'Pending' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  filter === tab.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions found</h3>
              <p className="text-gray-500">
                {filter === 'all' 
                  ? "You haven't completed any sessions yet."
                  : `No ${filter} sessions found.`
                }
              </p>
            </div>
          ) : (
            filteredSessions.map(session => (
              <div key={session.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-800">
                        {session.student_name}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(session.status)}`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(session.status)}
                          <span>{session.status.charAt(0).toUpperCase() + session.status.slice(1)}</span>
                        </div>
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(session.payment_status)}`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(session.payment_status)}
                          <span>{session.payment_status.charAt(0).toUpperCase() + session.payment_status.slice(1)}</span>
                        </div>
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm text-slate-600">
                      <div>
                        <p><strong>Subject:</strong> {session.subject}</p>
                        <p><strong>Date:</strong> {new Date(session.date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p><strong>Duration:</strong> {session.duration} hours</p>
                        <p><strong>Rate:</strong> ₱{session.hourly_rate}/hour</p>
                      </div>
                      <div>
                        <p><strong>Total Amount:</strong> ₱{session.total_amount.toLocaleString()}</p>
                        <p><strong>Session ID:</strong> #{session.id}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-500">
                    Session created on {new Date(session.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-lg font-semibold text-slate-800">
                    ₱{session.total_amount.toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card> */}
      {proofModalOpen && proofModalUrl && (
        <Modal isOpen={proofModalOpen} onClose={() => setProofModalOpen(false)} title={proofModalTitle}>
          <div className="flex justify-center">
            <img src={proofModalUrl} alt={proofModalTitle} className="max-w-full h-auto rounded" />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EarningsHistory;