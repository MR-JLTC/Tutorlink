import React, { useEffect, useState } from 'react';
import { CreditCard, Upload, AlertCircle, CheckCircle2, Ban } from 'lucide-react';
import apiClient, { getFileUrl } from '../../services/api';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from '../ui/Modal';

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
    gcash_number?: string;
    gcash_qr_url?: string;
    user: {
      name: string;
      email: string;
    };
  };
  amount?: number;
}

const TuteePayment: React.FC = () => {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
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

  const fetchBookings = async (isInitial: boolean = false) => {
    try {
      if (isInitial) setLoading(true);
      const response = await apiClient.get('/users/me/bookings');
      
      // Filter only bookings that need payment or are being processed
      // Also exclude bookings where payment has been confirmed (they will be filtered by backend)
      const relevantBookings = (response.data || []).filter((booking: BookingRequest) => 
        booking.status === 'awaiting_payment' || 
        booking.status === 'payment_pending' ||
        booking.status === 'payment_rejected'
      );
      
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

    if (!file) {
      toast.error('Please select a payment proof image first');
      return;
    }
    if (!adminId) {
      toast.error('Please select an admin QR to pay to');
      return;
    }
    if (!amt || isNaN(Number(amt))) {
      toast.error('Please enter a valid amount');
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
    } catch (err: any) {
      console.error('Failed to upload payment:', err);
      toast.error(err.response?.data?.message || 'Failed to submit payment');
    } finally {
      setUploadingPayment(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
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
      default:
        return {
          icon: <AlertCircle className="h-5 w-5 text-slate-500" />,
          text: status,
          color: 'text-slate-700 bg-slate-50 border-slate-200'
        };
    }
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
    <div className="space-y-6">
      <ToastContainer />
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <CreditCard className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-800">Payment</h1>
        </div>
        <button
          onClick={() => fetchBookings(false)}
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
          <CreditCard className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No Pending Payments</h3>
          <p className="text-slate-600">
            When you have bookings that require payment, they will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const status = getStatusDisplay(booking.status);
            return (
              <div key={booking.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">
                      {booking.subject} with {booking.tutor.user.name}
                    </h3>
                    <p className="text-slate-600">
                      {new Date(booking.date).toLocaleDateString()} at {booking.time} ({booking.duration}h)
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1.5 ${status.color}`}>
                      {status.icon}
                      <span>{status.text}</span>
                    </div>
                    {booking.payment_proof && (
                      <div className="px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        Proof uploaded
                      </div>
                    )}
                  </div>
                </div>

                  <div className="bg-slate-50 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-slate-800 mb-3">Payment Instructions</h4>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <p className="text-sm text-slate-600 mb-3">Choose an admin QR to pay to:</p>

                        {/* If an admin has been selected for this booking, show only that large QR and a Change button. */}
                        {selectedAdminByBooking[booking.id] ? (
                          (() => {
                            const adminId = selectedAdminByBooking[booking.id] as number;
                            const a = admins.find(ad => ad.user_id === adminId);
                            if (!a) return <div className="text-sm text-slate-500">Selected admin not found.</div>;
                            return (
                              <div className="flex flex-col items-center p-4 bg-white rounded border border-slate-200">
                                <img src={getFileUrl(a.qr_code_url)} alt={`Selected QR`} className="h-40 w-40 object-contain bg-white" />
                                <p className="mt-3 text-sm font-medium">{a.name}</p>
                                <div className="mt-2 flex items-center gap-3">
                                  <button onClick={() => { setQrModalUrl(getFileUrl(a.qr_code_url)); setQrModalTitle(a.name); setQrModalOpen(true); }} className="text-xs text-blue-600 hover:underline">View</button>
                                  <button onClick={() => { setSelectedAdminByBooking(prev => { const p = { ...prev }; delete p[booking.id]; return p; }); }} className="text-xs text-blue-600 hover:underline">Change</button>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {admins.map((a) => (
                              <button key={a.user_id} onClick={() => { setSelectedAdminByBooking(prev => ({ ...prev, [booking.id]: a.user_id })); }} className={`flex flex-col items-center gap-2 p-3 rounded border text-left ${selectedAdminByBooking[booking.id] === a.user_id ? 'border-blue-500' : 'border-slate-200'}`}>
                                <img src={getFileUrl(a.qr_code_url)} alt={`${a.name} QR`} className="h-20 w-20 object-contain bg-white border rounded" />
                                <span className="text-sm truncate w-28 text-center">{a.name}</span>
                              </button>
                            ))}
                            {admins.length === 0 && <div className="text-sm text-slate-500">No admin QR codes available.</div>}
                          </div>
                        )}
                      </div>

                      <div className="md:col-span-1 bg-white rounded p-3 border border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Amount Paid</label>
                        <input type="number" min="0" step="0.01" value={amountByBooking[booking.id] || ''} onChange={(e) => setAmountByBooking(prev => ({ ...prev, [booking.id]: e.target.value }))} className="w-full border border-slate-300 rounded-md px-3 py-2 mb-3" placeholder="0.00" />

                        {/* Upload panel moved to the right column to utilize space */}
                        <label className="block text-sm font-medium text-slate-700 mb-2">Upload Payment Proof</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePaymentFileChange(e, booking.id)}
                          className="w-full mb-2"
                        />
                        {selectedPaymentFiles[booking.id] && (
                          <div className="text-xs text-slate-600 truncate mb-2">{selectedPaymentFiles[booking.id]?.name}</div>
                        )}
                        <button
                          onClick={() => handleUploadPayment(booking.id)}
                          disabled={!selectedPaymentFiles[booking.id] || uploadingPayment || !selectedAdminByBooking[booking.id] || !amountByBooking[booking.id]}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Upload className="h-4 w-4" />
                          <span>{uploadingPayment ? 'Submitting...' : 'Submit Payment Proof'}</span>
                        </button>
                        <p className="text-xs text-slate-500 mt-2">
                          Please upload a screenshot of your payment to the selected admin QR (max 5MB).
                        </p>
                      </div>
                    </div>
                  </div>

                {/* QR Modal (reusable site Modal) */}
                <Modal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} title={qrModalTitle || 'QR'}>
                  {qrModalUrl ? (
                    <div className="w-full flex justify-center">
                      <img src={qrModalUrl} alt={qrModalTitle || 'QR Image'} className="max-h-[70vh] object-contain" />
                    </div>
                  ) : (
                    <div className="text-slate-600">No image available</div>
                  )}
                </Modal>

                {booking.status === 'payment_rejected' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-red-800 mb-2">Payment Rejected</h4>
                    <p className="text-sm text-red-600">
                      Your previous payment proof was rejected. Please upload a new proof of payment.
                    </p>
                  </div>
                )}

                {/* Show uploaded indication if a file exists */}
                {booking.payment_proof && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-green-700">
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        <p>Your payment proof was uploaded. Waiting for tutor review.</p>
                      </div>
                      <a
                        href={getFileUrl(booking.payment_proof)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-green-700 hover:text-green-800 underline"
                      >
                        View upload
                      </a>
                    </div>
                  </div>
                )}

                

                {booking.status === 'payment_pending' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <div className="flex items-center text-blue-700">
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      <p>Your payment has been submitted and is being reviewed by the admin.</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TuteePayment;
