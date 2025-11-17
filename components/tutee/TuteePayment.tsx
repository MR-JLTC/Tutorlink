import React, { useEffect, useState } from 'react';
import { CreditCard, Upload, AlertCircle, CheckCircle2, Ban, History, FileText } from 'lucide-react';
import apiClient, { getFileUrl } from '../../services/api';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from '../ui/Modal';
import { useAuth } from '../../hooks/useAuth';

interface Payment {
  payment_id: number;
  student_id: number;
  tutor_id: number;
  amount: number;
  status: 'pending' | 'admin_confirmed' | 'confirmed' | 'rejected' | 'refunded';
  subject?: string;
  created_at: string;
  rejection_reason?: string;
}

interface BookingRequest {
  id: number;
  subject: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  payment_proof?: string;
  tutor: {
    tutor_id: number;
    session_rate_per_hour?: number;
    gcash_number?: string;
    gcash_qr_url?: string;
    user: {
      name: string;
      email: string;
    };
  };
  amount?: number;
  payment?: Payment; // Payment entity associated with this booking
}

interface PaymentHistory extends Payment {
  tutor?: {
    tutor_id: number;
    user: {
      name: string;
      email: string;
    };
  };
  student?: {
    user: {
      name: string;
      email: string;
    };
  };
  payment_proof?: string;
  admin_proof?: string;
}

const TuteePayment: React.FC = () => {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // per-booking UI state to avoid cross-booking interference
  const [selectedPaymentFiles, setSelectedPaymentFiles] = useState<Record<number, File | undefined>>({});
  const [uploadingPayment, setUploadingPayment] = useState(false);
  const [admins, setAdmins] = useState<Array<{ user_id: number; name: string; qr_code_url: string }>>([]);
  const [selectedAdminByBooking, setSelectedAdminByBooking] = useState<Record<number, number | undefined>>({});
  const [amountByBooking, setAmountByBooking] = useState<Record<number, string>>({});
  const [initialized, setInitialized] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [qrModalTitle, setQrModalTitle] = useState<string | undefined>(undefined);
  const { user } = useAuth();

  useEffect(() => {
    const initial = async () => {
      await fetchBookings(true);
      setInitialized(true);
    };
    initial();
    // Refresh frequently to reflect approvals quickly
    const interval = setInterval(() => {
      if (!uploadingPayment) {
        fetchBookings(false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [uploadingPayment]);

  useEffect(() => {
    const loadAdmins = async () => {
      try {
        const res = await apiClient.get('/users/admins-with-qr');
        setAdmins(res.data?.data || []);
      } catch (e) {
        // ignore
      }
    };
    loadAdmins();
  }, []);

  // Fetch payment history (all payments for the user)
  const fetchPaymentHistory = async () => {
    try {
      const response = await apiClient.get('/payments');
      const allPayments = response.data || [];
      
      // Filter payments for current user (student)
      const userPayments = allPayments.filter((p: PaymentHistory) => {
        if (user?.user_id) {
          return (p as any).student?.user?.user_id === user.user_id ||
                 (p as any).student_id === (user as any).student_id;
        }
        return false;
      });
      
      // Sort by created_at descending (newest first)
      userPayments.sort((a: PaymentHistory, b: PaymentHistory) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      setPaymentHistory(userPayments);
    } catch (err) {
      console.error('Failed to fetch payment history:', err);
      // Don't show error toast for history, just log it
    }
  };

  useEffect(() => {
    if (user?.user_id) {
      fetchPaymentHistory();
    }
  }, [user?.user_id]);

  // Get the effective payment status for a booking (prefer payment.status over booking.status)
  const getEffectivePaymentStatus = (booking: BookingRequest): string => {
    // If there's a payment entity, use its status
    if (booking.payment?.status) {
      return booking.payment.status;
    }
    // Otherwise, use booking status and map it to payment status equivalents
    const bookingStatus = (booking.status || '').toLowerCase();
    const statusMap: Record<string, string> = {
      'awaiting_payment': 'pending',
      'payment_pending': 'pending',
      'payment_rejected': 'rejected',
      'payment_approved': 'confirmed',
      'pending': 'pending'
    };
    return statusMap[bookingStatus] || bookingStatus;
  };

  // Helper function to check if status is rejected (case-insensitive) - checks payment status
  const isRejectedStatus = (booking: BookingRequest): boolean => {
    const effectiveStatus = getEffectivePaymentStatus(booking);
    const normalized = (effectiveStatus || '').toLowerCase();
    return normalized === 'payment_rejected' || normalized === 'rejected';
  };

  // Helper function to check if status allows payment submission (case-insensitive) - checks payment status
  const allowsPaymentSubmission = (booking: BookingRequest): boolean => {
    const effectiveStatus = getEffectivePaymentStatus(booking);
    const normalized = (effectiveStatus || '').toLowerCase();
    return normalized === 'awaiting_payment' || 
           normalized === 'pending' ||
           normalized === 'payment_rejected' ||
           normalized === 'rejected';
  };

  // Auto-fill amounts based on session rates (but not for rejected payments - user needs to re-enter)
  useEffect(() => {
    const updates: Record<number, string> = {};
    bookings.forEach((booking) => {
      const calculatedAmount = calculateAmount(booking);
      const currentAmount = amountByBooking[booking.id];
      const isRejected = isRejectedStatus(booking);
      // Auto-fill only if: amount is calculated, no current amount set, and NOT rejected
      // For rejected payments, don't auto-fill so user can enter the correct amount
      const shouldAutoFill = calculatedAmount > 0 && !currentAmount && !isRejected;
      
      if (shouldAutoFill) {
        updates[booking.id] = calculatedAmount.toFixed(2);
      }
    });
    
    if (Object.keys(updates).length > 0) {
      setAmountByBooking(prev => ({ ...prev, ...updates }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  const fetchBookings = async (isInitial: boolean = false) => {
    try {
      if (isInitial) setLoading(true);
      
      // Fetch both bookings and payments in parallel
      const [bookingsResponse, paymentsResponse] = await Promise.all([
        apiClient.get('/users/me/bookings'),
        apiClient.get('/payments').catch(() => ({ data: [] })) // Don't fail if payments endpoint fails
      ]);
      
      const allBookings = bookingsResponse.data || [];
      const allPayments = paymentsResponse.data || [];
      
      // Filter payments for current user (student)
      // Match payments to user by student_id or student.user.user_id
      const userPayments = allPayments.filter((p: Payment) => {
        if (user?.user_id) {
          return (p as any).student?.user?.user_id === user.user_id ||
                 (p as any).student_id === (user as any).student_id;
        }
        return false;
      });
      setPayments(userPayments);
      
      // Filter bookings that have payment-related statuses OR have associated payments
      const relevantBookings = allBookings
        .map((booking: BookingRequest) => {
          // If backend already provided the payment relation, use it as the source of truth.
          if (booking.payment) {
            return booking;
          }

          // Otherwise, attempt to find the latest matching payment by tutor & subject.
          const matchingPayments = userPayments
            .filter((p: Payment) => {
              return p.tutor_id === booking.tutor?.tutor_id &&
                     (p.subject === booking.subject || !p.subject);
            })
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          return {
            ...booking,
            payment: matchingPayments[0]
          };
        })
        .filter((booking: BookingRequest) => {
          // Include bookings that have:
          // 1. Payment-related booking status, OR
          // 2. An associated payment with status: 'pending', 'admin_confirmed', 'confirmed', 'rejected', 'refunded'
          const bookingStatus = (booking.status || '').toLowerCase();
          const hasPaymentStatus = booking.payment && 
            ['pending', 'admin_confirmed', 'confirmed', 'rejected', 'refunded'].includes(
              (booking.payment.status || '').toLowerCase()
            );
          
          const hasBookingPaymentStatus = 
            bookingStatus === 'awaiting_payment' || 
            bookingStatus === 'payment_pending' ||
            bookingStatus === 'payment_rejected' ||
            bookingStatus === 'pending' ||
            bookingStatus === 'admin_confirmed' ||
            bookingStatus === 'confirmed' ||
            bookingStatus === 'rejected' ||
            bookingStatus === 'refunded' ||
            bookingStatus === 'payment_approved';
          
          return hasBookingPaymentStatus || hasPaymentStatus;
        });
      
      // Log for debugging
      if (relevantBookings.length > 0) {
        console.log('Payment bookings with statuses:', relevantBookings.map(b => ({ 
          id: b.id, 
          bookingStatus: b.status,
          paymentStatus: b.payment?.status 
        })));
      }
      
      setBookings(relevantBookings);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch bookings:', err);
      setError(err.response?.data?.message || 'Failed to load bookings');
      toast.error('Failed to load bookings. Please try again.');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const handlePaymentFileChange = (e: React.ChangeEvent<HTMLInputElement>, bookingId: number) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size should be less than 5MB');
        return;
      }
      setSelectedPaymentFiles(prev => ({ ...prev, [bookingId]: file }));
    }
  };

  const handleUploadPayment = async (bookingId: number) => {
    const file = selectedPaymentFiles[bookingId];
    const adminId = selectedAdminByBooking[bookingId];
    const amt = amountByBooking[bookingId] || '';
    const booking = bookings.find(b => b.id === bookingId);
    const calculatedAmount = booking ? calculateAmount(booking) : 0;
    const amountPaid = Number(amt);

    if (!file) {
      toast.error('Please select a payment proof image first');
      return;
    }
    if (!adminId) {
      toast.error('Please select an admin QR to pay to');
      return;
    }
    if (!amt || isNaN(amountPaid) || amountPaid <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (calculatedAmount > 0 && amountPaid < calculatedAmount) {
      toast.error(`Amount paid (₱${amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) must be at least ₱${calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (amount to pay)`);
      return;
    }

    try {
      setUploadingPayment(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bookingId', String(bookingId));
      formData.append('adminId', String(adminId));
      formData.append('amount', amt);
      
      await apiClient.post(`/payments/submit-proof`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Payment submitted for verification');
      setSelectedPaymentFiles(prev => { const p = { ...prev }; delete p[bookingId]; return p; });
      setSelectedAdminByBooking(prev => { const p = { ...prev }; delete p[bookingId]; return p; });
      setAmountByBooking(prev => { const p = { ...prev }; delete p[bookingId]; return p; });
      // Immediate fetch to reflect 'payment_pending' without flicker
      await fetchBookings(false);
      // Also refresh payment history
      await fetchPaymentHistory();
    } catch (err: any) {
      console.error('Failed to upload payment:', err);
      toast.error(err.response?.data?.message || 'Failed to submit payment');
    } finally {
      setUploadingPayment(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    const normalizedStatus = (status || '').toLowerCase();
    switch (normalizedStatus) {
      case 'pending':
        return {
          icon: <AlertCircle className="h-5 w-5 text-yellow-500" />,
          text: 'Pending Payment',
          color: 'text-yellow-700 bg-yellow-50 border-yellow-200'
        };
      case 'admin_confirmed':
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-indigo-500" />,
          text: 'Admin Confirmed',
          color: 'text-indigo-700 bg-indigo-50 border-indigo-200'
        };
      case 'confirmed':
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          text: 'Payment Confirmed',
          color: 'text-green-700 bg-green-50 border-green-200'
        };
      case 'rejected':
        return {
          icon: <Ban className="h-5 w-5 text-red-500" />,
          text: 'Payment Rejected',
          color: 'text-red-700 bg-red-50 border-red-200'
        };
      case 'refunded':
        return {
          icon: <Ban className="h-5 w-5 text-orange-500" />,
          text: 'Refunded',
          color: 'text-orange-700 bg-orange-50 border-orange-200'
        };
      // Legacy booking status mappings (for backwards compatibility)
      case 'awaiting_payment':
        return {
          icon: <AlertCircle className="h-5 w-5 text-yellow-500" />,
          text: 'Awaiting Payment',
          color: 'text-yellow-700 bg-yellow-50 border-yellow-200'
        };
      case 'payment_pending':
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-blue-500" />,
          text: 'Payment Under Review',
          color: 'text-blue-700 bg-blue-50 border-blue-200'
        };
      case 'payment_rejected':
        return {
          icon: <Ban className="h-5 w-5 text-red-500" />,
          text: 'Payment Rejected',
          color: 'text-red-700 bg-red-50 border-red-200'
        };
      case 'payment_approved':
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          text: 'Payment Approved',
          color: 'text-green-700 bg-green-50 border-green-200'
        };
      default:
        // Log unknown status for debugging
        console.warn('Unknown payment status:', status);
        return {
          icon: <AlertCircle className="h-5 w-5 text-slate-500" />,
          text: status || 'Unknown',
          color: 'text-slate-700 bg-slate-50 border-slate-200'
        };
    }
  };

  // Calculate amount based on session rate and duration
  const calculateAmount = (booking: BookingRequest): number => {
    const sessionRate = booking.tutor?.session_rate_per_hour || 0;
    const duration = booking.duration || 0;
    return sessionRate * duration;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <CreditCard className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-800">Payment</h1>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 bg-slate-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <ToastContainer aria-label="Notifications" />
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 md:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 flex-shrink-0" />
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">Payment</h1>
        </div>
        <button
            onClick={async () => {
              await fetchBookings(true);
              await fetchPaymentHistory();
            }}
            className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 active:text-blue-800 bg-white hover:bg-blue-50 active:bg-blue-100 rounded-lg transition-colors w-full sm:w-auto touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Refresh
        </button>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 text-red-700 -mx-2 sm:-mx-3 md:mx-0">
          <p className="text-xs sm:text-sm">{error}</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 text-center -mx-2 sm:-mx-3 md:mx-0">
          <CreditCard className="h-10 w-10 sm:h-12 sm:w-12 text-slate-400 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-1">No Pending Payments</h3>
          <p className="text-xs sm:text-sm md:text-base text-slate-600">
            When you have bookings that require payment, they will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {bookings.map((booking) => {
            // Use payment status if available, otherwise use booking status
            const effectiveStatus = getEffectivePaymentStatus(booking);
            const status = getStatusDisplay(effectiveStatus);
            const calculatedAmount = calculateAmount(booking);
            const sessionRate = booking.tutor?.session_rate_per_hour || 0;
            
              return (
                <div key={booking.id} className="group relative bg-gradient-to-br from-white to-blue-50/30 rounded-xl sm:rounded-2xl shadow-lg border-2 border-slate-200 hover:border-blue-300 p-4 sm:p-5 md:p-6 -mx-2 sm:-mx-3 md:mx-0 transition-all duration-300 overflow-hidden">
                  {/* Decorative gradient bar based on status */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${
                    effectiveStatus.toLowerCase() === 'confirmed' || effectiveStatus.toLowerCase() === 'admin_confirmed' 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                    isRejectedStatus(booking)
                      ? 'bg-gradient-to-r from-red-500 to-rose-500' :
                    effectiveStatus.toLowerCase() === 'pending'
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                    'bg-gradient-to-r from-blue-500 to-indigo-500'
                  }`} />
                  
                <div className="flex flex-col gap-4 sm:gap-5 mb-4 sm:mb-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 mb-2 sm:mb-3 break-words">
                        {booking.subject} with {booking.tutor.user.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                          <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(booking.date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                          <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {booking.time}
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                          <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {booking.duration} {booking.duration === 1 ? 'hour' : 'hours'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                      <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 shadow-md ${status.color} border-2 ${
                        status.color.includes('yellow') ? 'border-yellow-400' : 
                        status.color.includes('red') ? 'border-red-400' : 
                        status.color.includes('green') ? 'border-green-400' : 
                        status.color.includes('indigo') ? 'border-indigo-400' : 
                        'border-slate-400'
                      }`}>
                        {status.icon}
                        <span className="whitespace-nowrap">{status.text}</span>
                      </div>
                      {booking.payment_proof && !isRejectedStatus(booking) && (
                        <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs md:text-sm font-bold bg-green-50 text-green-700 border-2 border-green-400 shadow-sm flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span>Proof uploaded</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {sessionRate > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-slate-700">Session Rate:</span>
                        <span className="text-base sm:text-lg md:text-xl font-bold text-slate-900">₱{sessionRate.toLocaleString()}/hour</span>
                      </div>
                      {calculatedAmount > 0 && (
                        <>
                          <span className="hidden sm:inline text-blue-300 text-xl">•</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-semibold text-slate-700">Total:</span>
                            <span className="text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">₱{calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Only show payment instructions for statuses that allow payment submission */}
                {allowsPaymentSubmission(booking) && (
                  <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-xl border-2 border-blue-200 p-4 sm:p-5 md:p-6 mb-4 shadow-sm">
                      <h4 className="font-bold text-base sm:text-lg md:text-xl text-slate-800 mb-4 sm:mb-5 flex items-center gap-2">
                        <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                        Payment Instructions
                      </h4>
                      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-5">
                        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
                          <p className="text-xs sm:text-sm md:text-base text-slate-700 font-medium mb-2 sm:mb-3">Choose an admin QR to pay to:</p>

                        {/* If an admin has been selected for this booking, show only that large QR and a Change button. */}
                        {selectedAdminByBooking[booking.id] ? (
                          (() => {
                            const adminId = selectedAdminByBooking[booking.id] as number;
                            const a = admins.find(ad => ad.user_id === adminId);
                            if (!a) return <div className="text-sm text-slate-500">Selected admin not found.</div>;
                            return (
                              <div className="flex flex-col items-center p-3 sm:p-4 md:p-5 bg-white rounded-lg sm:rounded-xl border-2 border-blue-200 shadow-sm">
                                <img src={getFileUrl(a.qr_code_url)} alt={`Selected QR`} className="h-32 w-32 sm:h-40 sm:w-40 md:h-48 md:w-48 object-contain bg-white rounded-lg" />
                                <p className="mt-3 sm:mt-4 text-sm sm:text-base font-semibold text-slate-800">{a.name}</p>
                                <div className="mt-2 sm:mt-3 flex items-center gap-3 sm:gap-4">
                                  <button 
                                    onClick={() => { setQrModalUrl(getFileUrl(a.qr_code_url)); setQrModalTitle(a.name); setQrModalOpen(true); }} 
                                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors touch-manipulation"
                                    style={{ WebkitTapHighlightColor: 'transparent' }}
                                  >
                                    View
                                  </button>
                                  <button 
                                    onClick={() => { setSelectedAdminByBooking(prev => { const p = { ...prev }; delete p[booking.id]; return p; }); }} 
                                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors touch-manipulation"
                                    style={{ WebkitTapHighlightColor: 'transparent' }}
                                  >
                                    Change
                                  </button>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
                            {admins.map((a) => (
                              <button 
                                key={a.user_id} 
                                onClick={() => { setSelectedAdminByBooking(prev => ({ ...prev, [booking.id]: a.user_id })); }} 
                                className={`flex flex-col items-center gap-2 p-2.5 sm:p-3 rounded-lg border-2 transition-all ${
                                  selectedAdminByBooking[booking.id] === a.user_id 
                                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                                } touch-manipulation`}
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                              >
                                <img src={getFileUrl(a.qr_code_url)} alt={`${a.name} QR`} className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 object-contain bg-white border rounded-lg" />
                                <span className="text-[10px] sm:text-xs md:text-sm font-medium truncate w-full text-center text-slate-700">{a.name}</span>
                              </button>
                            ))}
                            {admins.length === 0 && (
                              <div className="col-span-2 md:col-span-3 text-xs sm:text-sm text-slate-500 text-center py-4">
                                No admin QR codes available.
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                        <div className="lg:col-span-1 bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 border border-slate-200 shadow-sm space-y-3 sm:space-y-4">
                        <div>
                          <label className="block text-xs sm:text-sm md:text-base font-semibold text-slate-800 mb-1.5 sm:mb-2">Amount to Pay</label>
                          {calculatedAmount > 0 ? (
                            <div className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border border-blue-200">
                              ₱{calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          ) : (
                            <div className="text-xs sm:text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                              Session rate not set
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <label className="block text-xs sm:text-sm md:text-base font-semibold text-slate-800 mb-1.5 sm:mb-2">Amount Paid</label>
                          <input 
                            type="number" 
                            min={calculatedAmount} 
                            step="0.01" 
                            value={amountByBooking[booking.id] || (calculatedAmount > 0 && !isRejectedStatus(booking) ? calculatedAmount.toFixed(2) : '')} 
                            onChange={(e) => setAmountByBooking(prev => ({ ...prev, [booking.id]: e.target.value }))} 
                            className="w-full border-2 border-slate-300 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" 
                            placeholder="0.00"
                            disabled={calculatedAmount > 0 && !isRejectedStatus(booking)}
                          />
                          {calculatedAmount > 0 && !isRejectedStatus(booking) && (
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-1.5">Amount auto-filled based on session rate</p>
                          )}
                          {isRejectedStatus(booking) && (
                            <p className="text-[10px] sm:text-xs text-amber-600 mt-1.5 font-medium">Please enter the amount you paid</p>
                          )}
                        </div>

                        {/* Upload section - always show for statuses that allow payment submission */}
                        <div className="space-y-2 sm:space-y-3">
                          <label className="block text-xs sm:text-sm md:text-base font-semibold text-slate-800">Upload Payment Proof</label>
                          <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePaymentFileChange(e, booking.id)}
                              className="w-full text-xs sm:text-sm md:text-base file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
                              id={`file-input-${booking.id}`}
                        />
                          </div>
                        {selectedPaymentFiles[booking.id] && (
                            <div className="flex items-center gap-2 p-2 sm:p-2.5 bg-green-50 border border-green-200 rounded-lg">
                              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                              <span className="text-[10px] sm:text-xs md:text-sm text-green-700 truncate flex-1">{selectedPaymentFiles[booking.id]?.name}</span>
                              <button
                                onClick={() => setSelectedPaymentFiles(prev => { const p = { ...prev }; delete p[booking.id]; return p; })}
                                className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium flex-shrink-0"
                                aria-label="Remove file"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                          
                          {/* Amount validation helper */}
                          {amountByBooking[booking.id] && calculatedAmount > 0 && (() => {
                            const amountPaid = Number(amountByBooking[booking.id]);
                            const isValidAmount = !isNaN(amountPaid) && amountPaid >= calculatedAmount;
                            if (!isValidAmount) {
                              return (
                                <div className="p-2 sm:p-2.5 bg-amber-50 border border-amber-300 rounded-lg">
                                  <p className="text-[10px] sm:text-xs text-amber-800 font-medium">
                                    ⚠️ Amount paid (₱{amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) must be at least ₱{calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (amount to pay)
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          })()}

                        <button
                          onClick={() => handleUploadPayment(booking.id)}
                            disabled={(() => {
                              const amountPaid = amountByBooking[booking.id] ? Number(amountByBooking[booking.id]) : 0;
                              const hasValidAmount = calculatedAmount > 0 
                                ? (!isNaN(amountPaid) && amountPaid >= calculatedAmount)
                                : (!isNaN(amountPaid) && amountPaid > 0);
                              
                              return !selectedPaymentFiles[booking.id] || 
                                     uploadingPayment || 
                                     !selectedAdminByBooking[booking.id] || 
                                     !amountByBooking[booking.id] || 
                                     !hasValidAmount;
                            })()}
                            className="w-full flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg sm:rounded-xl hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg disabled:shadow-none text-sm sm:text-base font-semibold touch-manipulation"
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                          >
                            {uploadingPayment ? (
                              <>
                                <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Submitting...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
                                <span>{isRejectedStatus(booking) ? 'Resubmit Payment Proof' : 'Submit Payment Proof'}</span>
                              </>
                            )}
                        </button>
                          {(() => {
                            const amountPaid = amountByBooking[booking.id] ? Number(amountByBooking[booking.id]) : 0;
                            const hasValidAmount = calculatedAmount > 0 
                              ? (!isNaN(amountPaid) && amountPaid >= calculatedAmount)
                              : (!isNaN(amountPaid) && amountPaid > 0);
                            const missingRequirements = [];
                            
                            if (!selectedAdminByBooking[booking.id]) missingRequirements.push('Please select an admin QR code');
                            if (!selectedPaymentFiles[booking.id]) missingRequirements.push('Please select a payment proof image');
                            if (!amountByBooking[booking.id]) missingRequirements.push('Please enter the amount paid');
                            else if (calculatedAmount > 0 && (isNaN(amountPaid) || amountPaid < calculatedAmount)) {
                              missingRequirements.push(`Amount paid must be at least ₱${calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                            } else if (calculatedAmount === 0 && (isNaN(amountPaid) || amountPaid <= 0)) {
                              missingRequirements.push('Please enter a valid amount');
                            }
                            
                            return missingRequirements.length > 0 ? (
                              <div className="text-[10px] sm:text-xs text-slate-500 space-y-0.5">
                                {missingRequirements.map((req, idx) => (
                                  <p key={idx}>• {req}</p>
                                ))}
                              </div>
                            ) : null;
                          })()}
                          <p className="text-[10px] sm:text-xs text-slate-500 leading-relaxed">
                            Upload a screenshot of your payment to the selected admin QR (max 5MB, JPG/PNG).
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status-specific messages - using payment status */}
                {isRejectedStatus(booking) && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 mb-4">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <Ban className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm sm:text-base md:text-lg text-red-900 mb-1.5 sm:mb-2">Payment Rejected</h4>
                        <p className="text-xs sm:text-sm md:text-base text-red-700 leading-relaxed mb-2 sm:mb-3">
                          Your previous payment proof was rejected. Please select an admin QR code, enter the amount paid, and upload a new proof of payment.
                        </p>
                        {booking.payment?.rejection_reason && (
                          <div className="mt-2 sm:mt-3 p-2.5 sm:p-3 bg-red-100 border border-red-300 rounded-lg">
                            <p className="text-xs sm:text-sm font-semibold text-red-900 mb-1">Rejection Reason:</p>
                            <p className="text-xs sm:text-sm text-red-800 leading-relaxed whitespace-pre-wrap break-words">
                              {booking.payment.rejection_reason}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {effectiveStatus.toLowerCase() === 'pending' && booking.payment_proof && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">
                    <div className="flex items-center text-blue-700">
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                      <p className="text-xs sm:text-sm">Your payment has been submitted and is being reviewed by the admin.</p>
                    </div>
                  </div>
                )}

                {effectiveStatus.toLowerCase() === 'admin_confirmed' && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 sm:p-4 mb-4">
                    <div className="flex items-center text-indigo-700">
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                      <p className="text-xs sm:text-sm">Your payment has been confirmed by the admin. Waiting for tutor confirmation.</p>
                    </div>
                  </div>
                )}

                {effectiveStatus.toLowerCase() === 'confirmed' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mb-4">
                    <div className="flex items-center text-green-700">
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                      <p className="text-xs sm:text-sm">Your payment has been confirmed. The session is now confirmed.</p>
                    </div>
                  </div>
                )}

                {effectiveStatus.toLowerCase() === 'refunded' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4 mb-4">
                    <div className="flex items-center text-orange-700">
                      <Ban className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                      <p className="text-xs sm:text-sm">Your payment has been refunded.</p>
                    </div>
                  </div>
                )}

                {/* Show uploaded indication if a file exists */}
                {booking.payment_proof && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mt-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center text-green-700">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                        <p className="text-xs sm:text-sm">Your payment proof was uploaded.</p>
                      </div>
                      <a
                        href={getFileUrl(booking.payment_proof)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs sm:text-sm text-green-700 hover:text-green-800 underline"
                      >
                        View upload
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Payment History Section */}
      {paymentHistory.length > 0 && (
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 overflow-hidden -mx-2 sm:-mx-3 md:mx-0">
          {/* Modern Header - Matching website theme */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 sm:p-5 md:p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                  <History className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1">Payment History</h2>
                  <p className="text-xs sm:text-sm text-blue-100">{paymentHistory.length} {paymentHistory.length === 1 ? 'payment' : 'payments'} recorded</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Payment Cards */}
          <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
            {paymentHistory.map((payment, index) => {
              const status = getStatusDisplay(payment.status);
              const tutorName = payment.tutor?.user?.name || 'Unknown Tutor';
              const paymentDate = new Date(payment.created_at);
              const isConfirmed = payment.status === 'confirmed' || payment.status === 'admin_confirmed';
              const isRejected = payment.status === 'rejected';
              
              return (
                <div
                  key={payment.payment_id}
                  className="group relative bg-gradient-to-br from-white to-blue-50/30 rounded-xl sm:rounded-2xl border-2 border-slate-200 hover:border-blue-300 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
                >
                  {/* Decorative gradient bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${
                    isConfirmed ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                    isRejected ? 'bg-gradient-to-r from-red-500 to-rose-500' :
                    payment.status === 'pending' ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                    'bg-gradient-to-r from-blue-500 to-indigo-500'
                  }`} />
                  
                  <div className="p-4 sm:p-5 md:p-6">
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                          <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md ${status.color} border-2 ${
                            status.color.includes('yellow') ? 'border-yellow-400' : 
                            status.color.includes('red') ? 'border-red-400' : 
                            status.color.includes('green') ? 'border-green-400' : 
                            status.color.includes('indigo') ? 'border-indigo-400' : 
                            'border-slate-400'
                          }`}>
                            {status.icon}
                            <span className="whitespace-nowrap">{status.text}</span>
                          </div>
                          <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs sm:text-sm font-semibold">
                            #{payment.payment_id}
                          </div>
                        </div>
                        
                        {/* Amount - Prominent Display */}
                        <div className="mb-4 sm:mb-5">
                          <div className="inline-flex items-baseline gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl border-2 border-blue-200 shadow-sm">
                            <span className="text-xs sm:text-sm text-slate-600 font-medium">Amount Paid</span>
                            <span className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                              ₱{Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        
                        {/* Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                              <svg className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] sm:text-xs text-slate-500 font-medium mb-0.5">Tutor</p>
                              <p className="text-sm sm:text-base font-semibold text-slate-900 truncate">{tutorName}</p>
                            </div>
                          </div>
                          
                          {payment.subject && (
                            <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                              <div className="p-1.5 sm:p-2 bg-indigo-100 rounded-lg flex-shrink-0">
                                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] sm:text-xs text-slate-500 font-medium mb-0.5">Subject</p>
                                <p className="text-sm sm:text-base font-semibold text-slate-900 truncate">{payment.subject}</p>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 bg-white rounded-lg border border-slate-200 shadow-sm sm:col-span-2">
                            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                              <svg className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] sm:text-xs text-slate-500 font-medium mb-0.5">Payment Date</p>
                              <p className="text-sm sm:text-base font-semibold text-slate-900">
                                {paymentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                <span className="text-slate-600 font-normal ml-2">at {paymentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Rejection Reason */}
                        {payment.rejection_reason && (
                          <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-200 rounded-xl shadow-sm">
                            <div className="flex items-start gap-2 sm:gap-3">
                              <Ban className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-red-900 mb-1.5">Rejection Reason</p>
                                <p className="text-xs sm:text-sm text-red-800 leading-relaxed whitespace-pre-wrap break-words">
                                  {payment.rejection_reason}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2 sm:gap-3 flex-shrink-0 w-full sm:w-auto">
                        {payment.payment_proof && (
                          <a
                            href={getFileUrl(payment.payment_proof)}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                          >
                            <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                            <span>View Proof</span>
                            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                        {payment.admin_proof && (
                          <a
                            href={getFileUrl(payment.admin_proof)}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                          >
                            <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                            <span>Admin Proof</span>
                            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* QR Modal (reusable site Modal) - outside the bookings loop */}
      <Modal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} title={qrModalTitle || 'QR'}>
        {qrModalUrl ? (
          <div className="w-full flex justify-center">
            <img src={qrModalUrl} alt={qrModalTitle || 'QR Image'} className="max-h-[70vh] object-contain" />
          </div>
        ) : (
          <div className="text-slate-600">No image available</div>
        )}
      </Modal>
    </div>
  );
};

export default TuteePayment;
